import { describe, expect, it } from 'vitest'
import type { AppState, Operation, Organization, Store, TaxRegistration } from '@/types'
import { buildTaxCalendar, calendarSummary } from './taxCalendar'

const org = (overrides: Partial<Organization> = {}): Organization => ({
  id: 'org-1',
  ownerUserId: 'owner',
  legalForm: 'ip',
  name: 'ИП Тестов',
  status: 'active',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
})

const usnStore = (overrides: Partial<Store> = {}): Store => ({
  id: 'store-1',
  name: 'Маркетплейсы',
  organizationId: 'org-1',
  // ВАЖНО: гейт "взносы только для ИП" в taxCalendar.ts (buildTaxCalendar,
  // блок insurance-fixed/insurance-1pct) читает store.legalForm, а не
  // organization.legalForm. Это намеренно, а не рассинхрон: store.legalForm —
  // единственное поле формы, которое пользователь реально редактирует
  // (Настройки → «Форма» по каждому магазину), и оно же управляет настоящим
  // расчётом ОСНО в tax.ts (налог на прибыль ООО vs НДФЛ ИП). organization.legalForm
  // задаётся один раз при создании в «Мои организации» и нигде после не
  // редактируется — то есть это store, а не organization, здесь источник
  // истины. Проверено отдельно, менять не нужно.
  legalForm: 'ip',
  regime: 'usn6',
  usnIncomeRate: 6,
  insurancePremiums: 0,
  hasEmployees: false,
  ...overrides,
})

const op = (revenue: number, date: string, overrides: Partial<Operation> = {}): Operation => ({
  id: `op-${date}-${revenue}`,
  storeId: 'store-1',
  marketplace: 'ozon',
  date,
  revenue,
  commission: 0,
  logistics: 0,
  ads: 0,
  otherExpenses: 0,
  ...overrides,
})

const baseState = (overrides: Partial<AppState> = {}): AppState => ({
  stores: [],
  operations: [],
  credentials: [],
  ...overrides,
})

describe('buildTaxCalendar: статус по срокам', () => {
  // Единственное обязательство с фиксированной датой — фиксированные взносы
  // ИП за 2026 год, dueDate = '2026-12-28' (см. taxCalendar.ts).
  const state = baseState({
    organizations: [org()],
    stores: [usnStore({ regime: 'usn6' })], // не usn — не влияет, insurance гейтится legalForm==='ip'
  })

  it.each([
    ['2026-09-01', 'future'],
    ['2026-11-20', 'upcoming'],
    ['2026-12-20', 'soon'],
    ['2027-01-05', 'overdue'],
  ] as const)('today=%s -> статус %s для фиксированных взносов', (today, expected) => {
    const rows = buildTaxCalendar(state, 2026, today)
    const insurance = rows.find((r) => r.id === 'org-1-insurance-fixed-2026')
    expect(insurance?.status).toBe(expected)
  })
})

describe('buildTaxCalendar: погашение оплатой', () => {
  const state = (payments: AppState['taxPayments']) =>
    baseState({ organizations: [org()], stores: [usnStore()], taxPayments: payments })

  it('полная оплата закрывает обязательство статусом paid и балансом 0', () => {
    const rows = buildTaxCalendar(
      state([
        {
          id: 'p1',
          organizationId: 'org-1',
          kind: 'insurance_fixed',
          amount: 57_390,
          paidAt: '2026-06-01',
          obligationId: 'org-1-insurance-fixed-2026',
        },
      ]),
      2026,
      '2026-06-15',
    )
    const insurance = rows.find((r) => r.id === 'org-1-insurance-fixed-2026')
    expect(insurance?.paidAmount).toBe(57_390)
    expect(insurance?.balance).toBe(0)
    expect(insurance?.status).toBe('paid')
  })

  it('частичная оплата уменьшает баланс, но не закрывает статус', () => {
    const rows = buildTaxCalendar(
      state([
        {
          id: 'p1',
          organizationId: 'org-1',
          kind: 'insurance_fixed',
          amount: 20_000,
          paidAt: '2026-06-01',
          obligationId: 'org-1-insurance-fixed-2026',
        },
      ]),
      2026,
      '2026-12-20', // "soon" по дате, если бы не было оплаты
    )
    const insurance = rows.find((r) => r.id === 'org-1-insurance-fixed-2026')
    expect(insurance?.paidAmount).toBe(20_000)
    expect(insurance?.balance).toBe(37_390)
    expect(insurance?.status).toBe('soon')
  })
})

describe('buildTaxCalendar: накопительный расчёт авансов УСН по кварталам', () => {
  // hasEmployees:true фиксирует взносы = store.insurancePremiums напрямую
  // (без авто-расчёта calcInsurance2026 от выручки) — так итоговые суммы
  // можно проверить руками, без дублирования формулы calcTax в тесте.
  const store = usnStore({ hasEmployees: true, insurancePremiums: 10_000, usnIncomeRate: 6 })
  const operations = [
    op(500_000, '2026-02-01'), // в Q1 (<= 03-31)
    op(700_000, '2026-05-01'), // в H1, не в Q1
    op(600_000, '2026-08-01'), // в 9 месяцах, не в H1
  ]
  const rows = buildTaxCalendar(
    baseState({ organizations: [org()], stores: [store], operations }),
    2026,
    '2026-01-01',
  )
  const payRow = (label: string) => rows.find((r) => r.id === `org-1-usn-pay-${label}`)

  // Q1: revenue 500 000 → taxGross 30 000, deduction min(10 000, 30 000*0.5)=10 000 → taxDue 20 000
  it('1 квартал: аванс = налог за квартал минус вычет взносов (лимит 50%)', () => {
    expect(payRow('1 квартал')?.amount).toBe(20_000)
  })

  // H1: revenue 1 200 000 (кумулятивно) → taxGross 72 000, deduction 10 000 → taxDue 62 000
  // аванс = 62 000 - 20 000 (уже учтено в Q1)
  it('полугодие: аванс = кумулятивный налог минус то, что уже покрыто предыдущим авансом', () => {
    expect(payRow('полугодие')?.amount).toBe(42_000)
  })

  // 9 мес: revenue 1 800 000 (кумулятивно) → taxGross 108 000, deduction 10 000 → taxDue 98 000
  // аванс = 98 000 - 62 000
  it('9 месяцев: аванс продолжает накопительную логику', () => {
    expect(payRow('9 месяцев')?.amount).toBe(36_000)
  })

  it('уведомление по УСН содержит ту же сумму, что и платёж', () => {
    const notice = rows.find((r) => r.id === 'org-1-usn-notice-1 квартал')
    expect(notice?.amount).toBe(payRow('1 квартал')?.amount)
  })
})

describe('buildTaxCalendar: фиксированные взносы только для магазинов с legalForm=ip', () => {
  it('организация с магазином ООО не получает обязательств по взносам', () => {
    const ooo = org({ id: 'org-ooo', legalForm: 'ooo' })
    const store = usnStore({ id: 'store-ooo', organizationId: 'org-ooo', legalForm: 'ooo' })
    const rows = buildTaxCalendar(
      baseState({ organizations: [ooo], stores: [store] }),
      2026,
      '2026-01-01',
    )
    expect(rows.some((r) => r.id === 'org-ooo-insurance-fixed-2026')).toBe(false)
    expect(rows.some((r) => r.id === 'org-ooo-insurance-1pct-2026')).toBe(false)
  })

  it('организация с магазином ИП получает и фиксированные, и дополнительный 1% взнос', () => {
    const rows = buildTaxCalendar(
      baseState({ organizations: [org()], stores: [usnStore()] }),
      2026,
      '2026-01-01',
    )
    expect(rows.some((r) => r.id === 'org-1-insurance-fixed-2026')).toBe(true)
    expect(rows.some((r) => r.id === 'org-1-insurance-1pct-2026')).toBe(true)
  })

  it('если у организации нет ни одного магазина, взносы не начисляются вовсе', () => {
    // Не самостоятельный кейс "ООО vs ИП" — просто фиксирует, что гейт
    // читает stores, а не organizations, поэтому организация без магазинов
    // (даже ИП) не получит обязательство по взносам.
    const rows = buildTaxCalendar(baseState({ organizations: [org()] }), 2026, '2026-01-01')
    expect(rows.some((r) => r.id === 'org-1-insurance-fixed-2026')).toBe(false)
  })
})

describe('buildTaxCalendar: платежи по патенту (ПСН)', () => {
  const registration: TaxRegistration = {
    id: 'reg-psn',
    organizationId: 'org-1',
    regime: 'psn',
    validFrom: '2026-01-01',
    hasEmployees: false,
    patent: {
      validFrom: '2026-01-01',
      validTo: '2026-12-31',
      cost: 60_000,
      paymentSchedule: 'installments',
      patentNumber: '78 0012345',
      payments: [
        { dueDate: '2026-02-25', amount: 20_000, share: 'one_third' },
        { dueDate: '2026-12-25', amount: 40_000, share: 'two_thirds' },
      ],
    },
  }

  it('создаёт по одному обязательству на каждый платёж патента', () => {
    const rows = buildTaxCalendar(
      baseState({ organizations: [org()], taxRegistrations: [registration] }),
      2026,
      '2026-01-01',
    )
    const first = rows.find((r) => r.id === 'org-1-patent-reg-psn-0')
    const second = rows.find((r) => r.id === 'org-1-patent-reg-psn-1')
    expect(first).toMatchObject({
      title: 'ПСН — первый платеж',
      amount: 20_000,
      dueDate: '2026-02-25',
    })
    expect(second).toMatchObject({
      title: 'ПСН — оставшаяся часть',
      amount: 40_000,
      dueDate: '2026-12-25',
    })
    expect(first?.note).toContain('78 0012345')
  })

  it('платежи патента не зависят от параметра year (в отличие от УСН/взносов)', () => {
    const rows2027 = buildTaxCalendar(
      baseState({ organizations: [org()], taxRegistrations: [registration] }),
      2027,
      '2026-01-01',
    )
    expect(rows2027.some((r) => r.id === 'org-1-patent-reg-psn-0')).toBe(true)
    // А вот УСН-уведомления и взносы в 2027 не строятся — год захардкожен в taxCalendar.ts.
    expect(rows2027.some((r) => r.id === 'org-1-insurance-fixed-2026')).toBe(false)
  })
})

describe('buildTaxCalendar: сортировка по сроку', () => {
  it('возвращает обязательства отсортированными по возрастанию dueDate', () => {
    const registration: TaxRegistration = {
      id: 'reg-psn',
      organizationId: 'org-1',
      regime: 'psn',
      validFrom: '2026-01-01',
      hasEmployees: false,
      patent: {
        validFrom: '2026-01-01',
        validTo: '2026-12-31',
        cost: 10_000,
        paymentSchedule: 'installments',
        payments: [{ dueDate: '2026-03-01', amount: 10_000 }],
      },
    }
    const rows = buildTaxCalendar(
      baseState({ organizations: [org()], taxRegistrations: [registration] }),
      2026,
      '2026-01-01',
    )
    const dates = rows.map((r) => r.dueDate)
    expect(dates).toEqual([...dates].sort())
  })
})

describe('calendarSummary', () => {
  it('агрегирует количество по статусам и суммы для soon/overdue по balance с фоллбеком на amount', () => {
    const summary = calendarSummary([
      {
        id: '1',
        organizationId: 'o',
        organizationName: 'o',
        kind: 'tax',
        title: 'paid',
        dueDate: '2026-01-01',
        paidAmount: 100,
        status: 'paid',
      },
      {
        id: '2',
        organizationId: 'o',
        organizationName: 'o',
        kind: 'tax',
        title: 'overdue-with-balance',
        dueDate: '2026-01-01',
        paidAmount: 0,
        balance: 1_000,
        status: 'overdue',
      },
      {
        id: '3',
        organizationId: 'o',
        organizationName: 'o',
        kind: 'tax',
        title: 'soon-без-balance-падает-на-amount',
        dueDate: '2026-01-01',
        amount: 500,
        paidAmount: 0,
        status: 'soon',
      },
      {
        id: '4',
        organizationId: 'o',
        organizationName: 'o',
        kind: 'tax',
        title: 'upcoming',
        dueDate: '2026-01-01',
        paidAmount: 0,
        status: 'upcoming',
      },
    ])

    expect(summary).toEqual({
      paid: 1,
      overdue: 1,
      soon: 1,
      upcoming: 1,
      amountSoon: 500,
      overdueBalance: 1_000,
    })
  })
})

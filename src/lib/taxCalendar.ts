import type { AppState } from '@/types'
import { calcTax, fmtMoney, quarterlyAdvances } from './tax'

export type ObligationKind = 'notification' | 'tax' | 'patent' | 'insurance' | 'declaration'
export type ObligationStatus = 'overdue' | 'soon' | 'upcoming' | 'future'

export interface TaxObligation {
  id: string
  organizationId: string
  organizationName: string
  kind: ObligationKind
  title: string
  dueDate: string
  amount?: number
  status: ObligationStatus
  note?: string
  source?: string
}

const toIso = (d: Date) => d.toISOString().slice(0, 10)
const parseDate = (iso: string) => new Date(`${iso}T00:00:00`)

function diffDays(fromIso: string, toIso: string) {
  return Math.ceil((parseDate(toIso).getTime() - parseDate(fromIso).getTime()) / 86_400_000)
}

export function obligationStatus(dueDate: string, today = toIso(new Date())): ObligationStatus {
  const days = diffDays(today, dueDate)
  if (days < 0) return 'overdue'
  if (days <= 14) return 'soon'
  if (days <= 60) return 'upcoming'
  return 'future'
}

const add = (
  rows: TaxObligation[],
  item: Omit<TaxObligation, 'status'>,
  today: string,
) => rows.push({ ...item, status: obligationStatus(item.dueDate, today) })

/**
 * Календарь обязательств для ИП за 2026 год.
 * Сроки УСН и страховых взносов фиксированы для 2026 года.
 * Сроки ПСН берутся из профиля патента, если заполнен paymentDates.
 * Суммы УСН — предварительные и зависят от полноты загруженных операций.
 */
export function buildTaxCalendar(state: AppState, year = 2026, today = toIso(new Date())): TaxObligation[] {
  const rows: TaxObligation[] = []
  const organizations = state.organizations ?? []

  for (const organization of organizations) {
    const orgStores = state.stores.filter((s) => s.organizationId === organization.id)
    const usnStores = orgStores.filter((s) => s.regime === 'usn6' || s.regime === 'usn15')

    if (year === 2026 && usnStores.length) {
      const deadlines = [
        { label: '1 квартал', notice: '2026-04-27', pay: '2026-04-28' },
        { label: 'полугодие', notice: '2026-07-27', pay: '2026-07-28' },
        { label: '9 месяцев', notice: '2026-10-26', pay: '2026-10-28' },
      ]

      for (const deadline of deadlines) {
        const periodEnd = deadline.label === '1 квартал' ? '2026-03-31' : deadline.label === 'полугодие' ? '2026-06-30' : '2026-09-30'
        const gross = usnStores.reduce((sum, store) => {
          const ops = state.operations.filter((o) => o.storeId === store.id && o.date >= '2026-01-01' && o.date <= periodEnd)
          return sum + calcTax(store, ops).taxDue
        }, 0)

        add(rows, {
          id: `${organization.id}-usn-notice-${deadline.label}`,
          organizationId: organization.id,
          organizationName: organization.name,
          kind: 'notification',
          title: `Уведомление по УСН — ${deadline.label}`,
          dueDate: deadline.notice,
          amount: gross > 0 ? gross : undefined,
          note: gross > 0 ? 'Сумма рассчитана по загруженным данным и требует проверки полноты периода.' : 'Если аванс к уплате равен нулю, уведомление по УСН обычно не требуется.',
          source: 'ФНС: уведомление до 25-го числа с учетом переноса выходных',
        }, today)

        add(rows, {
          id: `${organization.id}-usn-pay-${deadline.label}`,
          organizationId: organization.id,
          organizationName: organization.name,
          kind: 'tax',
          title: `Аванс УСН — ${deadline.label}`,
          dueDate: deadline.pay,
          amount: gross,
          note: 'Предварительно: рассчитано по операциям, имеющимся в Роботе-бухгалтере.',
          source: 'ФНС: уплата авансов УСН не позднее 28 апреля / 28 июля / 28 октября',
        }, today)
      }

      add(rows, {
        id: `${organization.id}-usn-year-pay`,
        organizationId: organization.id,
        organizationName: organization.name,
        kind: 'tax',
        title: 'УСН за 2026 год — ИП',
        dueDate: '2027-04-28',
        note: 'Итоговый налог ИП за 2026 год. Перед оплатой нужен полный годовой расчет.',
        source: 'ФНС: срок уплаты УСН ИП за год — 28 апреля следующего года',
      }, today)
    }

    if (year === 2026 && orgStores.some((s) => s.legalForm === 'ip')) {
      add(rows, {
        id: `${organization.id}-insurance-fixed-2026`,
        organizationId: organization.id,
        organizationName: organization.name,
        kind: 'insurance',
        title: 'Фиксированные страховые взносы ИП за 2026 год',
        dueDate: '2026-12-28',
        amount: 57_390,
        note: 'Совокупный фиксированный размер за 2026 год.',
        source: 'ФНС: фиксированные взносы ИП за 2026 год — 57 390 ₽ до 28.12.2026',
      }, today)

      add(rows, {
        id: `${organization.id}-insurance-1pct-2026`,
        organizationId: organization.id,
        organizationName: organization.name,
        kind: 'insurance',
        title: 'Дополнительный страховой взнос 1% за 2026 год',
        dueDate: '2027-07-01',
        note: '1% с базы свыше 300 000 ₽; окончательная сумма определяется после завершения 2026 года.',
        source: 'ФНС: дополнительный 1% за 2026 год — не позднее 01.07.2027',
      }, today)
    }

    const registrations = (state.taxRegistrations ?? []).filter((r) => r.organizationId === organization.id && r.regime === 'psn')
    for (const registration of registrations) {
      const patent = registration.patent
      if (!patent) continue
      for (const [index, payment] of (patent.paymentDates ?? []).entries()) {
        add(rows, {
          id: `${organization.id}-patent-${registration.id}-${index}`,
          organizationId: organization.id,
          organizationName: organization.name,
          kind: 'patent',
          title: index === 0 ? 'ПСН — первый платеж' : 'ПСН — оставшаяся часть',
          dueDate: payment.dueDate,
          amount: payment.amount,
          note: patent.patentNumber ? `Патент № ${patent.patentNumber}` : 'Срок и сумма взяты из карточки патента.',
          source: 'Патент ФНС',
        }, today)
      }
    }
  }

  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
}

export function calendarSummary(rows: TaxObligation[]) {
  return {
    overdue: rows.filter((r) => r.status === 'overdue').length,
    soon: rows.filter((r) => r.status === 'soon').length,
    upcoming: rows.filter((r) => r.status === 'upcoming').length,
    amountSoon: rows.filter((r) => r.status === 'soon').reduce((sum, r) => sum + (r.amount ?? 0), 0),
  }
}

export const obligationKindLabel: Record<ObligationKind, string> = {
  notification: 'Уведомление',
  tax: 'Налог',
  patent: 'ПСН',
  insurance: 'Взносы',
  declaration: 'Декларация',
}

export const formatObligationAmount = (amount?: number) => amount == null ? 'сумма уточняется' : fmtMoney(amount)

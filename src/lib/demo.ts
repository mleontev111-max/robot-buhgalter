import type { AppState, MarketplaceId, Operation } from '@/types'

const uid = () => Math.random().toString(36).slice(2, 10)

const PRODUCTS = [
  'Пуэр Шу, блин 357 г',
  'Те Гуань Инь, 100 г',
  'Да Хун Пао, 50 г',
  'Габа Алишань, 100 г',
  'Белый чай Шоу Мэй, 100 г',
  'Чайная пара фарфор',
  'Гайвань 120 мл',
  'Чабань «Бамбук»',
  'Матча церемониальная, 50 г',
]

const PATENT_2026 = {
  cost: 146_601,
  potentialIncome: 2_443_350,
  validFrom: '2026-01-01',
  validTo: '2026-12-31',
} as const

export function makeDemoState(): AppState {
  const now = new Date().toISOString()

  const users = [{
    id: 'local-owner', email: 'owner@robot-buhgalter.local', displayName: 'Владелец', role: 'owner' as const,
    organizationIds: ['org-olga', 'org-mikhail'], createdAt: now, status: 'active' as const,
  }]

  const organizations = [
    { id: 'org-olga', ownerUserId: 'local-owner', legalForm: 'ip' as const, name: 'ИП Григорьева Ольга Леонидовна', status: 'active' as const, createdAt: now },
    { id: 'org-mikhail', ownerUserId: 'local-owner', legalForm: 'ip' as const, name: 'ИП Леонтьев Михаил Александрович', status: 'active' as const, createdAt: now },
  ]

  const taxRegistrations = [
    {
      id: 'tax-olga-psn', organizationId: 'org-olga', regime: 'psn' as const,
      validFrom: PATENT_2026.validFrom, vatMode: 'exempt' as const, hasEmployees: false, employeesCount: 0,
      patent: { validFrom: PATENT_2026.validFrom, validTo: PATENT_2026.validTo, cost: PATENT_2026.cost, potentialIncome: PATENT_2026.potentialIncome, paymentSchedule: 'annual' as const },
    },
    { id: 'tax-olga-usn', organizationId: 'org-olga', regime: 'usn6' as const, validFrom: '2026-01-01', usnIncomeRate: 6, vatMode: 'auto' as const, hasEmployees: false, employeesCount: 0 },
    {
      id: 'tax-mikhail-psn', organizationId: 'org-mikhail', regime: 'psn' as const,
      validFrom: PATENT_2026.validFrom, vatMode: 'exempt' as const, hasEmployees: false, employeesCount: 0,
      patent: { validFrom: PATENT_2026.validFrom, validTo: PATENT_2026.validTo, cost: PATENT_2026.cost, potentialIncome: PATENT_2026.potentialIncome, paymentSchedule: 'annual' as const },
    },
    { id: 'tax-mikhail-usn', organizationId: 'org-mikhail', regime: 'usn6' as const, validFrom: '2026-01-01', usnIncomeRate: 6, vatMode: 'auto' as const, hasEmployees: false, employeesCount: 0 },
  ]

  const businessUnits = [
    { id: 'unit-olga-retail', organizationId: 'org-olga', name: 'Розничный магазин — Невский проспект 100', type: 'retail_store' as const, address: 'Санкт-Петербург, Невский проспект, 100', taxRegistrationIds: ['tax-olga-psn'], active: true },
    { id: 'unit-olga-other', organizationId: 'org-olga', name: 'Прочие продажи — УСН 6%', type: 'online_store' as const, taxRegistrationIds: ['tax-olga-usn'], active: true },
    { id: 'unit-mikhail-retail', organizationId: 'org-mikhail', name: 'Розничный магазин — Балтийский бульвар 4', type: 'retail_store' as const, address: 'Санкт-Петербург, Балтийский бульвар, 4', taxRegistrationIds: ['tax-mikhail-psn'], active: true },
    { id: 'unit-mikhail-marketplaces', organizationId: 'org-mikhail', name: 'Маркетплейсы / интернет / опт — УСН 6%', type: 'online_store' as const, taxRegistrationIds: ['tax-mikhail-usn'], active: true },
  ]

  const salesChannels = [
    { id: 'ch-olga-retail', organizationId: 'org-olga', businessUnitId: 'unit-olga-retail', type: 'retail' as const, name: 'Розничная касса', sourceType: 'cash_register' as const, active: true },
    { id: 'ch-olga-usn', organizationId: 'org-olga', businessUnitId: 'unit-olga-other', type: 'website' as const, name: 'Интернет / опт', sourceType: 'manual' as const, active: true },
    { id: 'ch-mikhail-retail', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-retail', type: 'retail' as const, name: 'Розничная касса', sourceType: 'cash_register' as const, active: true },
    { id: 'ch-mikhail-wb', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-marketplaces', type: 'marketplace' as const, marketplace: 'wb' as const, name: 'Wildberries', sourceType: 'marketplace_api' as const, active: true },
    { id: 'ch-mikhail-ozon', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-marketplaces', type: 'marketplace' as const, marketplace: 'ozon' as const, name: 'Ozon', sourceType: 'marketplace_api' as const, active: true },
    { id: 'ch-mikhail-site', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-marketplaces', type: 'website' as const, name: 'Интернет-магазин', sourceType: 'manual' as const, active: true },
    { id: 'ch-mikhail-wholesale', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-marketplaces', type: 'wholesale' as const, name: 'Оптовые продажи', sourceType: 'bank_statement' as const, active: true },
  ]

  const stores = [
    { id: 'olga-psn', name: 'Григорьева — розница (ПСН)', legalForm: 'ip' as const, organizationId: 'org-olga', taxRegistrationId: 'tax-olga-psn', businessUnitId: 'unit-olga-retail', regime: 'psn' as const, insurancePremiums: 0, hasEmployees: false, patentCost: PATENT_2026.cost, patentPotentialIncome: PATENT_2026.potentialIncome, vatMode: 'exempt' as const },
    { id: 'olga-usn', name: 'Григорьева — УСН 6%', legalForm: 'ip' as const, organizationId: 'org-olga', taxRegistrationId: 'tax-olga-usn', businessUnitId: 'unit-olga-other', regime: 'usn6' as const, insurancePremiums: 0, hasEmployees: false, usnIncomeRate: 6, vatMode: 'auto' as const },
    { id: 'mikhail-psn', name: 'Леонтьев — розница (ПСН)', legalForm: 'ip' as const, organizationId: 'org-mikhail', taxRegistrationId: 'tax-mikhail-psn', businessUnitId: 'unit-mikhail-retail', regime: 'psn' as const, insurancePremiums: 0, hasEmployees: false, patentCost: PATENT_2026.cost, patentPotentialIncome: PATENT_2026.potentialIncome, vatMode: 'exempt' as const },
    { id: 'mikhail-usn', name: 'Леонтьев — маркетплейсы / интернет / опт (УСН 6%)', legalForm: 'ip' as const, organizationId: 'org-mikhail', taxRegistrationId: 'tax-mikhail-usn', businessUnitId: 'unit-mikhail-marketplaces', regime: 'usn6' as const, insurancePremiums: 0, hasEmployees: false, usnIncomeRate: 6, vatMode: 'auto' as const },
  ]

  const mps: MarketplaceId[] = ['ozon', 'wb']
  const ops: Operation[] = []
  const dateNow = new Date()

  for (let monthsAgo = 5; monthsAgo >= 0; monthsAgo--) {
    const d = new Date(dateNow.getFullYear(), dateNow.getMonth() - monthsAgo, 1)
    const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    for (let i = 0; i < 24; i++) {
      const mp = mps[i % mps.length]
      const day = 1 + ((i * 7) % daysInMonth)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      if (date > dateNow.toISOString().slice(0, 10)) continue
      const revenue = 1500 + (i % 9) * 420
      const commission = Math.round(revenue * (mp === 'wb' ? 0.17 : 0.15))
      const logistics = 80 + (i % 5) * 35
      const ads = i % 4 === 0 ? Math.round(revenue * 0.05) : 0
      ops.push({
        id: uid(), storeId: 'mikhail-usn', organizationId: 'org-mikhail', businessUnitId: 'unit-mikhail-marketplaces',
        taxRegistrationId: 'tax-mikhail-usn', channelId: mp === 'wb' ? 'ch-mikhail-wb' : 'ch-mikhail-ozon', sourceType: 'marketplace_api',
        marketplace: mp, date, revenue, commission, logistics, ads, otherExpenses: 0, note: PRODUCTS[i % PRODUCTS.length],
      })
    }
  }

  ops.sort((a, b) => b.date.localeCompare(a.date))
  return {
    stores, operations: ops, credentials: [], users, organizations, taxRegistrations, businessUnits, salesChannels,
    accessGrants: [], subscriptions: [{ id: 'sub-local', ownerUserId: 'local-owner', plan: 'accountant', status: 'active', currentPeriodStart: '2026-01-01', currentPeriodEnd: '2026-12-31' }],
    schemaVersion: 3,
  }
}

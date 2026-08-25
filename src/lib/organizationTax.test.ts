import { describe, expect, it } from 'vitest'
import type { Operation, Store } from '@/types'
import { calcOrganizationTax } from './organizationTax'

const stores: Store[] = [
  {
    id: 'usn',
    name: 'Маркетплейсы',
    organizationId: 'ip-1',
    regime: 'usn6',
    usnIncomeRate: 6,
    insurancePremiums: 0,
    hasEmployees: false,
  },
  {
    id: 'psn',
    name: 'Розница',
    organizationId: 'ip-1',
    regime: 'psn',
    patentCost: 80_000,
    patentPotentialIncome: 1_000_000,
    insurancePremiums: 0,
    hasEmployees: false,
  },
]

const operations: Operation[] = [{
  id: 'sale',
  storeId: 'usn',
  marketplace: 'ozon',
  date: '2026-05-01',
  revenue: 2_000_000,
  commission: 0,
  logistics: 0,
  ads: 0,
  otherExpenses: 0,
}]

describe('совмещение ПСН и УСН на уровне Organization', () => {
  it('начисляет фиксированные взносы один раз на ИП и распределяет их без дублирования', () => {
    const result = calcOrganizationTax('ip-1', stores, operations, '2026-01-01', '2026-12-31', 'usn')

    expect(result.fixedInsurance).toBe(57_390)
    expect(result.additionalInsurance).toBe(27_000)
    expect(result.totalInsurance).toBe(84_390)
    expect(result.taxBeforeInsurance).toBe(200_000)
    expect(result.insuranceUsed).toBe(84_390)
    expect(result.taxAfterInsurance).toBe(115_610)
    expect(result.lines.find((line) => line.storeId === 'usn')?.insuranceDeduction).toBe(84_390)
    expect(result.lines.find((line) => line.storeId === 'psn')?.insuranceDeduction).toBe(0)
  })

  it('может направить единый вычет на патент', () => {
    const result = calcOrganizationTax('ip-1', stores, operations, '2026-01-01', '2026-12-31', 'psn')

    expect(result.insuranceUsed).toBe(80_000)
    expect(result.remainingInsurance).toBe(4_390)
    expect(result.lines.find((line) => line.storeId === 'psn')?.taxAfterInsurance).toBe(0)
    expect(result.lines.find((line) => line.storeId === 'usn')?.taxAfterInsurance).toBe(120_000)
  })
})

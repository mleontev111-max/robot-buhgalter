import type { Operation, Store } from '@/types'
import { TAX_2026, calcInsurance2026, sumOps } from './tax'

/** Расчёт налогов на уровне ИП, а не отдельной торговой точки. */
export type InsuranceAllocation = 'proportional' | 'usn' | 'psn'

export interface OrganizationTaxLine {
  storeId: string
  storeName: string
  regime: Store['regime']
  revenue: number
  grossTax: number
  insuranceDeduction: number
  taxAfterInsurance: number
  notes: string[]
}

export interface OrganizationTaxSummary {
  organizationId: string
  periodFrom: string
  periodTo: string
  revenue: number
  fixedInsurance: number
  additionalInsurance: number
  totalInsurance: number
  insuranceAllocation: InsuranceAllocation
  lines: OrganizationTaxLine[]
  taxBeforeInsurance: number
  insuranceUsed: number
  taxAfterInsurance: number
  remainingInsurance: number
}

const eligible = (store: Store) => store.regime === 'usn6' || store.regime === 'psn'

function grossTax(store: Store, ops: Operation[]) {
  const revenue = Math.max(0, sumOps(ops).revenue)
  if (store.regime === 'usn6') return revenue * ((store.usnIncomeRate ?? 6) / 100)
  if (store.regime === 'psn') return Math.max(0, store.patentCost ?? 0)
  return 0
}

function allocateInsurance(
  stores: Store[],
  ops: Operation[],
  totalInsurance: number,
  allocation: InsuranceAllocation,
) {
  const candidates = stores.filter(eligible)
  if (!candidates.length || totalInsurance <= 0) return new Map<string, number>()

  if (allocation === 'usn') {
    const store = candidates.find((s) => s.regime === 'usn6')
    return new Map(store ? [[store.id, totalInsurance]] : [])
  }
  if (allocation === 'psn') {
    const store = candidates.find((s) => s.regime === 'psn')
    return new Map(store ? [[store.id, totalInsurance]] : [])
  }

  const revenues = candidates.map((store) => ({
    store,
    revenue: sumOps(ops.filter((op) => op.storeId === store.id)).revenue,
  }))
  const totalRevenue = revenues.reduce((sum, item) => sum + Math.max(0, item.revenue), 0)
  if (totalRevenue <= 0) return new Map<string, number>()

  const result = new Map<string, number>()
  let allocated = 0
  revenues.forEach((item, index) => {
    const amount = index === revenues.length - 1
      ? Math.max(0, totalInsurance - allocated)
      : Math.round(totalInsurance * Math.max(0, item.revenue) / totalRevenue * 100) / 100
    allocated += amount
    result.set(item.store.id, amount)
  })
  return result
}

/**
 * Общий расчёт обязательств одного ИП.
 * Фиксированные взносы и дополнительный 1% создаются один раз на ИП,
 * затем вычет распределяется между ПСН и УСН.
 */
export function calcOrganizationTax(
  organizationId: string,
  stores: Store[],
  operations: Operation[],
  from: string,
  to: string,
  allocation: InsuranceAllocation = 'proportional',
): OrganizationTaxSummary {
  const orgStores = stores.filter((store) => store.organizationId === organizationId)
  const ids = new Set(orgStores.map((store) => store.id))
  const orgOps = operations.filter((op) => ids.has(op.storeId) && op.date >= from && op.date <= to)
  const revenue = orgOps.reduce((sum, op) => sum + Math.max(0, op.revenue), 0)

  const usnRevenue = orgStores
    .filter((store) => store.regime === 'usn6' || store.regime === 'usn15')
    .reduce((sum, store) => sum + sumOps(orgOps.filter((op) => op.storeId === store.id)).revenue, 0)
  const psnPotential = orgStores
    .filter((store) => store.regime === 'psn')
    .reduce((sum, store) => sum + Math.max(0, store.patentPotentialIncome ?? 0), 0)

  const insurance = calcInsurance2026(usnRevenue + psnPotential)
  const allocated = allocateInsurance(orgStores, orgOps, insurance.total, allocation)

  const lines = orgStores.map((store) => {
    const storeOps = orgOps.filter((op) => op.storeId === store.id)
    const gross = grossTax(store, storeOps)
    const requested = allocated.get(store.id) ?? 0
    const deduction = store.hasEmployees ? Math.min(requested, gross * 0.5) : Math.min(requested, gross)
    const notes: string[] = []

    if (eligible(store) && !store.hasEmployees) {
      notes.push('ИП без работников: страховые взносы могут уменьшать налог без ограничения 50%.')
    }
    if (eligible(store)) notes.push(`Распределение страховых взносов: ${allocation}.`)
    if (store.hasEmployees && eligible(store)) notes.push('При наличии работников учтено ограничение 50%.')
    if (requested > deduction) notes.push('Часть выделенных взносов не использована из-за недостаточной суммы налога.')

    return {
      storeId: store.id,
      storeName: store.name,
      regime: store.regime,
      revenue: sumOps(storeOps).revenue,
      grossTax: gross,
      insuranceDeduction: deduction,
      taxAfterInsurance: Math.max(0, gross - deduction),
      notes,
    }
  })

  const taxBeforeInsurance = lines.reduce((sum, line) => sum + line.grossTax, 0)
  const insuranceUsed = lines.reduce((sum, line) => sum + line.insuranceDeduction, 0)

  return {
    organizationId,
    periodFrom: from,
    periodTo: to,
    revenue,
    fixedInsurance: insurance.fixed,
    additionalInsurance: insurance.additional,
    totalInsurance: insurance.total,
    insuranceAllocation: allocation,
    lines,
    taxBeforeInsurance,
    insuranceUsed,
    taxAfterInsurance: Math.max(0, taxBeforeInsurance - insuranceUsed),
    remainingInsurance: Math.max(0, insurance.total - insuranceUsed),
  }
}

export function organizationInsuranceHint(revenueBase: number) {
  const insurance = calcInsurance2026(revenueBase)
  return {
    threshold: TAX_2026.insuranceAdditionalThreshold,
    additionalBase: insurance.additionalBase,
    additional: insurance.additional,
    total: insurance.total,
  }
}

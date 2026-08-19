import type { Operation, Store, TaxRegime, VatMode } from '@/types'

export const REGIME_LABELS: Record<TaxRegime, string> = {
  usn6: 'УСН «Доходы»',
  usn15: 'УСН «Доходы − расходы»',
  npd: 'НПД (самозанятый)',
  psn: 'Патент (ПСН)',
  osno: 'ОСНО',
}

export const TAX_2026 = {
  insuranceFixed: 57390,
  insuranceAdditionalThreshold: 300000,
  insuranceAdditionalRate: 0.01,
  insuranceAdditionalMax: 321818,
  usnVatExemptionThreshold: 20_000_000,
  usnVat5Upper: 272_500_000,
  usnVat7Upper: 490_500_000,
  vatGeneral: 0.22,
  vatSpecial5: 0.05,
  vatSpecial7: 0.07,
  usnDefaultIncomeRate: 0.06,
  usnDefaultProfitRate: 0.15,
  usnMinimumTaxRate: 0.01,
} as const

export interface Period {
  from: string
  to: string
  label: string
}

export interface InsuranceBreakdown {
  fixed: number
  additional: number
  total: number
  additionalBase: number
}

export interface TaxBreakdown {
  storeId: string
  storeName: string
  regime: TaxRegime
  regimeLabel: string
  revenue: number
  expenses: number
  commission: number
  logistics: number
  ads: number
  otherExpenses: number
  taxBase: number
  taxGross: number
  deduction: number
  /** Основной налог режима без НДС. Именно эта сумма используется для авансов УСН. */
  taxDue: number
  /** Общая налоговая нагрузка по модели, включая НДС. */
  totalTaxDue: number
  minTax?: number
  effectiveRate: number
  insurance: InsuranceBreakdown
  vat: number
  vatRate?: number
  vatMode?: VatMode
  notes: string[]
}

export const inPeriod = (op: Operation, p: Period) => op.date >= p.from && op.date <= p.to

export function sumOps(ops: Operation[]) {
  return ops.reduce(
    (acc, o) => ({
      revenue: acc.revenue + o.revenue,
      commission: acc.commission + o.commission,
      logistics: acc.logistics + o.logistics,
      ads: acc.ads + o.ads,
      otherExpenses: acc.otherExpenses + o.otherExpenses,
    }),
    { revenue: 0, commission: 0, logistics: 0, ads: 0, otherExpenses: 0 },
  )
}

/** Страховые взносы ИП «за себя» по правилам 2026 года. */
export function calcInsurance2026(revenue: number): InsuranceBreakdown {
  const additionalBase = Math.max(0, revenue - TAX_2026.insuranceAdditionalThreshold)
  const additional = Math.min(
    additionalBase * TAX_2026.insuranceAdditionalRate,
    TAX_2026.insuranceAdditionalMax,
  )
  return {
    fixed: TAX_2026.insuranceFixed,
    additional,
    total: TAX_2026.insuranceFixed + additional,
    additionalBase,
  }
}

function resolveVatMode(store: Store, revenue: number): VatMode {
  if (store.vatMode && store.vatMode !== 'auto') return store.vatMode
  if (revenue <= TAX_2026.usnVatExemptionThreshold) return 'exempt'
  if (revenue <= TAX_2026.usnVat5Upper) return 'vat5'
  if (revenue <= TAX_2026.usnVat7Upper) return 'vat7'
  return 'vat22'
}

/** НДС при УСН. Для 5%/7%/22% сумма реализации считается включающей НДС. */
export function calcUsnVat(store: Store, revenue: number) {
  const mode = resolveVatMode(store, revenue)
  if (store.regime !== 'usn6' && store.regime !== 'usn15') {
    return { mode: 'exempt' as VatMode, rate: 0, vat: 0 }
  }
  if (mode === 'exempt') return { mode, rate: 0, vat: 0 }
  if (mode === 'vat5') return { mode, rate: 0.05, vat: revenue * 0.05 / 1.05 }
  if (mode === 'vat7') return { mode, rate: 0.07, vat: revenue * 0.07 / 1.07 }
  return { mode: 'vat22' as VatMode, rate: 0.22, vat: revenue * 0.22 / 1.22 }
}

export function calcTax(store: Store, ops: Operation[]): TaxBreakdown {
  const s = sumOps(ops)
  const marketplaceExpenses = s.commission + s.logistics + s.ads + s.otherExpenses
  const notes: string[] = []
  const revenue = Math.max(0, s.revenue)

  const autoInsurance = calcInsurance2026(revenue)
  const insuranceTotal = store.hasEmployees
    ? Math.max(0, store.insurancePremiums)
    : store.insurancePremiums > 0
      ? store.insurancePremiums
      : autoInsurance.total
  const insurance: InsuranceBreakdown = store.hasEmployees
    ? { fixed: insuranceTotal, additional: 0, total: insuranceTotal, additionalBase: 0 }
    : { ...autoInsurance, total: insuranceTotal }

  let taxBase = revenue
  let taxGross = 0
  let deduction = 0
  let taxDue = 0
  let minTax: number | undefined
  let vat = 0
  let vatRate: number | undefined
  let vatMode: VatMode | undefined

  switch (store.regime) {
    case 'usn6': {
      const rate = (store.usnIncomeRate ?? TAX_2026.usnDefaultIncomeRate) / 100
      taxGross = revenue * rate
      const limit = store.hasEmployees ? 0.5 : 1
      deduction = Math.min(insurance.total, taxGross * limit)
      taxDue = Math.max(0, taxGross - deduction)
      const vatCalc = calcUsnVat(store, revenue)
      vat = vatCalc.vat
      vatRate = vatCalc.rate
      vatMode = vatCalc.mode
      notes.push(`УСН «Доходы»: ${store.usnIncomeRate ?? 6}%`)
      notes.push(
        store.hasEmployees
          ? 'При наличии работников налог можно уменьшить страховыми взносами максимум на 50%.'
          : 'ИП без работников может уменьшить налог на 100% страховых взносов за себя.',
      )
      break
    }
    case 'usn15': {
      const rate = (store.usnProfitRate ?? TAX_2026.usnDefaultProfitRate) / 100
      // Взносы ИП за себя учитываются в расходах по УСН «Доходы − расходы».
      taxBase = Math.max(0, revenue - marketplaceExpenses - (store.hasEmployees ? 0 : insurance.total))
      taxGross = taxBase * rate
      minTax = revenue * TAX_2026.usnMinimumTaxRate
      taxDue = Math.max(taxGross, revenue > 0 ? minTax : 0)
      const vatCalc = calcUsnVat(store, revenue)
      vat = vatCalc.vat
      vatRate = vatCalc.rate
      vatMode = vatCalc.mode
      if (taxDue === minTax && minTax > taxGross) notes.push('Применён минимальный налог 1% от доходов.')
      notes.push(`УСН «Доходы − расходы»: ${store.usnProfitRate ?? 15}%`)
      break
    }
    case 'npd': {
      const rate = (store.npdRate ?? 6) / 100
      taxGross = revenue * rate
      taxDue = taxGross
      notes.push(`Ставка НПД ${store.npdRate ?? 6}%.`)
      notes.push('Страховые взносы ИП не уменьшают НПД; для НПД действует отдельный налоговый вычет.')
      break
    }
    case 'psn': {
      const patent = Math.max(0, store.patentCost ?? 0)
      taxGross = patent
      const limit = store.hasEmployees ? 0.5 : 1
      deduction = Math.min(insurance.total, patent * limit)
      taxDue = Math.max(0, patent - deduction)
      taxBase = revenue
      notes.push('ПСН: стоимость патента можно уменьшить на страховые взносы; при наличии работников действует ограничение 50%.')
      break
    }
    case 'osno': {
      taxBase = Math.max(0, revenue - marketplaceExpenses)
      const profitTax = taxBase * 0.25
      vat = revenue * 0.22 / 1.22
      vatRate = 0.22
      taxGross = profitTax + vat
      taxDue = profitTax
      notes.push('ОСНО: в базовой модели 2026 года используется налог на прибыль 25% и НДС 22%; входной НДС пока не моделируется.')
      break
    }
  }

  if ((store.regime === 'usn6' || store.regime === 'usn15') && revenue > TAX_2026.usnVatExemptionThreshold) {
    if (vatRate === 0.05) notes.push('НДС 5%: специальная ставка без вычета входного НДС.')
    if (vatRate === 0.07) notes.push('НДС 7%: специальная ставка без вычета входного НДС.')
    if (vatRate === 0.22) notes.push('НДС 22%: возможны вычеты входного НДС при соблюдении условий НК РФ.')
  } else if (store.regime === 'usn6' || store.regime === 'usn15') {
    notes.push('При доходе до 20 млн ₽ в 2026 году действует освобождение от НДС по УСН.')
  }

  const totalTaxDue = taxDue + vat
  return {
    storeId: store.id,
    storeName: store.name,
    regime: store.regime,
    regimeLabel: REGIME_LABELS[store.regime],
    revenue,
    expenses: marketplaceExpenses,
    commission: s.commission,
    logistics: s.logistics,
    ads: s.ads,
    otherExpenses: s.otherExpenses,
    taxBase,
    taxGross,
    deduction,
    taxDue,
    totalTaxDue,
    minTax,
    effectiveRate: revenue > 0 ? (totalTaxDue / revenue) * 100 : 0,
    insurance,
    vat,
    vatRate,
    vatMode,
    notes,
  }
}

export function quarterlyAdvances(store: Store, ops: Operation[], year: number) {
  const quarters = [
    { label: '1 квартал', from: `${year}-01-01`, to: `${year}-03-31`, payBy: `28.04.${year}` },
    { label: 'Полугодие', from: `${year}-01-01`, to: `${year}-06-30`, payBy: `28.07.${year}` },
    { label: '9 месяцев', from: `${year}-01-01`, to: `${year}-09-30`, payBy: `28.10.${year}` },
    { label: 'Год', from: `${year}-01-01`, to: `${year}-12-31`, payBy: `28.04.${year + 1}` },
  ]
  let paid = 0
  return quarters.map((q) => {
    const periodOps = ops.filter((o) => o.date >= q.from && o.date <= q.to)
    const calc = calcTax(store, periodOps)
    const advance = Math.max(0, calc.taxDue - paid)
    paid += advance
    return { ...q, calc, advance }
  })
}

export const fmtMoney = (n: number) =>
  new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' ₽'

export const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

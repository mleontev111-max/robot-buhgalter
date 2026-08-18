import type { Operation, Store, TaxRegime } from '@/types'

export const REGIME_LABELS: Record<TaxRegime, string> = {
  usn6: 'УСН 6% «Доходы»',
  usn15: 'УСН 15% «Доходы − расходы»',
  npd: 'НПД (самозанятый)',
  psn: 'Патент (ПСН)',
  osno: 'ОСНО',
}

export interface Period {
  from: string // YYYY-MM-DD
  to: string
  label: string
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
  /** Налог до вычета взносов */
  taxGross: number
  /** Вычет страховых взносов */
  deduction: number
  /** Налог к уплате */
  taxDue: number
  /** Минимальный налог 1% (для УСН 15%) */
  minTax?: number
  /** Эффективная ставка, % */
  effectiveRate: number
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

export function calcTax(store: Store, ops: Operation[]): TaxBreakdown {
  const s = sumOps(ops)
  const expenses = s.commission + s.logistics + s.ads + s.otherExpenses
  const notes: string[] = []

  let taxBase = s.revenue
  let taxGross = 0
  let deduction = 0
  let taxDue = 0
  let minTax: number | undefined

  switch (store.regime) {
    case 'usn6': {
      taxGross = s.revenue * 0.06
      const limit = store.hasEmployees ? 0.5 : 1
      deduction = Math.min(store.insurancePremiums, taxGross * limit)
      taxDue = Math.max(0, taxGross - deduction)
      if (deduction > 0)
        notes.push(
          `Налог уменьшен на страховые взносы (до ${limit * 100}%${store.hasEmployees ? ', есть сотрудники' : ''})`,
        )
      break
    }
    case 'usn15': {
      taxBase = Math.max(0, s.revenue - expenses)
      taxGross = taxBase * 0.15
      minTax = s.revenue * 0.01
      taxDue = Math.max(taxGross, s.revenue > 0 ? minTax : 0)
      if (taxDue === minTax && minTax > taxGross)
        notes.push('Применён минимальный налог 1% от доходов')
      break
    }
    case 'npd': {
      const rate = (store.npdRate ?? 6) / 100
      taxGross = s.revenue * rate
      taxDue = taxGross
      notes.push(`Ставка НПД ${store.npdRate ?? 6}% (продажи через маркетплейс обычно идут по ставке 6%)`)
      break
    }
    case 'psn': {
      const patent = store.patentCost ?? 0
      taxGross = patent
      const limit = store.hasEmployees ? 0.5 : 1
      deduction = Math.min(store.insurancePremiums, patent * limit)
      taxDue = Math.max(0, patent - deduction)
      taxBase = s.revenue
      notes.push('Патент: фиксированная стоимость не зависит от выручки (лимит ПСН — 60 млн ₽/год)')
      break
    }
    case 'osno': {
      taxBase = Math.max(0, s.revenue - expenses)
      const profitTax = taxBase * 0.2
      const vat = (s.revenue * 20) / 120
      taxGross = profitTax + vat
      taxDue = taxGross
      notes.push('ОСНО упрощённо: НДС 20/120 с выручки + налог на прибыль 20% (без учёта входящего НДС)')
      break
    }
  }

  return {
    storeId: store.id,
    storeName: store.name,
    regime: store.regime,
    regimeLabel: REGIME_LABELS[store.regime],
    revenue: s.revenue,
    expenses,
    commission: s.commission,
    logistics: s.logistics,
    ads: s.ads,
    otherExpenses: s.otherExpenses,
    taxBase,
    taxGross,
    deduction,
    taxDue,
    minTax,
    effectiveRate: s.revenue > 0 ? (taxDue / s.revenue) * 100 : 0,
    notes,
  }
}

/** Сроки уплаты УСН: авансовые платежи до 28-го числа месяца после квартала */
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

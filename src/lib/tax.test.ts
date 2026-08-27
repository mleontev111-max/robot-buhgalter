import { describe, expect, it } from 'vitest'
import type { Operation, Store } from '@/types'
import {
  LATEST_KNOWN_TAX_YEAR,
  TAX_2026,
  calcInsurance2026,
  calcIpNdfl2026,
  calcTax,
  calcUsnVat,
  quarterlyAdvances,
  resolveTaxRules,
} from './tax'

const store = (overrides: Partial<Store>): Store => ({
  id: 'store-1',
  name: 'Тестовый магазин',
  regime: 'usn6',
  insurancePremiums: 0,
  hasEmployees: false,
  ...overrides,
})

const operation = (revenue: number, overrides: Partial<Operation> = {}): Operation => ({
  id: 'op-1',
  storeId: 'store-1',
  marketplace: 'ozon',
  date: '2026-06-30',
  revenue,
  commission: 0,
  logistics: 0,
  ads: 0,
  otherExpenses: 0,
  ...overrides,
})

describe('страховые взносы ИП за 2026 год', () => {
  it('начисляет фиксированную часть и 1% только сверх 300 000 ₽', () => {
    expect(calcInsurance2026(300_000)).toEqual({
      fixed: 57_390,
      additional: 0,
      total: 57_390,
      additionalBase: 0,
    })
    expect(calcInsurance2026(1_000_000)).toEqual({
      fixed: 57_390,
      additional: 7_000,
      total: 64_390,
      additionalBase: 700_000,
    })
  })

  it('ограничивает дополнительный взнос суммой 321 818 ₽', () => {
    const result = calcInsurance2026(100_000_000)
    expect(result.additional).toBe(TAX_2026.insuranceAdditionalMax)
    expect(result.total).toBe(379_208)
  })
})

describe('УСН 6%', () => {
  it('для ИП без работников уменьшает налог вплоть до нуля', () => {
    const result = calcTax(store({}), [operation(1_000_000)])
    expect(result.taxGross).toBe(60_000)
    expect(result.deduction).toBe(60_000)
    expect(result.taxDue).toBe(0)
  })

  it('при наличии работников ограничивает вычет половиной налога', () => {
    const result = calcTax(store({ hasEmployees: true, insurancePremiums: 100_000 }), [
      operation(1_000_000),
    ])
    expect(result.taxGross).toBe(60_000)
    expect(result.deduction).toBe(30_000)
    expect(result.taxDue).toBe(30_000)
  })
})

describe('ПСН', () => {
  it('использует потенциальный доход для дополнительного 1% и стоимость патента для налога', () => {
    const result = calcTax(
      store({ regime: 'psn', patentCost: 80_000, patentPotentialIncome: 1_000_000 }),
      [],
    )
    expect(result.taxBase).toBe(1_000_000)
    expect(result.insurance.additional).toBe(7_000)
    expect(result.taxGross).toBe(80_000)
    expect(result.taxDue).toBe(15_610)
  })

  it('при наличии работников уменьшает стоимость патента максимум на 50%', () => {
    const result = calcTax(
      store({ regime: 'psn', patentCost: 80_000, hasEmployees: true, insurancePremiums: 100_000 }),
      [],
    )
    expect(result.deduction).toBe(40_000)
    expect(result.taxDue).toBe(40_000)
  })
})

describe('НДС при УСН в 2026 году', () => {
  it('применяет освобождение до 20 млн ₽ и специальные ставки к сумме с НДС', () => {
    expect(calcUsnVat(store({ priorYearRevenue: 20_000_000 }), 20_000_000)).toEqual({
      mode: 'exempt',
      rate: 0,
      vat: 0,
    })
    expect(calcUsnVat(store({ priorYearRevenue: 20_000_000 }), 21_000_000)).toEqual({
      mode: 'vat5',
      rate: 0.05,
      vat: 1_000_000,
    })
    const vat7 = calcUsnVat(store({ vatMode: 'vat7' }), 10_700_000)
    const vat22 = calcUsnVat(store({ vatMode: 'vat22' }), 1_220_000)
    expect(vat7).toMatchObject({ mode: 'vat7', rate: 0.07 })
    expect(vat7.vat).toBeCloseTo(700_000)
    expect(vat22).toMatchObject({ mode: 'vat22', rate: 0.22 })
    expect(vat22.vat).toBeCloseTo(220_000)
  })
})

describe('прогрессивный НДФЛ ИП на ОСНО в 2026 году', () => {
  it.each([
    [2_400_000, 312_000],
    [5_000_000, 702_000],
    [20_000_000, 3_402_000],
    [50_000_000, 9_402_000],
    [60_000_000, 11_602_000],
  ])('рассчитывает налог для базы %i ₽', (base, expected) => {
    expect(calcIpNdfl2026(base)).toBe(expected)
  })
})

describe('налоговые параметры по годам (resolveTaxRules)', () => {
  it('для известного года возвращает точные правила без фоллбека', () => {
    const resolved = resolveTaxRules(2026)
    expect(resolved).toMatchObject({ year: 2026, requestedYear: 2026, isFallback: false })
    expect(resolved.rules).toEqual(TAX_2026)
  })

  it('для ещё не заведённого года честно падает на последний известный, а не молчит', () => {
    const resolved = resolveTaxRules(2027)
    expect(resolved.isFallback).toBe(true)
    expect(resolved.requestedYear).toBe(2027)
    expect(resolved.year).toBe(LATEST_KNOWN_TAX_YEAR)
    expect(resolved.rules).toEqual(TAX_2026)
  })

  it('calcTax для года без правил считает по последнему известному году и предупреждает об этом', () => {
    const knownYearResult = calcTax(store({}), [operation(1_000_000)], 2026)
    const fallbackYearResult = calcTax(store({}), [operation(1_000_000)], 2027)

    // Цифры совпадают с расчётом по 2026 году — правила действительно применены как приближение...
    expect(fallbackYearResult.taxDue).toBe(knownYearResult.taxDue)
    expect(fallbackYearResult.taxGross).toBe(knownYearResult.taxGross)
    // ...но в отличие от 2026-го, пользователь явно предупреждён, что это не подтверждённый расчёт.
    expect(
      fallbackYearResult.notes.some((n) => n.includes('2027') && n.includes('ещё не добавлены')),
    ).toBe(true)
    expect(knownYearResult.notes.some((n) => n.includes('ещё не добавлены'))).toBe(false)
  })

  it('quarterlyAdvances передаёт выбранный год в расчёт, а не всегда считает по 2026-му', () => {
    const ops = [operation(1_000_000, { date: '2027-02-01' })]
    const advances = quarterlyAdvances(store({}), ops, 2027)
    const q1 = advances[0]
    expect(q1.calc.notes.some((n) => n.includes('2027'))).toBe(true)
  })
})

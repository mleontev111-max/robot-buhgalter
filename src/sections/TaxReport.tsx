import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { AppState } from '@/types'
import { calcInsurance2026, calcTax, fmtMoney, quarterlyAdvances } from '@/lib/tax'

export default function TaxReport({ state }: { state: AppState }) {
  const years = useMemo(() => {
    const ys = new Set(state.operations.map((o) => o.date.slice(0, 4)))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [state.operations])
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()))
  const yearOps = state.operations.filter((o) => o.date.startsWith(year))
  const is2026 = year === '2026'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Налоги</h1>
          <p className="mt-1 text-sm text-stone-500">Расчёт по операциям маркетплейсов</p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y} год</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <Alert className="bg-white">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {is2026
            ? 'Расчёт актуализирован под правила РФ на 2026 год: страховые взносы ИП, уменьшение УСН и НДС при УСН. Региональные льготы, входной НДС, торговый сбор и отдельные переходные ситуации пока не моделируются.'
            : 'Расчёт ориентировочный. Для прошлых лет часть параметров использует текущую модель и требует проверки перед уплатой.'}
        </AlertDescription>
      </Alert>

      {state.stores.map((store) => {
        const ops = yearOps.filter((o) => o.storeId === store.id)
        const calc = calcTax(store, ops)
        const advances = quarterlyAdvances(store, yearOps, Number(year))
        const insurance = is2026 && !store.hasEmployees ? calcInsurance2026(calc.revenue) : null
        return (
          <Card key={store.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{store.name}</CardTitle>
                <span className="text-sm text-stone-500">{calc.regimeLabel}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Доходы" value={fmtMoney(calc.revenue)} />
                <Stat label="Расходы маркетплейса" value={fmtMoney(calc.expenses)} />
                <Stat label="База основного налога" value={fmtMoney(calc.taxBase)} />
                <Stat label="Налог режима" value={fmtMoney(calc.taxDue)} />
                <Stat label="Всего с НДС" value={fmtMoney(calc.totalTaxDue)} accent />
              </div>

              {calc.insurance.total > 0 && (store.regime === 'usn6' || store.regime === 'usn15' || store.regime === 'psn') && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm">
                  <div className="font-medium text-emerald-900">Страховые взносы ИП за себя</div>
                  <div className="mt-1 text-stone-700">
                    Фиксированные: {fmtMoney(calc.insurance.fixed)} · 1% сверх 300 000 ₽: {fmtMoney(calc.insurance.additional)} · всего: <b>{fmtMoney(calc.insurance.total)}</b>
                  </div>
                  {insurance && <div className="mt-1 text-xs text-stone-500">Автоматический расчёт для 2026 года. Максимум дополнительного взноса — 321 818 ₽.</div>}
                </div>
              )}

              {calc.deduction > 0 && (
                <div className="text-sm text-stone-600">
                  Уменьшение налога страховыми взносами: <b>{fmtMoney(calc.deduction)}</b>
                </div>
              )}

              {(calc.vatRate ?? 0) > 0 && (
                <div className="rounded-xl border border-stone-200 p-4 text-sm">
                  <div className="font-medium">НДС: {Math.round((calc.vatRate ?? 0) * 100)}%</div>
                  <div className="mt-1 text-stone-600">Ориентировочно к уплате: {fmtMoney(calc.vat)} · режим: {calc.vatMode === 'vat22' ? '22% с правом на вычеты' : 'специальная ставка без вычета входного НДС'}</div>
                </div>
              )}

              {calc.notes.map((n) => <p key={n} className="text-xs text-stone-500">• {n}</p>)}

              {(store.regime === 'usn6' || store.regime === 'usn15') && (
                <div>
                  <div className="mb-2 text-sm font-medium">Авансовые платежи {year}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Период</TableHead>
                        <TableHead className="text-right">Доходы</TableHead>
                        <TableHead className="text-right">Расходы</TableHead>
                        <TableHead className="text-right">Налог нарастающим</TableHead>
                        <TableHead className="text-right">К доплате</TableHead>
                        <TableHead className="text-right">Срок</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advances.map((a) => (
                        <TableRow key={a.label}>
                          <TableCell>{a.label}</TableCell>
                          <TableCell className="text-right">{fmtMoney(a.calc.revenue)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(a.calc.expenses)}</TableCell>
                          <TableCell className="text-right">{fmtMoney(a.calc.taxDue)}</TableCell>
                          <TableCell className="text-right font-semibold text-red-700">{fmtMoney(a.advance)}</TableCell>
                          <TableCell className="text-right text-stone-500">{a.payBy}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
      {state.stores.length === 0 && <p className="text-sm text-stone-500">Добавьте магазин в разделе «Настройки».</p>}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-stone-200 p-4">
      <div className="text-xs text-stone-500">{label}</div>
      <div className={`mt-1 text-lg font-bold ${accent ? 'text-red-700' : ''}`}>{value}</div>
    </div>
  )
}

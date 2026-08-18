import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Info } from 'lucide-react'
import type { AppState } from '@/types'
import { calcTax, fmtMoney, quarterlyAdvances } from '@/lib/tax'

export default function TaxReport({ state }: { state: AppState }) {
  const years = useMemo(() => {
    const ys = new Set(state.operations.map((o) => o.date.slice(0, 4)))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [state.operations])
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()))

  const yearOps = state.operations.filter((o) => o.date.startsWith(year))

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Налоги</h1>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>{y} год</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Alert className="bg-white">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Расчёт ориентировочный и не заменяет бухгалтера: не учитывает региональные льготы,
          торговый сбор, возвраты сверх отчётов и изменения законодательства. Проверяйте итоги
          перед уплатой.
        </AlertDescription>
      </Alert>

      {state.stores.map((store) => {
        const ops = yearOps.filter((o) => o.storeId === store.id)
        const calc = calcTax(store, ops)
        const advances = quarterlyAdvances(store, yearOps, Number(year))
        return (
          <Card key={store.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{store.name}</CardTitle>
                <span className="text-sm text-stone-500">{calc.regimeLabel}</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Доходы" value={fmtMoney(calc.revenue)} />
                <Stat label="Расходы (комиссии, логистика, реклама)" value={fmtMoney(calc.expenses)} />
                <Stat
                  label="Налоговая база"
                  value={fmtMoney(calc.regime === 'usn6' || calc.regime === 'npd' ? calc.revenue : calc.taxBase)}
                />
                <Stat label="Налог к уплате" value={fmtMoney(calc.taxDue)} accent />
              </div>

              {calc.deduction > 0 && (
                <div className="text-sm text-stone-600">
                  Вычет страховых взносов: {fmtMoney(calc.deduction)}
                </div>
              )}

              {calc.notes.map((n) => (
                <p key={n} className="text-xs text-stone-500">• {n}</p>
              ))}

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
                          <TableCell className="text-right font-semibold text-red-700">
                            {fmtMoney(a.advance)}
                          </TableCell>
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
      {state.stores.length === 0 && (
        <p className="text-sm text-stone-500">Добавьте магазин в разделе «Настройки».</p>
      )}
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

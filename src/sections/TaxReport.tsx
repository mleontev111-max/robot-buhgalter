import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { AppState } from '@/types'
import { calcInsurance2026, calcTax, fmtMoney, quarterlyAdvances } from '@/lib/tax'
import { calcOrganizationTax, type InsuranceAllocation } from '@/lib/organizationTax'
import {
  checkOrganizationCompleteness,
  checkStoreCompleteness,
  type CompletenessLevel,
} from '@/lib/dataCompleteness'

export default function TaxReport({ state }: { state: AppState }) {
  const years = useMemo(() => {
    const ys = new Set(state.operations.map((o) => o.date.slice(0, 4)))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort().reverse()
  }, [state.operations])
  const [year, setYear] = useState(years[0] ?? String(new Date().getFullYear()))
  const [allocation, setAllocation] = useState<InsuranceAllocation>('proportional')
  const yearOps = state.operations.filter((o) => o.date.startsWith(year))
  const is2026 = year === '2026'
  const organizations = state.organizations ?? []
  const periodFrom = `${year}-01-01`
  const today = new Date().toISOString().slice(0, 10)
  const periodTo = year === String(new Date().getFullYear()) ? today : `${year}-12-31`

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Налоги</h1>
          <p className="mt-1 text-sm text-stone-500">
            Расчёт по ИП, налоговым режимам и каналам продаж
          </p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-32 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={y}>
                {y} год
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Alert className="bg-white">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          {is2026
            ? 'Робот проверяет полноту данных перед тем, как показывать расчёт как окончательный. Если отсутствует начало года, источник продаж или параметры патента, суммы маркируются как предварительные.'
            : 'Расчёт ориентировочный. Для прошлых лет часть параметров использует текущую модель и требует проверки перед уплатой.'}
        </AlertDescription>
      </Alert>

      {is2026 &&
        organizations.map((organization) => {
          const summary = calcOrganizationTax(
            organization.id,
            state.stores,
            state.operations,
            periodFrom,
            periodTo,
            allocation,
          )
          if (!summary.lines.length) return null
          const completeness = checkOrganizationCompleteness(
            state,
            organization.id,
            periodFrom,
            periodTo,
          )
          return (
            <Card
              key={organization.id}
              className={
                completeness.finalCalculationAllowed
                  ? 'border-emerald-200 bg-emerald-50/30'
                  : 'border-amber-200 bg-amber-50/30'
              }
            >
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{organization.name}</CardTitle>
                      <DataStatus level={completeness.level} />
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Налоговый контур за период {periodFrom}—{periodTo}
                    </p>
                  </div>
                  <Select
                    value={allocation}
                    onValueChange={(value) => setAllocation(value as InsuranceAllocation)}
                  >
                    <SelectTrigger className="w-64 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proportional">
                        Распределять пропорционально доходам
                      </SelectItem>
                      <SelectItem value="usn">Направить вычет на УСН</SelectItem>
                      <SelectItem value="psn">Направить вычет на ПСН</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!completeness.finalCalculationAllowed && (
                  <Alert className="border-amber-300 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    <AlertDescription className="text-xs text-amber-950">
                      <b>Окончательный налог не подтверждён.</b> В расчёте есть неполные исходные
                      данные. Суммы ниже можно использовать только как предварительную оценку.
                      <div className="mt-2 space-y-1">
                        {completeness.issues.slice(0, 8).map((issue) => (
                          <div key={issue}>• {issue}</div>
                        ))}
                        {completeness.issues.length > 8 && (
                          <div>• И ещё {completeness.issues.length - 8} замечаний</div>
                        )}
                      </div>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Stat label="Доход ИП" value={fmtMoney(summary.revenue)} />
                  <Stat label="Фиксированные взносы" value={fmtMoney(summary.fixedInsurance)} />
                  <Stat label="Доп. 1%" value={fmtMoney(summary.additionalInsurance)} />
                  <Stat label="Взносы всего" value={fmtMoney(summary.totalInsurance)} />
                  <Stat
                    label={
                      completeness.finalCalculationAllowed
                        ? 'Использовано для вычета'
                        : 'Вычет — предварительно'
                    }
                    value={fmtMoney(summary.insuranceUsed)}
                    accent
                  />
                </div>

                <div
                  className={`rounded-xl border bg-white p-4 text-sm ${completeness.finalCalculationAllowed ? 'border-emerald-200' : 'border-amber-200'}`}
                >
                  <div
                    className={
                      completeness.finalCalculationAllowed
                        ? 'font-medium text-emerald-900'
                        : 'font-medium text-amber-900'
                    }
                  >
                    {completeness.finalCalculationAllowed
                      ? 'Итог по ИП'
                      : 'Предварительный итог по ИП'}
                  </div>
                  <div className="mt-1 text-stone-700">
                    Налог до вычета: <b>{fmtMoney(summary.taxBeforeInsurance)}</b> · после вычета:{' '}
                    <b>{fmtMoney(summary.taxAfterInsurance)}</b>
                    {summary.remainingInsurance > 0 && (
                      <>
                        {' '}
                        · не использовано: <b>{fmtMoney(summary.remainingInsurance)}</b>
                      </>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 bg-white p-4">
                  <div className="mb-2 text-sm font-medium">Полнота источников</div>
                  <div className="grid gap-2 md:grid-cols-2">
                    {completeness.sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-lg border border-stone-100 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{source.label}</span>
                          <DataStatus level={source.level} compact />
                        </div>
                        <div className="mt-1 text-stone-500">
                          {source.message} · операций: {source.operations}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Направление</TableHead>
                      <TableHead>Режим</TableHead>
                      <TableHead className="text-right">Доход</TableHead>
                      <TableHead className="text-right">Налог</TableHead>
                      <TableHead className="text-right">Вычет взносов</TableHead>
                      <TableHead className="text-right">После вычета</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.lines.map((line) => (
                      <TableRow key={line.storeId}>
                        <TableCell>{line.storeName}</TableCell>
                        <TableCell>
                          {line.regime === 'usn6'
                            ? 'УСН 6%'
                            : line.regime === 'psn'
                              ? 'ПСН'
                              : line.regime}
                        </TableCell>
                        <TableCell className="text-right">{fmtMoney(line.revenue)}</TableCell>
                        <TableCell className="text-right">{fmtMoney(line.grossTax)}</TableCell>
                        <TableCell className="text-right text-emerald-700">
                          {fmtMoney(line.insuranceDeduction)}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmtMoney(line.taxAfterInsurance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })}

      {state.stores.map((store) => {
        const ops = yearOps.filter((o) => o.storeId === store.id)
        const calc = calcTax(store, ops)
        const advances = quarterlyAdvances(store, yearOps, Number(year))
        const insurance = is2026 && !store.hasEmployees ? calcInsurance2026(calc.revenue) : null
        const completeness = checkStoreCompleteness(state, store, periodFrom, periodTo)
        return (
          <Card key={store.id} className="bg-white">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>{store.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-stone-500">{calc.regimeLabel}</span>
                  <DataStatus level={completeness.level} compact />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <Stat label="Доходы" value={fmtMoney(calc.revenue)} />
                <Stat label="Расходы маркетплейса" value={fmtMoney(calc.expenses)} />
                <Stat label="База основного налога" value={fmtMoney(calc.taxBase)} />
                <Stat
                  label={
                    completeness.finalCalculationAllowed ? 'Налог режима' : 'Налог — предварительно'
                  }
                  value={fmtMoney(calc.taxDue)}
                />
                <Stat
                  label={
                    completeness.finalCalculationAllowed ? 'Всего с НДС' : 'Всего — предварительно'
                  }
                  value={fmtMoney(calc.totalTaxDue)}
                  accent
                />
              </div>

              {calc.insurance.total > 0 &&
                (store.regime === 'usn6' || store.regime === 'usn15' || store.regime === 'psn') && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-sm">
                    <div className="font-medium">Страховые взносы</div>
                    <div className="mt-1 text-stone-700">
                      На уровне точки: {fmtMoney(calc.insurance.total)}. Итоговый вычет ИП
                      показывается выше без дублирования фиксированной части.
                    </div>
                    {insurance && (
                      <div className="mt-1 text-xs text-stone-500">
                        Для 2026 года фиксированная часть — 57 390 ₽; дополнительный взнос ограничен
                        321 818 ₽.
                      </div>
                    )}
                  </div>
                )}

              {(calc.vatRate ?? 0) > 0 && (
                <div className="rounded-xl border border-stone-200 p-4 text-sm">
                  <div className="font-medium">НДС: {Math.round((calc.vatRate ?? 0) * 100)}%</div>
                  <div className="mt-1 text-stone-600">
                    Ориентировочно к уплате: {fmtMoney(calc.vat)} · режим:{' '}
                    {calc.vatMode === 'vat22'
                      ? '22% с правом на вычеты'
                      : 'специальная ставка без вычета входного НДС'}
                  </div>
                </div>
              )}

              {calc.notes.map((n) => (
                <p key={n} className="text-xs text-stone-500">
                  • {n}
                </p>
              ))}

              {(store.regime === 'usn6' || store.regime === 'usn15') && (
                <div>
                  <div className="mb-2 text-sm font-medium">
                    Авансовые платежи {year}{' '}
                    {completeness.finalCalculationAllowed ? '' : '— предварительно'}
                  </div>
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
                          <TableCell
                            className={`text-right font-semibold ${completeness.finalCalculationAllowed ? 'text-red-700' : 'text-amber-700'}`}
                          >
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
        <p className="text-sm text-stone-500">Добавьте ИП в разделе «Организации».</p>
      )}
    </div>
  )
}

function DataStatus({ level, compact = false }: { level: CompletenessLevel; compact?: boolean }) {
  if (level === 'complete')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-medium text-emerald-800">
        <CheckCircle2 className="h-3 w-3" />
        {compact ? 'Полно' : 'Данные полные'}
      </span>
    )
  if (level === 'partial')
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-800">
        <AlertTriangle className="h-3 w-3" />
        {compact ? 'Частично' : 'Данные частичные'}
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-[11px] font-medium text-red-800">
      <AlertTriangle className="h-3 w-3" />
      {compact ? 'Не хватает' : 'Данных не хватает'}
    </span>
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

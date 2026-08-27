import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  TrendingUp,
  Wallet,
  ReceiptText,
  Percent,
  ChevronLeft,
  ChevronRight,
  CalendarClock,
  CheckCircle2,
} from 'lucide-react'
import type { AppState, TaxPaymentKind } from '@/types'
import { calcTax, fmtMoney, sumOps, type Period } from '@/lib/tax'
import {
  buildTaxCalendar,
  calendarSummary,
  formatObligationAmount,
  obligationKindLabel,
} from '@/lib/taxCalendar'

type Mode = 'month' | 'quarter' | 'year'
const pad = (n: number) => String(n).padStart(2, '0')
function periodFor(mode: Mode, a: Date): Period {
  const y = a.getFullYear(),
    m = a.getMonth()
  if (mode === 'year') return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} год` }
  if (mode === 'quarter') {
    const q = Math.floor(m / 3)
    return {
      from: `${y}-${pad(q * 3 + 1)}-01`,
      to: new Date(y, q * 3 + 3, 0).toISOString().slice(0, 10),
      label: `${q + 1} квартал ${y}`,
    }
  }
  return {
    from: `${y}-${pad(m + 1)}-01`,
    to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    label: a.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
  }
}
function shift(mode: Mode, a: Date, d: -1 | 1) {
  return new Date(
    a.getFullYear(),
    a.getMonth() + (mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1) * d,
    1,
  )
}
const statusClass = (s: string) =>
  s === 'paid'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
    : s === 'overdue'
      ? 'border-red-200 bg-red-50 text-red-900'
      : s === 'soon'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : s === 'upcoming'
          ? 'border-blue-200 bg-blue-50 text-blue-900'
          : 'border-stone-200 bg-white text-stone-700'
const kindFor = (k: string): TaxPaymentKind =>
  k === 'patent' ? 'patent' : k === 'insurance' ? 'insurance_fixed' : 'usn'

export default function Dashboard({
  state,
  setState,
}: {
  state: AppState
  setState: (u: (p: AppState) => AppState) => void
}) {
  const [mode, setMode] = useState<Mode>('quarter'),
    [anchor, setAnchor] = useState(() => new Date()),
    [storeFilter, setStoreFilter] = useState('all')
  const period = useMemo(() => periodFor(mode, anchor), [mode, anchor])
  const ops = useMemo(
    () =>
      state.operations.filter(
        (o) =>
          o.date >= period.from &&
          o.date <= period.to &&
          (storeFilter === 'all' || o.storeId === storeFilter),
      ),
    [state.operations, period, storeFilter],
  )
  const totals = sumOps(ops),
    expenses = totals.commission + totals.logistics + totals.ads + totals.otherExpenses
  const taxTotal = state.stores
    .filter((s) => storeFilter === 'all' || s.id === storeFilter)
    .reduce(
      (a, s) =>
        a +
        calcTax(
          s,
          ops.filter((o) => o.storeId === s.id),
        ).taxDue,
      0,
    )
  const calendar = useMemo(() => buildTaxCalendar(state, 2026), [state]),
    info = calendarSummary(calendar),
    visible = calendar.filter((i) => i.status !== 'future').slice(0, 10)
  const markPaid = (id: string) => {
    const item = calendar.find((i) => i.id === id)
    if (!item?.amount) return
    const amount = item.balance ?? item.amount
    if (amount <= 0) return
    setState((p) => ({
      ...p,
      taxPayments: [
        ...(p.taxPayments ?? []),
        {
          id: `pay-${Date.now()}`,
          organizationId: item.organizationId,
          kind: kindFor(item.kind),
          amount,
          paidAt: new Date().toISOString().slice(0, 10),
          obligationId: item.id,
          note: `Оплата: ${item.title}`,
          source: 'manual',
        },
      ],
    }))
  }
  const cards = [
    ['Выручка', fmtMoney(totals.revenue), TrendingUp, 'text-emerald-700'],
    ['Расходы маркетплейсов', fmtMoney(expenses), Wallet, 'text-amber-700'],
    ['Налог к уплате', fmtMoney(taxTotal), ReceiptText, 'text-red-700'],
    [
      'Эффективная нагрузка',
      totals.revenue ? ((taxTotal / totals.revenue) * 100).toFixed(1) + '%' : '—',
      Percent,
      'text-stone-700',
    ],
  ] as const
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-52 bg-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все направления</SelectItem>
            {state.stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-2">
        <div className="flex overflow-hidden rounded-lg border">
          {(['month', 'quarter', 'year'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-4 py-1.5 text-sm font-medium ${mode === m ? 'bg-emerald-700 text-white' : 'hover:bg-stone-100'}`}
            >
              {m === 'month' ? 'Месяц' : m === 'quarter' ? 'Квартал' : 'Год'}
            </button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(shift(mode, anchor, -1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-40 text-center text-sm font-semibold capitalize">
          {period.label}
        </span>
        <Button size="sm" variant="ghost" onClick={() => setAnchor(shift(mode, anchor, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>
          Текущий период
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([t, v, I, c]) => (
          <Card key={t} className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm text-stone-500">{t}</CardTitle>
              <I className={`h-4 w-4 ${c}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c}`}>{v}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="bg-white">
        <CardHeader>
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarClock className="h-4 w-4 text-emerald-700" />
                Налоговый календарь и оплаты
              </CardTitle>
              <p className="mt-1 text-xs text-stone-500">
                Отмечайте фактические платежи. Позже заменим ручной ввод автоматической сверкой
                ЕНС/банка.
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-800">
                Оплачено: {info.paid}
              </span>
              {info.overdue > 0 && (
                <span className="rounded-full bg-red-100 px-2.5 py-1 text-red-800">
                  Просрочено: {info.overdue}
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visible.map((item) => (
            <div
              key={item.id}
              className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${statusClass(item.status)}`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase opacity-70">
                    {obligationKindLabel[item.kind]}
                  </span>
                  <span className="font-semibold">{item.title}</span>
                  {item.status === 'paid' && <CheckCircle2 className="h-4 w-4" />}
                </div>
                <div className="mt-1 text-xs opacity-75">{item.organizationName}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-semibold">
                    до {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('ru-RU')}
                  </div>
                  <div className="text-sm">
                    {item.status === 'paid'
                      ? `Оплачено ${formatObligationAmount(item.paidAmount)}`
                      : item.balance != null
                        ? `Остаток ${formatObligationAmount(item.balance)}`
                        : formatObligationAmount(item.amount)}
                  </div>
                </div>
                {item.amount != null && item.status !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => markPaid(item.id)}>
                    Отметить оплачено
                  </Button>
                )}
              </div>
            </div>
          ))}
          {info.overdueBalance > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
              Неотмеченный остаток по просроченным обязательствам:{' '}
              <b>{fmtMoney(info.overdueBalance)}</b>. Это не подтвержденная задолженность ФНС, пока
              нет сверки с ЕНС.
            </div>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">Финансовый результат периода</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Выручка</span>
              <b>{fmtMoney(totals.revenue)}</b>
            </div>
            <div className="flex justify-between">
              <span>Расходы маркетплейсов</span>
              <b>{fmtMoney(expenses)}</b>
            </div>
            <div className="flex justify-between">
              <span>Расчетный налог</span>
              <b>{fmtMoney(taxTotal)}</b>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">Направления</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.stores.map((s) => {
              const c = calcTax(
                s,
                ops.filter((o) => o.storeId === s.id),
              )
              return (
                <div key={s.id} className="rounded-xl border p-3">
                  <div className="font-semibold">{s.name}</div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span>{c.regimeLabel}</span>
                    <b>{fmtMoney(c.taxDue)}</b>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

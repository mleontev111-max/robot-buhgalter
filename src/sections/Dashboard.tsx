import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { TrendingUp, Wallet, ReceiptText, Percent, ChevronLeft, ChevronRight, CalendarClock, AlertTriangle } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { AppState } from '@/types'
import { calcTax, fmtMoney, sumOps, type Period } from '@/lib/tax'
import { MARKETPLACES } from '@/lib/marketplaces'
import { buildTaxCalendar, calendarSummary, formatObligationAmount, obligationKindLabel } from '@/lib/taxCalendar'

type Mode = 'month' | 'quarter' | 'year'

const pad = (n: number) => String(n).padStart(2, '0')

function periodFor(mode: Mode, anchor: Date): Period {
  const y = anchor.getFullYear()
  const m = anchor.getMonth()
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
    label: anchor.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
  }
}

function shift(mode: Mode, anchor: Date, dir: -1 | 1): Date {
  const d = new Date(anchor)
  const step = mode === 'year' ? 12 : mode === 'quarter' ? 3 : 1
  return new Date(d.getFullYear(), d.getMonth() + step * dir, 1)
}

const statusClass = (status: string) => {
  if (status === 'overdue') return 'border-red-200 bg-red-50 text-red-900'
  if (status === 'soon') return 'border-amber-200 bg-amber-50 text-amber-900'
  if (status === 'upcoming') return 'border-blue-200 bg-blue-50 text-blue-900'
  return 'border-stone-200 bg-white text-stone-700'
}

export default function Dashboard({ state }: { state: AppState }) {
  const [mode, setMode] = useState<Mode>('quarter')
  const [anchor, setAnchor] = useState(() => new Date())
  const [storeFilter, setStoreFilter] = useState('all')
  const period = useMemo(() => periodFor(mode, anchor), [mode, anchor])

  const ops = useMemo(
    () => state.operations.filter((o) => o.date >= period.from && o.date <= period.to && (storeFilter === 'all' || o.storeId === storeFilter)),
    [state.operations, period, storeFilter],
  )

  const totals = sumOps(ops)
  const expenses = totals.commission + totals.logistics + totals.ads + totals.otherExpenses
  const taxTotal = state.stores
    .filter((s) => storeFilter === 'all' || s.id === storeFilter)
    .reduce((acc, s) => acc + calcTax(s, ops.filter((o) => o.storeId === s.id)).taxDue, 0)

  const byMp = MARKETPLACES.map((mp) => ({
    name: mp.name,
    color: mp.color,
    Выручка: Math.round(ops.filter((o) => o.marketplace === mp.id).reduce((a, o) => a + o.revenue, 0)),
    Расходы: Math.round(ops.filter((o) => o.marketplace === mp.id).reduce((a, o) => a + o.commission + o.logistics + o.ads + o.otherExpenses, 0)),
  }))

  const cards = [
    { title: 'Выручка', value: fmtMoney(totals.revenue), icon: TrendingUp, tone: 'text-emerald-700' },
    { title: 'Расходы маркетплейсов', value: fmtMoney(expenses), icon: Wallet, tone: 'text-amber-700' },
    { title: 'Налог к уплате', value: fmtMoney(taxTotal), icon: ReceiptText, tone: 'text-red-700' },
    { title: 'Эффективная нагрузка', value: totals.revenue > 0 ? ((taxTotal / totals.revenue) * 100).toFixed(1) + '%' : '—', icon: Percent, tone: 'text-stone-700' },
  ]

  const calendar = useMemo(() => buildTaxCalendar(state, 2026), [state])
  const calendarInfo = calendarSummary(calendar)
  const visibleCalendar = calendar.filter((item) => item.status !== 'future').slice(0, 8)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Дашборд</h1>
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-52 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все направления</SelectItem>
            {state.stores.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 bg-white p-2">
        <div className="flex overflow-hidden rounded-lg border border-stone-200">
          {(['month', 'quarter', 'year'] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`px-4 py-1.5 text-sm font-medium transition-colors ${mode === m ? 'bg-emerald-700 text-white' : 'text-stone-600 hover:bg-stone-100'}`}>
              {m === 'month' ? 'Месяц' : m === 'quarter' ? 'Квартал' : 'Год'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setAnchor(shift(mode, anchor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
          <span className="min-w-40 text-center text-sm font-semibold capitalize">{period.label}</span>
          <Button size="sm" variant="ghost" onClick={() => setAnchor(shift(mode, anchor, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>Текущий период</Button>
        {mode === 'quarter' && (
          <div className="ml-auto flex gap-1">
            {[0, 1, 2, 3].map((q) => (
              <button key={q} onClick={() => setAnchor(new Date(anchor.getFullYear(), q * 3, 1))} className={`rounded-md px-2.5 py-1 text-xs font-medium ${Math.floor(anchor.getMonth() / 3) === q ? 'bg-emerald-100 text-emerald-800' : 'text-stone-500 hover:bg-stone-100'}`}>Q{q + 1}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2"><CardTitle className="text-sm font-medium text-stone-500">{c.title}</CardTitle><c.icon className={`h-4 w-4 ${c.tone}`} /></CardHeader>
            <CardContent><div className={`text-2xl font-bold ${c.tone}`}>{c.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-white">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-base"><CalendarClock className="h-4 w-4 text-emerald-700" /> Налоговый календарь</CardTitle>
              <p className="mt-1 text-xs text-stone-500">Сроки по УСН, ПСН и страховым взносам. Суммы УСН предварительные до полной синхронизации.</p>
            </div>
            <div className="flex gap-2 text-xs">
              {calendarInfo.overdue > 0 && <span className="rounded-full bg-red-100 px-2.5 py-1 font-medium text-red-800">Просрочено: {calendarInfo.overdue}</span>}
              {calendarInfo.soon > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-800">До 14 дней: {calendarInfo.soon}</span>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {visibleCalendar.map((item) => (
            <div key={item.id} className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 ${statusClass(item.status)}`}>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide opacity-70">{obligationKindLabel[item.kind]}</span>
                  <span className="font-semibold">{item.title}</span>
                </div>
                <div className="mt-1 text-xs opacity-75">{item.organizationName}{item.note ? ` · ${item.note}` : ''}</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">до {new Date(`${item.dueDate}T00:00:00`).toLocaleDateString('ru-RU')}</div>
                <div className="text-sm">{formatObligationAmount(item.amount)}</div>
              </div>
            </div>
          ))}
          {!visibleCalendar.length && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">На ближайшие 60 дней обязательств не найдено.</div>}
          {calendarInfo.overdue > 0 && <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-900"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Статус «просрочено» означает, что срок уже прошёл по календарю. Робот пока не знает, был ли платёж фактически выполнен — это добавим после подключения ЕНС/банка.</div>}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-white">
          <CardHeader><CardTitle className="text-base">Выручка и расходы по маркетплейсам</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMp}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} tickFormatter={(v: number) => `${Math.round(v / 1000)}к`} />
                <Tooltip formatter={(v) => fmtMoney(Number(v))} />
                <Bar dataKey="Выручка" fill="#047857" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Расходы" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="bg-white">
          <CardHeader><CardTitle className="text-base">Направления</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {state.stores.map((s) => {
              const calc = calcTax(s, ops.filter((o) => o.storeId === s.id))
              return (
                <div key={s.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between"><div className="font-semibold">{s.name}</div><div className="text-xs text-stone-500">{calc.regimeLabel}</div></div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div><div className="text-xs text-stone-500">Выручка</div><div className="font-medium">{fmtMoney(calc.revenue)}</div></div>
                    <div><div className="text-xs text-stone-500">Расходы</div><div className="font-medium">{fmtMoney(calc.expenses)}</div></div>
                    <div><div className="text-xs text-stone-500">Налог</div><div className="font-semibold text-red-700">{fmtMoney(calc.taxDue)}</div></div>
                  </div>
                </div>
              )
            })}
            {state.stores.length === 0 && <p className="text-sm text-stone-500">Направления не добавлены — зайдите в «Настройки».</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

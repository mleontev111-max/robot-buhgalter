import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Wallet, ReceiptText, Percent } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import type { AppState } from '@/types'
import { calcTax, fmtMoney, sumOps, type Period } from '@/lib/tax'
import { MARKETPLACES } from '@/lib/marketplaces'

function currentPeriod(kind: string): Period {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  if (kind === 'quarter') {
    const q = Math.floor(m / 3) * 3
    return {
      from: `${y}-${String(q + 1).padStart(2, '0')}-01`,
      to: new Date(y, q + 3, 0).toISOString().slice(0, 10),
      label: `${Math.floor(m / 3) + 1} квартал ${y}`,
    }
  }
  if (kind === 'year')
    return { from: `${y}-01-01`, to: `${y}-12-31`, label: `${y} год` }
  return {
    from: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    to: new Date(y, m + 1, 0).toISOString().slice(0, 10),
    label: now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }),
  }
}

export default function Dashboard({ state }: { state: AppState }) {
  const [periodKind, setPeriodKind] = useState('month')
  const [storeFilter, setStoreFilter] = useState('all')
  const period = useMemo(() => currentPeriod(periodKind), [periodKind])

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

  const totals = sumOps(ops)
  const expenses = totals.commission + totals.logistics + totals.ads + totals.otherExpenses
  const taxTotal = state.stores
    .filter((s) => storeFilter === 'all' || s.id === storeFilter)
    .reduce((acc, s) => acc + calcTax(s, ops.filter((o) => o.storeId === s.id)).taxDue, 0)

  const byMp = MARKETPLACES.map((mp) => ({
    name: mp.name,
    color: mp.color,
    Выручка: Math.round(ops.filter((o) => o.marketplace === mp.id).reduce((a, o) => a + o.revenue, 0)),
    Расходы: Math.round(
      ops
        .filter((o) => o.marketplace === mp.id)
        .reduce((a, o) => a + o.commission + o.logistics + o.ads + o.otherExpenses, 0),
    ),
  }))

  const cards = [
    { title: 'Выручка', value: fmtMoney(totals.revenue), icon: TrendingUp, tone: 'text-emerald-700' },
    { title: 'Расходы маркетплейсов', value: fmtMoney(expenses), icon: Wallet, tone: 'text-amber-700' },
    { title: 'Налог к уплате', value: fmtMoney(taxTotal), icon: ReceiptText, tone: 'text-red-700' },
    {
      title: 'Эффективная нагрузка',
      value: totals.revenue > 0 ? ((taxTotal / totals.revenue) * 100).toFixed(1) + '%' : '—',
      icon: Percent,
      tone: 'text-stone-700',
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Дашборд</h1>
          <p className="text-sm capitalize text-stone-500">{period.label}</p>
        </div>
        <div className="flex gap-2">
          <Select value={storeFilter} onValueChange={setStoreFilter}>
            <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Оба магазина</SelectItem>
              {state.stores.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={periodKind} onValueChange={setPeriodKind}>
            <SelectTrigger className="w-36 bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="month">Месяц</SelectItem>
              <SelectItem value="quarter">Квартал</SelectItem>
              <SelectItem value="year">Год</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title} className="bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-stone-500">{c.title}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.tone}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${c.tone}`}>{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="bg-white">
          <CardHeader>
            <CardTitle className="text-base">Выручка и расходы по маркетплейсам</CardTitle>
          </CardHeader>
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
          <CardHeader>
            <CardTitle className="text-base">Магазины</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {state.stores.map((s) => {
              const calc = calcTax(s, ops.filter((o) => o.storeId === s.id))
              return (
                <div key={s.id} className="rounded-xl border border-stone-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-stone-500">{calc.regimeLabel}</div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-stone-500">Выручка</div>
                      <div className="font-medium">{fmtMoney(calc.revenue)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500">Расходы</div>
                      <div className="font-medium">{fmtMoney(calc.expenses)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-stone-500">Налог</div>
                      <div className="font-semibold text-red-700">{fmtMoney(calc.taxDue)}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {state.stores.length === 0 && (
              <p className="text-sm text-stone-500">
                Магазины не добавлены — зайдите в «Настройки».
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

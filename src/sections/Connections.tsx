import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { KeyRound, Loader2, Plus, RefreshCw, ServerOff, ShieldCheck, Trash2 } from 'lucide-react'
import type { ApiCredential, AppState, MarketplaceId, Operation } from '@/types'
import { MARKETPLACES } from '@/lib/marketplaces'
import { toast } from 'sonner'

const SERVER = 'http://localhost:8787'
type Status = 'idle' | 'testing' | 'ok' | 'fail'
const today = () => new Date().toISOString().slice(0, 10)
const firstDay = () => `${new Date().getFullYear()}-01-01`
const uid = () => Math.random().toString(36).slice(2, 10)
const statusLabel = (s: 'api' | 'fallback_file' | 'limited') =>
  s === 'api' ? 'API' : s === 'fallback_file' ? 'Файл' : 'Ограничено'

export default function Connections({
  state,
  setState,
}: {
  state: AppState
  setState: (u: (p: AppState) => AppState) => void
}) {
  const [serverUp, setServerUp] = useState<boolean | null>(null),
    [dateFrom, setDateFrom] = useState(firstDay()),
    [dateTo, setDateTo] = useState(today()),
    [status, setStatus] = useState<Record<string, Status>>({}),
    [syncing, setSyncing] = useState<string | null>(null)
  useEffect(() => {
    fetch(`${SERVER}/api/health`, { signal: AbortSignal.timeout(2500) })
      .then((r) => setServerUp(r.ok))
      .catch(() => setServerUp(false))
  }, [])
  const credentials = useMemo(
    () =>
      state.credentials.map((c) => ({
        ...c,
        id: c.id ?? `${c.storeId}-${c.marketplace}-${c.clientId || 'default'}`,
        name: c.name ?? `${c.marketplace.toUpperCase()} кабинет`,
      })),
    [state.credentials],
  )
  const update = (id: string, patch: Partial<ApiCredential>) =>
    setState((p) => ({
      ...p,
      credentials: p.credentials.map((c) =>
        (c.id ?? `${c.storeId}-${c.marketplace}-${c.clientId || 'default'}`) === id
          ? { ...c, ...patch, id }
          : c,
      ),
    }))
  const add = (storeId: string, mp: MarketplaceId) => {
    const store = state.stores.find((s) => s.id === storeId)
    const id = `cred-${uid()}`
    setState((p) => ({
      ...p,
      credentials: [
        ...p.credentials,
        {
          id,
          name: `${mp.toUpperCase()} кабинет`,
          storeId,
          marketplace: mp,
          clientId: '',
          apiKey: '',
          updatedAt: new Date().toISOString(),
          organizationId: store?.organizationId,
          channelId: `ch-${mp}-${uid()}`,
        },
      ],
    }))
  }
  const remove = (id: string) =>
    setState((p) => ({
      ...p,
      credentials: p.credentials.filter(
        (c) => (c.id ?? `${c.storeId}-${c.marketplace}-${c.clientId || 'default'}`) !== id,
      ),
    }))
  const test = async (c: ApiCredential) => {
    const id = c.id!
    setStatus((s) => ({ ...s, [id]: 'testing' }))
    try {
      const r = await fetch(`${SERVER}/api/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: c.marketplace,
          clientId: c.clientId,
          apiKey: c.apiKey,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      setStatus((s) => ({ ...s, [id]: 'ok' }))
      toast.success(`${c.name}: подключение работает`)
    } catch (e) {
      setStatus((s) => ({ ...s, [id]: 'fail' }))
      toast.error(e instanceof Error ? e.message : 'Ошибка подключения')
    }
  }
  const sync = async (c: ApiCredential) => {
    const id = c.id!
    setSyncing(id)
    try {
      const r = await fetch(`${SERVER}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketplace: c.marketplace,
          clientId: c.clientId,
          apiKey: c.apiKey,
          dateFrom,
          dateTo,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error)
      const store = state.stores.find((s) => s.id === c.storeId)
      const ops: Operation[] = (d.operations ?? []).map(
        (o: Omit<Operation, 'id' | 'storeId' | 'marketplace'>) => ({
          ...o,
          id: `${id}-${o.date}-${uid()}`,
          storeId: c.storeId,
          marketplace: c.marketplace,
          organizationId: c.organizationId ?? store?.organizationId,
          businessUnitId: store?.businessUnitId,
          taxRegistrationId: store?.taxRegistrationId,
          channelId: c.channelId,
          sourceType: 'marketplace_api',
          note: `API:${c.marketplace}:${id} ${o.note ?? ''}`.trim(),
        }),
      )
      setState((p) => ({
        ...p,
        credentials: p.credentials.map((x) =>
          x.id === id
            ? {
                ...x,
                lastSyncAt: new Date().toISOString(),
                lastSyncCoverage: d.coverage,
                updatedAt: new Date().toISOString(),
              }
            : x,
        ),
        operations: [
          ...p.operations.filter(
            (o) => !(o.channelId === c.channelId && o.date >= dateFrom && o.date <= dateTo),
          ),
          ...ops,
        ],
      }))
      toast.success(
        `${c.name}: ${ops.length} операций${d.coverage?.complete === false ? ' · данные предварительные' : ''}`,
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Ошибка синхронизации')
    } finally {
      setSyncing(null)
    }
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Подключения API</h1>
        <p className="mt-1 text-sm text-stone-500">
          Один внешний кабинет = одно отдельное подключение. Два Ozon Client-Id одного ИП хранятся
          независимо и складываются только на уровне налогового расчёта ИП.
        </p>
      </div>
      {serverUp === false && (
        <Alert className="border-red-200 bg-red-50">
          <ServerOff className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Запусти локальный сервер: <code>npm run server</code>.
          </AlertDescription>
        </Alert>
      )}
      {serverUp && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <ShieldCheck className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Сервер доступен. Синхронизация выполняется только на чтение.
          </AlertDescription>
        </Alert>
      )}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div>
            <Label className="text-xs">С</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">По</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <p className="pb-2 text-xs text-stone-500">
            Для проверки налогов лучше синхронизировать с 01.01 выбранного года.
          </p>
        </CardContent>
      </Card>
      {state.stores
        .filter((s) => s.regime === 'usn6' || s.regime === 'usn15')
        .map((store) => (
          <div key={store.id} className="space-y-3">
            <h2 className="text-lg font-semibold">{store.name}</h2>
            {MARKETPLACES.map((mp) => {
              const list = credentials.filter(
                (c) => c.storeId === store.id && c.marketplace === mp.id,
              )
              return (
                <Card key={mp.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="h-4 w-4" />
                        {mp.name}
                      </CardTitle>
                      <Button size="sm" variant="outline" onClick={() => add(store.id, mp.id)}>
                        <Plus className="mr-1 h-4 w-4" />
                        Добавить кабинет
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="rounded-xl border bg-stone-50 p-3">
                      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
                        Что нужно для бухгалтерского расчёта
                      </div>
                      <div className="space-y-2">
                        {mp.financialReports.map((r) => (
                          <div
                            key={r.id}
                            className="flex items-start justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-medium text-stone-800">
                                {r.name}
                                {r.requiredForTax ? ' · обязательно' : ''}
                              </div>
                              <div className="text-stone-500">{r.note}</div>
                            </div>
                            <Badge variant={r.status === 'api' ? 'secondary' : 'outline'}>
                              {statusLabel(r.status)}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                    {list.length === 0 && (
                      <p className="text-sm text-stone-500">Подключений пока нет.</p>
                    )}
                    {list.map((c) => (
                      <div key={c.id} className="rounded-xl border p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Input
                              className="w-56 font-medium"
                              value={c.name ?? ''}
                              onChange={(e) => update(c.id!, { name: e.target.value })}
                            />
                            {status[c.id!] === 'ok' && (
                              <Badge className="bg-emerald-600">Подключено</Badge>
                            )}
                            {status[c.id!] === 'fail' && (
                              <Badge variant="destructive">Ошибка</Badge>
                            )}
                            {c.lastSyncCoverage && (
                              <Badge
                                variant={c.lastSyncCoverage.complete ? 'secondary' : 'outline'}
                              >
                                {c.lastSyncCoverage.complete
                                  ? 'Финансовые данные'
                                  : 'Предварительно'}
                              </Badge>
                            )}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => remove(c.id!)}>
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                        {mp.fields.clientId && (
                          <div className="mb-2">
                            <Label className="text-xs">{mp.fields.clientId}</Label>
                            <Input
                              value={c.clientId}
                              onChange={(e) =>
                                update(c.id!, {
                                  clientId: e.target.value,
                                  updatedAt: new Date().toISOString(),
                                })
                              }
                            />
                          </div>
                        )}
                        <div className="mb-3">
                          <Label className="text-xs">{mp.fields.apiKey}</Label>
                          <Input
                            type="password"
                            value={c.apiKey}
                            onChange={(e) =>
                              update(c.id!, {
                                apiKey: e.target.value,
                                updatedAt: new Date().toISOString(),
                              })
                            }
                          />
                        </div>
                        {c.lastSyncCoverage && (
                          <div
                            className={`mb-3 rounded-lg border p-2 text-xs ${c.lastSyncCoverage.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}
                          >
                            <div>
                              <b>Покрытие:</b> {c.lastSyncCoverage.dateFrom} —{' '}
                              {c.lastSyncCoverage.dateTo}, операций:{' '}
                              {c.lastSyncCoverage.operationCount}
                            </div>
                            <div>
                              <b>Режим:</b>{' '}
                              {c.lastSyncCoverage.sourceMode === 'financial'
                                ? 'финансовый отчёт/операции'
                                : 'заказы/предварительный источник'}
                            </div>
                            {c.lastSyncCoverage.warning && (
                              <div className="mt-1">⚠ {c.lastSyncCoverage.warning}</div>
                            )}
                          </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!c.apiKey || !serverUp}
                            onClick={() => test(c)}
                          >
                            {status[c.id!] === 'testing' ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : null}
                            Проверить
                          </Button>
                          <Button
                            size="sm"
                            className="bg-emerald-700 hover:bg-emerald-800"
                            disabled={!c.apiKey || !serverUp || syncing !== null}
                            onClick={() => sync(c)}
                          >
                            {syncing === c.id ? (
                              <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="mr-1 h-3.5 w-3.5" />
                            )}
                            Синхронизировать
                          </Button>
                          {c.lastSyncAt && (
                            <span className="self-center text-xs text-stone-500">
                              Последняя синхронизация:{' '}
                              {new Date(c.lastSyncAt).toLocaleString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ))}
    </div>
  )
}

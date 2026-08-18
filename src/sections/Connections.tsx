import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExternalLink, KeyRound, Loader2, RefreshCw, ServerOff, ShieldCheck } from 'lucide-react'
import type { ApiCredential, AppState, MarketplaceId, Operation } from '@/types'
import { MARKETPLACES } from '@/lib/marketplaces'
import { toast } from 'sonner'

const SERVER = 'http://localhost:8787'

interface Props {
  state: AppState
  setState: (updater: (prev: AppState) => AppState) => void
}

type Status = 'idle' | 'testing' | 'ok' | 'fail'

const firstDayOfMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
const today = () => new Date().toISOString().slice(0, 10)

export default function Connections({ state, setState }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { clientId: string; apiKey: string }>>({})
  const [status, setStatus] = useState<Record<string, Status>>({})
  const [serverUp, setServerUp] = useState<boolean | null>(null)
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [syncing, setSyncing] = useState<string | null>(null)

  useEffect(() => {
    fetch(`${SERVER}/api/health`, { signal: AbortSignal.timeout(2500) })
      .then((r) => setServerUp(r.ok))
      .catch(() => setServerUp(false))
  }, [])

  const key = (storeId: string, mp: MarketplaceId) => `${storeId}:${mp}`
  const getCred = (storeId: string, mp: MarketplaceId): ApiCredential | undefined =>
    state.credentials.find((c) => c.storeId === storeId && c.marketplace === mp)
  const getDraft = (storeId: string, mp: MarketplaceId) => {
    const k = key(storeId, mp)
    if (drafts[k]) return drafts[k]
    const saved = getCred(storeId, mp)
    return { clientId: saved?.clientId ?? '', apiKey: saved?.apiKey ?? '' }
  }

  const saveCred = (storeId: string, mp: MarketplaceId) => {
    const d = getDraft(storeId, mp)
    setState((p) => ({
      ...p,
      credentials: [
        ...p.credentials.filter((c) => !(c.storeId === storeId && c.marketplace === mp)),
        { storeId, marketplace: mp, clientId: d.clientId, apiKey: d.apiKey, updatedAt: new Date().toISOString() },
      ],
    }))
    toast.success('Ключи сохранены локально в браузере')
  }

  const test = async (storeId: string, mp: MarketplaceId) => {
    const k = key(storeId, mp)
    setStatus((s) => ({ ...s, [k]: 'testing' }))
    try {
      const res = await fetch(`${SERVER}/api/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: mp, ...getDraft(storeId, mp) }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      setStatus((s) => ({ ...s, [k]: 'ok' }))
      toast.success('Подключение работает!')
    } catch (e) {
      setStatus((s) => ({ ...s, [k]: 'fail' }))
      toast.error(`Ошибка: ${e instanceof Error ? e.message : 'нет связи с сервером'}`)
    }
  }

  const sync = async (storeId: string, mp: MarketplaceId) => {
    const k = key(storeId, mp)
    setSyncing(k)
    try {
      const res = await fetch(`${SERVER}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ marketplace: mp, ...getDraft(storeId, mp), dateFrom, dateTo }),
      })
      const data = await res.json()
      if (!data.ok) throw new Error(data.error)
      const ops: Operation[] = (data.operations as Omit<Operation, 'id' | 'storeId' | 'marketplace'>[]).map(
        (o) => ({
          ...o,
          id: Math.random().toString(36).slice(2, 10),
          storeId,
          marketplace: mp,
        }),
      )
      // Повторная синхронизация не дублирует данные: старые API-операции
      // этого магазина/маркетплейса за период заменяются свежими
      setState((p) => ({
        ...p,
        operations: [
          ...p.operations.filter(
            (o) =>
              !(
                o.storeId === storeId &&
                o.marketplace === mp &&
                o.date >= dateFrom &&
                o.date <= dateTo &&
                o.note?.startsWith('API:')
              ),
          ),
          ...ops,
        ],
      }))
      toast.success(`Синхронизировано: ${ops.length} дневных сводок за период`)
    } catch (e) {
      toast.error(`Синхронизация не удалась: ${e instanceof Error ? e.message : 'ошибка'}`)
    } finally {
      setSyncing(null)
    }
  }

  const statusBadge = (st: Status | undefined, saved?: ApiCredential) => {
    if (st === 'testing')
      return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Проверка…</Badge>
    if (st === 'ok') return <Badge className="bg-emerald-600">Подключено</Badge>
    if (st === 'fail') return <Badge variant="destructive">Ошибка</Badge>
    if (saved) return <Badge variant="secondary">Ключи сохранены</Badge>
    return <Badge variant="outline">Не подключено</Badge>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Подключения API</h1>

      {serverUp === false && (
        <Alert className="border-red-200 bg-red-50">
          <ServerOff className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-xs text-red-900">
            Локальный сервер синхронизации не запущен. Откройте терминал в папке проекта и
            выполните: <code className="rounded bg-red-100 px-1 font-mono">npm run server</code> —
            после этого обновите страницу. Сервер нужен, потому что браузеру запрещено напрямую
            обращаться к API маркетплейсов (CORS).
          </AlertDescription>
        </Alert>
      )}
      {serverUp && (
        <Alert className="border-emerald-200 bg-emerald-50">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <AlertDescription className="text-xs text-emerald-900">
            Сервер синхронизации запущен. Все запросы к маркетплейсам — только на чтение: ключи
            нигде не сохраняются на сервере и передаются напрямую в API маркетплейса.
          </AlertDescription>
        </Alert>
      )}

      <Card className="bg-white">
        <CardContent className="flex flex-wrap items-end gap-3 pt-5">
          <div className="space-y-1.5">
            <Label className="text-xs">Синхронизировать с</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">по</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
          <p className="pb-2 text-xs text-stone-500">
            Период применяется к кнопкам «Синхронизировать» ниже. Повторная синхронизация за тот же
            период заменяет данные, а не дублирует их.
          </p>
        </CardContent>
      </Card>

      {state.stores.map((store) => (
        <div key={store.id} className="space-y-3">
          <h2 className="text-lg font-semibold">{store.name}</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {MARKETPLACES.map((mp) => {
              const k = key(store.id, mp.id)
              const saved = getCred(store.id, mp.id)
              const draft = getDraft(store.id, mp.id)
              return (
                <Card key={mp.id} className="bg-white">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <KeyRound className="h-4 w-4" style={{ color: mp.color }} />
                        {mp.name}
                      </CardTitle>
                      {statusBadge(status[k], saved)}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <details className="text-xs text-stone-500">
                      <summary className="cursor-pointer font-medium text-stone-700">
                        Как получить ключ только на чтение
                      </summary>
                      <ol className="mt-2 list-decimal space-y-1 pl-4">
                        {mp.keyHelp.map((h) => (
                          <li key={h}>{h}</li>
                        ))}
                      </ol>
                      <a
                        href={mp.keyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-emerald-700 hover:underline"
                      >
                        Открыть кабинет <ExternalLink className="h-3 w-3" />
                      </a>
                    </details>
                    {mp.fields.clientId && (
                      <div className="space-y-1">
                        <Label className="text-xs">{mp.fields.clientId}</Label>
                        <Input
                          value={draft.clientId}
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [k]: { ...draft, clientId: e.target.value } }))
                          }
                          placeholder={mp.fields.clientId}
                        />
                      </div>
                    )}
                    <div className="space-y-1">
                      <Label className="text-xs">{mp.fields.apiKey}</Label>
                      <Input
                        type="password"
                        value={draft.apiKey}
                        onChange={(e) =>
                          setDrafts((d) => ({ ...d, [k]: { ...draft, apiKey: e.target.value } }))
                        }
                        placeholder={mp.fields.apiKey}
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        className="bg-emerald-700 hover:bg-emerald-800"
                        onClick={() => saveCred(store.id, mp.id)}
                        disabled={!draft.apiKey}
                      >
                        Сохранить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => test(store.id, mp.id)}
                        disabled={!draft.apiKey || status[k] === 'testing' || !serverUp}
                      >
                        Проверить
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 text-emerald-800"
                        onClick={() => sync(store.id, mp.id)}
                        disabled={!draft.apiKey || syncing !== null || !serverUp}
                      >
                        {syncing === k ? (
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-1 h-3.5 w-3.5" />
                        )}
                        Синхронизировать
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ))}
      {state.stores.length === 0 && (
        <p className="text-sm text-stone-500">Сначала добавьте магазин в разделе «Настройки».</p>
      )}
    </div>
  )
}

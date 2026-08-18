import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ExternalLink, KeyRound, Loader2, ShieldAlert } from 'lucide-react'
import type { ApiCredential, AppState, MarketplaceId } from '@/types'
import { MARKETPLACES } from '@/lib/marketplaces'
import { toast } from 'sonner'

interface Props {
  state: AppState
  setState: (updater: (prev: AppState) => AppState) => void
}

type TestStatus = 'idle' | 'testing' | 'ok' | 'cors' | 'fail'

/** Пробный запрос к API маркетплейса. Из браузера почти всегда упирается в CORS —
 *  честно показываем это пользователю. */
async function testConnection(mp: MarketplaceId, cred: { clientId: string; apiKey: string }): Promise<TestStatus> {
  const endpoints: Record<MarketplaceId, { url: string; headers: Record<string, string> }> = {
    ozon: {
      url: 'https://api-seller.ozon.ru/v1/roles',
      headers: { 'Client-Id': cred.clientId, 'Api-Key': cred.apiKey, 'Content-Type': 'application/json' },
    },
    wb: {
      url: 'https://common-api.wildberries.ru/ping',
      headers: { Authorization: cred.apiKey },
    },
    yandex: {
      url: `https://api.partner.market.yandex.ru/campaigns/${cred.clientId}`,
      headers: { 'Api-Key': cred.apiKey },
    },
    avito: {
      url: 'https://api.avito.ru/token/',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  }
  const ep = endpoints[mp]
  try {
    const res =
      mp === 'avito'
        ? await fetch(ep.url, {
            method: 'POST',
            headers: ep.headers,
            body: `grant_type=client_credentials&client_id=${encodeURIComponent(cred.clientId)}&client_secret=${encodeURIComponent(cred.apiKey)}`,
          })
        : mp === 'ozon'
          ? await fetch(ep.url, { method: 'POST', headers: ep.headers, body: '{}' })
          : await fetch(ep.url, { headers: ep.headers })
    return res.ok ? 'ok' : 'fail'
  } catch {
    return 'cors'
  }
}

export default function Connections({ state, setState }: Props) {
  const [drafts, setDrafts] = useState<Record<string, { clientId: string; apiKey: string }>>({})
  const [status, setStatus] = useState<Record<string, TestStatus>>({})

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
    toast.success('Ключи сохранены локально')
  }

  const test = async (storeId: string, mp: MarketplaceId) => {
    const k = key(storeId, mp)
    setStatus((s) => ({ ...s, [k]: 'testing' }))
    const result = await testConnection(mp, getDraft(storeId, mp))
    setStatus((s) => ({ ...s, [k]: result }))
    if (result === 'ok') toast.success('Подключение работает!')
    else if (result === 'cors')
      toast.warning('Браузер заблокировал запрос (CORS). Для автосинхронизации нужен серверный модуль.')
    else toast.error('API ответил ошибкой — проверьте ключи.')
  }

  const statusBadge = (st: TestStatus | undefined, saved?: ApiCredential) => {
    if (st === 'testing') return <Badge variant="secondary"><Loader2 className="mr-1 h-3 w-3 animate-spin" />Проверка…</Badge>
    if (st === 'ok') return <Badge className="bg-emerald-600">Подключено</Badge>
    if (st === 'cors') return <Badge className="bg-amber-500">CORS — нужен сервер</Badge>
    if (st === 'fail') return <Badge variant="destructive">Ошибка</Badge>
    if (saved) return <Badge variant="secondary">Ключи сохранены</Badge>
    return <Badge variant="outline">Не подключено</Badge>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Подключения API</h1>

      <Alert className="border-amber-200 bg-amber-50">
        <ShieldAlert className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-xs text-amber-900">
          Ключи хранятся только в вашем браузере (localStorage) и никуда не отправляются, кроме
          самих маркетплейсов. Прямая автосинхронизация из браузера ограничена политикой CORS
          маркетплейсов — для полноценной автоматики нужен небольшой серверный модуль
          (следующий этап проекта). Сейчас данные загружаются через импорт отчётов.
        </AlertDescription>
      </Alert>

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
                        Где взять ключи
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
                    <div className="flex gap-2">
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
                        disabled={!draft.apiKey || status[k] === 'testing'}
                      >
                        Проверить
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

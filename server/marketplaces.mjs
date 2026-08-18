/**
 * Read-only коннекторы к API маркетплейсов.
 * Все методы ТОЛЬКО читают данные (GET или POST-запросы выборки).
 * Ни один метод не создаёт, не изменяет и не удаляет данные в кабинетах.
 */

const DAY = 24 * 60 * 60 * 1000

const toDay = (v) => {
  if (!v) return null
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

/** Агрегатор по дням */
class DayBucket {
  constructor() {
    this.days = new Map()
  }
  add(date, { revenue = 0, commission = 0, logistics = 0, ads = 0, otherExpenses = 0 }) {
    const day = toDay(date)
    if (!day) return
    const d = this.days.get(day) ?? { revenue: 0, commission: 0, logistics: 0, ads: 0, otherExpenses: 0 }
    d.revenue += revenue
    d.commission += commission
    d.logistics += logistics
    d.ads += ads
    d.otherExpenses += otherExpenses
    this.days.set(day, d)
  }
  toArray(notePrefix) {
    return [...this.days.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        revenue: Math.round(d.revenue * 100) / 100,
        commission: Math.round(Math.abs(d.commission) * 100) / 100,
        logistics: Math.round(Math.abs(d.logistics) * 100) / 100,
        ads: Math.round(Math.abs(d.ads) * 100) / 100,
        otherExpenses: Math.round(Math.abs(d.otherExpenses) * 100) / 100,
        note: notePrefix,
      }))
  }
}

async function apiFetch(url, { method = 'GET', headers = {}, body, timeoutMs = 60000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const text = await res.text()
    let json
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
    if (!res.ok) {
      const msg = json?.message || json?.error || json?.errors?.[0]?.message || text.slice(0, 300)
      const err = new Error(`HTTP ${res.status}: ${msg}`)
      err.status = res.status
      err.retryAfter = Number(res.headers.get('x-ratelimit-retry-after') ?? res.headers.get('retry-after') ?? 0)
      throw err
    }
    return json
  } finally {
    clearTimeout(t)
  }
}

/* ============================== OZON ============================== */
/* POST /v3/finance/transaction/list — финансовые операции (чтение)  */

async function ozonSync({ clientId, apiKey, dateFrom, dateTo }) {
  const headers = { 'Client-Id': clientId, 'Api-Key': apiKey, 'Content-Type': 'application/json' }
  const bucket = new DayBucket()
  // Ozon отдаёт максимум 1 месяц за запрос — идём помесячно
  const start = new Date(`${dateFrom}T00:00:00Z`)
  const end = new Date(`${dateTo}T00:00:00Z`)
  for (let cur = new Date(start); cur <= end; cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1))) {
    const from = cur > start ? cur : start
    const monthEnd = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 0))
    const to = monthEnd < end ? monthEnd : end
    const iso = (d, t) => `${d.toISOString().slice(0, 10)}T${t}`
    let page = 1
    let pageCount = 1
    while (page <= pageCount && page <= 20) {
      const data = await apiFetch('https://api-seller.ozon.ru/v3/finance/transaction/list', {
        method: 'POST',
        headers,
        body: {
          filter: {
            date: { from: iso(from, '00:00:00.000Z'), to: iso(to, '23:59:59.999Z') },
            operation_type: [],
            posting_number: '',
            transaction_type: 'all',
          },
          page,
          page_size: 1000,
        },
      })
      const result = data?.result ?? {}
      pageCount = result.page_count ?? 1
      for (const op of result.operations ?? []) {
        const services = (op.services ?? []).reduce((a, s) => a + (s.price ?? 0), 0)
        bucket.add(op.operation_date, {
          revenue: op.accruals_for_sale ?? 0,
          commission: op.sale_commission ?? 0,
          logistics: (op.delivery_charge ?? 0) + (op.return_delivery_charge ?? 0),
          otherExpenses: services,
        })
      }
      page++
    }
  }
  return bucket.toArray('API: ozon')
}

async function ozonTest({ clientId, apiKey }) {
  const today = new Date().toISOString().slice(0, 10)
  await apiFetch('https://api-seller.ozon.ru/v3/finance/transaction/list', {
    method: 'POST',
    headers: { 'Client-Id': clientId, 'Api-Key': apiKey, 'Content-Type': 'application/json' },
    body: {
      filter: { date: { from: `${today}T00:00:00.000Z`, to: `${today}T23:59:59.999Z` }, operation_type: [], posting_number: '', transaction_type: 'all' },
      page: 1,
      page_size: 1,
    },
  })
  return true
}

/* ========================== WILDBERRIES =========================== */
/* Основной: GET /api/v5/supplier/reportDetailByPeriod (детальный отчёт).
   Резервный: GET /api/v1/supplier/sales — если отчёт недоступен по тарифу (429). */

async function wbSync({ apiKey, dateFrom, dateTo }) {
  try {
    return await wbSyncByReport({ apiKey, dateFrom, dateTo })
  } catch (e) {
    if (e.status !== 429) throw e
    console.warn('WB reportDetailByPeriod недоступен (429), переключаюсь на /supplier/sales')
    return wbSyncBySales({ apiKey, dateFrom, dateTo })
  }
}

async function wbSyncByReport({ apiKey, dateFrom, dateTo }) {
  const headers = { Authorization: apiKey }
  const bucket = new DayBucket()
  // WB отдаёт максимум ~30 дней за запрос — идём окнами
  for (let from = new Date(dateFrom); from <= new Date(dateTo); from = new Date(from.getTime() + 29 * DAY)) {
    const to = new Date(Math.min(from.getTime() + 29 * DAY, new Date(dateTo).getTime()))
    const fmt = (d) => d.toISOString().slice(0, 19)
    let rrdid = 0
    for (;;) {
      const url =
        `https://statistics-api.wildberries.ru/api/v5/supplier/reportDetailByPeriod` +
        `?dateFrom=${fmt(from)}&dateTo=${fmt(to)}&rrdid=${rrdid}&limit=100000`
      // WB жёстко ограничивает частоту — при 429 ждём и повторяем
      let rows
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          rows = await apiFetch(url, { headers })
          break
        } catch (e) {
          if (e.status === 429 && attempt < 1 && (e.retryAfter ?? 9999) <= 90) {
            await new Promise((r) => setTimeout(r, (e.retryAfter || 20) * 1000))
            continue
          }
          throw e
        }
      }
      if (!Array.isArray(rows) || rows.length === 0) break
      for (const r of rows) {
        const oper = r.supplier_oper_name
        const isSale = oper === 'Продажа'
        const isReturn = oper === 'Возврат'
        bucket.add(r.rr_dt, {
          revenue: isSale ? (r.retail_amount ?? r.ppvz_for_pay ?? 0) : isReturn ? -(r.retail_amount ?? r.ppvz_for_pay ?? 0) : 0,
          commission: r.ppvz_sales_commission ?? 0,
          logistics: (r.delivery_rub ?? 0) + (r.rebill_logistic_cost ?? 0),
          otherExpenses: (r.storage_fee ?? 0) + (r.penalty ?? 0) + (r.deduction ?? 0) + (r.acceptance ?? 0),
        })
        rrdid = r.rrd_id
      }
      if (rows.length < 100000) break
      await new Promise((r) => setTimeout(r, 300)) // бережём лимиты WB
    }
  }
  return bucket.toArray('API: wb')
}

/** Резерв: продажи/возвраты. Комиссия считается приближённо: finishedPrice − forPay. */
async function wbSyncBySales({ apiKey, dateFrom, dateTo }) {
  const headers = { Authorization: apiKey }
  const bucket = new DayBucket()
  const rows = await apiFetch(
    `https://statistics-api.wildberries.ru/api/v1/supplier/sales?dateFrom=${dateFrom}T00:00:00&flag=0`,
    { headers, timeoutMs: 120000 },
  )
  for (const r of Array.isArray(rows) ? rows : []) {
    const day = toDay(r.date)
    if (!day || day < dateFrom || day > dateTo) continue
    const revenue = r.finishedPrice ?? r.priceWithDisc ?? 0
    const commission = Math.max(0, revenue - (r.forPay ?? 0))
    if (String(r.saleID ?? '').startsWith('R')) bucket.add(day, { revenue: -revenue })
    else bucket.add(day, { revenue, commission })
  }
  const ops = bucket.toArray('API: wb (упрощённо)')
  return ops
}

async function wbTest({ apiKey }) {
  await apiFetch('https://statistics-api.wildberries.ru/ping', { headers: { Authorization: apiKey } })
  return true
}

/* ========================= ЯНДЕКС МАРКЕТ ========================== */
/* POST /v2/campaigns/{id}/stats/orders — статистика заказов (чтение) */

async function yandexSync({ clientId, apiKey, dateFrom, dateTo }) {
  if (!clientId) throw new Error('Укажите CampaignId (идентификатор кабинета)')
  const headers = { 'Api-Key': apiKey, 'Content-Type': 'application/json' }
  const bucket = new DayBucket()
  let pageToken
  for (let i = 0; i < 100; i++) {
    const url =
      `https://api.partner.market.yandex.ru/v2/campaigns/${clientId}/stats/orders?limit=200` +
      (pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : '')
    const data = await apiFetch(url, {
      method: 'POST',
      headers,
      body: {
        dateFrom: dateFrom.split('-').reverse().join('-'),
        dateTo: dateTo.split('-').reverse().join('-'),
      },
    })
    const orders = data?.result?.orders ?? []
    for (const o of orders) {
      // Выручка для налога — цена, которую заплатил покупатель (BUYER)
      const revenue = (o.items ?? []).reduce((a, it) => {
        const p = (it.prices ?? []).find((x) => x.type === 'BUYER') ?? (it.prices ?? [])[0]
        return a + (p?.total ?? (p?.costPerItem ?? 0) * (it.count ?? 1))
      }, 0)
      const commission = (o.commissions ?? []).reduce((a, c) => a + (c.actual ?? 0), 0)
      bucket.add(o.creationDate, { revenue: o.status === 'CANCELLED' ? 0 : revenue, commission })
    }
    pageToken = data?.result?.paging?.nextPageToken
    if (!pageToken) break
  }
  return bucket.toArray('API: yandex')
}

async function yandexTest({ clientId, apiKey }) {
  await apiFetch(`https://api.partner.market.yandex.ru/v2/campaigns/${clientId}`, {
    headers: { 'Api-Key': apiKey },
  })
  return true
}

/* ============================= АВИТО ============================== */
/* OAuth client_credentials → GET /order-management/1/orders (чтение) */

async function avitoGetToken({ clientId, apiKey }) {
  const res = await fetch('https://api.avito.ru/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=client_credentials&client_id=${encodeURIComponent(clientId)}&client_secret=${encodeURIComponent(apiKey)}`,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.access_token) throw new Error(`Авито OAuth: HTTP ${res.status}`)
  return data.access_token
}

async function avitoSync({ clientId, apiKey, dateFrom, dateTo }) {
  const token = await avitoGetToken({ clientId, apiKey })
  const headers = { Authorization: `Bearer ${token}` }
  const bucket = new DayBucket()
  let offset = 0
  for (let i = 0; i < 50; i++) {
    const data = await apiFetch(`https://api.avito.ru/order-management/1/orders?limit=20&offset=${offset}`, { headers })
    const orders = data?.orders ?? data?.result?.orders ?? []
    if (orders.length === 0) break
    for (const o of orders) {
      const day = toDay(o.createdAt ?? o.created_at ?? o.date)
      if (!day) continue
      // заказы идут по убыванию даты — дальше периода нет смысла листать
      if (day < dateFrom) { offset = Infinity; break }
      if (day > dateTo) continue
      if (o.status === 'canceled') continue
      const revenue =
        Number(o.prices?.price ?? 0) ||
        (o.items ?? []).reduce((a, it) => a + Number(it.prices?.price ?? 0) * (it.count ?? 1), 0)
      const commission = Number(o.prices?.commission ?? 0) ||
        (o.items ?? []).reduce((a, it) => a + Number(it.prices?.commission ?? 0), 0)
      bucket.add(day, { revenue, commission })
    }
    if (!Number.isFinite(offset)) break
    if (orders.length < 20) break
    offset += 20
  }
  return bucket.toArray('API: avito')
}

async function avitoTest({ clientId, apiKey }) {
  const token = await avitoGetToken({ clientId, apiKey })
  await apiFetch('https://api.avito.ru/core/v1/accounts/self', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return true
}

/* ============================ РЕЕСТР ============================== */

export const SYNCERS = { ozon: ozonSync, wb: wbSync, yandex: yandexSync, avito: avitoSync }
export const TESTERS = { ozon: ozonTest, wb: wbTest, yandex: yandexTest, avito: avitoTest }

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
      throw new Error(`HTTP ${res.status}: ${msg}`)
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
  let page = 1
  let pageCount = 1
  while (page <= pageCount && page <= 50) {
    const data = await apiFetch('https://api-seller.ozon.ru/v3/finance/transaction/list', {
      method: 'POST',
      headers,
      body: {
        filter: {
          date: { from: `${dateFrom}T00:00:00.000Z`, to: `${dateTo}T23:59:59.999Z` },
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
/* GET /api/v5/supplier/reportDetailByPeriod — детальный отчёт (чтение) */

async function wbSync({ apiKey, dateFrom, dateTo }) {
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
      const rows = await apiFetch(url, { headers })
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
        dateFrom: dateFrom.split('-').reverse().join('.'),
        dateTo: dateTo.split('-').reverse().join('.'),
      },
    })
    const orders = data?.result?.orders ?? []
    for (const o of orders) {
      const revenue = (o.items ?? []).reduce((a, it) => a + (it.price ?? 0) * (it.count ?? 1), 0)
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
    const data = await apiFetch(`https://api.avito.ru/order-management/1/orders?limit=100&offset=${offset}`, { headers })
    const orders = data?.orders ?? data?.result?.orders ?? []
    if (orders.length === 0) break
    for (const o of orders) {
      const day = toDay(o.createdAt ?? o.created_at ?? o.date)
      if (!day || day < dateFrom || day > dateTo) continue
      const revenue = (o.items ?? []).reduce((a, it) => a + Number(it.price ?? it.cost ?? 0) * (it.count ?? 1), 0) || Number(o.total ?? 0)
      bucket.add(day, { revenue })
    }
    if (orders.length < 100) break
    offset += 100
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

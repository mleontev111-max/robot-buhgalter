import * as XLSX from 'xlsx'
import type { MarketplaceId, Operation } from '@/types'

export interface ParsedReport {
  headers: string[]
  rows: Record<string, string>[]
  suggested: ColumnMapping
}

export interface ColumnMapping {
  date: string
  revenue: string
  commission: string
  logistics: string
  ads: string
  otherExpenses: string
  note: string
}

const KEYWORDS: Record<keyof ColumnMapping, string[]> = {
  date: ['дата'],
  revenue: ['реализовано', 'начислено', 'выручка', 'цена продажи', 'сумма заказа', 'стоимость', 'продажа'],
  commission: ['комиссия', 'вознагражден'],
  logistics: ['логистика', 'доставка'],
  ads: ['реклама', 'продвижение', 'трафарет'],
  otherExpenses: ['прочие', 'штраф', 'хранен', 'удержан'],
  note: ['название', 'наименование', 'товар', 'предмет', 'артикул'],
}

function suggest(headers: string[]): ColumnMapping {
  const find = (keys: string[]) =>
    headers.find((h) => keys.some((k) => h.toLowerCase().includes(k))) ?? ''
  return {
    date: find(KEYWORDS.date),
    revenue: find(KEYWORDS.revenue),
    commission: find(KEYWORDS.commission),
    logistics: find(KEYWORDS.logistics),
    ads: find(KEYWORDS.ads),
    otherExpenses: find(KEYWORDS.otherExpenses),
    note: find(KEYWORDS.note),
  }
}

const toNum = (v: string | undefined): number => {
  if (!v) return 0
  const n = parseFloat(v.replace(/\s/g, '').replace(/₽|р\.?|руб\.?/gi, '').replace(',', '.'))
  return Number.isFinite(n) ? Math.abs(n) : 0
}

const toDate = (v: string | undefined): string | null => {
  if (!v) return null
  const s = v.trim()
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

export async function parseReportFile(file: File): Promise<ParsedReport> {
  const buf = await file.arrayBuffer()
  let text = new TextDecoder('utf-8').decode(buf)
  if (text.includes('�')) text = new TextDecoder('windows-1251').decode(buf)

  const isExcel = /\.(xlsx|xls)$/i.test(file.name)
  const wb = isExcel ? XLSX.read(buf, { type: 'array' }) : XLSX.read(text, { type: 'string' })
  const sheet = wb.Sheets[wb.SheetNames[0]]
  const rows = XLSX.utils.sheet_to_json<Record<string, string>>(sheet, {
    defval: '',
    raw: false,
  })
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []
  return { headers, rows: rows.slice(0, 5000), suggested: suggest(headers) }
}

/** Агрегирует строки отчёта по дням → операции (дата × магазин × маркетплейс) */
export function buildOperations(
  parsed: ParsedReport,
  map: ColumnMapping,
  storeId: string,
  marketplace: MarketplaceId,
): Operation[] {
  const byDay = new Map<string, Operation>()
  let skipped = 0
  for (const row of parsed.rows) {
    const date = toDate(row[map.date])
    const revenue = toNum(row[map.revenue])
    if (!date || revenue === 0) {
      skipped++
      continue
    }
    const existing = byDay.get(date)
    const commission = toNum(row[map.commission])
    const logistics = toNum(row[map.logistics])
    const ads = toNum(row[map.ads])
    const otherExpenses = toNum(row[map.otherExpenses])
    if (existing) {
      existing.revenue += revenue
      existing.commission += commission
      existing.logistics += logistics
      existing.ads += ads
      existing.otherExpenses += otherExpenses
    } else {
      byDay.set(date, {
        id: Math.random().toString(36).slice(2, 10),
        storeId,
        marketplace,
        date,
        revenue,
        commission,
        logistics,
        ads,
        otherExpenses,
        note: `Импорт: ${marketplace}`,
      })
    }
  }
  if (skipped > 0) console.warn(`Пропущено строк без даты/суммы: ${skipped}`)
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date))
}

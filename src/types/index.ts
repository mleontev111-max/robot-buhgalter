export type MarketplaceId = 'ozon' | 'wb' | 'yandex' | 'avito'

export type TaxRegime = 'usn6' | 'usn15' | 'npd' | 'psn' | 'osno'

export interface Store {
  id: string
  name: string
  regime: TaxRegime
  /** Ставка НПД (4 или 6), для самозанятых */
  npdRate?: number
  /** Страховые взносы за год, ₽ (уменьшают налог УСН 6% / патент) */
  insurancePremiums: number
  /** Есть наёмные сотрудники (уменьшение налога максимум на 50%) */
  hasEmployees: boolean
  /** Годовая стоимость патента, ₽ (для ПСН) */
  patentCost?: number
}

export interface Operation {
  id: string
  storeId: string
  marketplace: MarketplaceId
  /** ISO-дата, YYYY-MM-DD */
  date: string
  /** Выручка — начислено покупателями, ₽ */
  revenue: number
  /** Комиссия маркетплейса, ₽ */
  commission: number
  /** Логистика и доставка, ₽ */
  logistics: number
  /** Реклама и продвижение, ₽ */
  ads: number
  /** Прочие расходы (штрафы, хранение и т.п.), ₽ */
  otherExpenses: number
  note?: string
}

export interface ApiCredential {
  storeId: string
  marketplace: MarketplaceId
  clientId: string
  apiKey: string
  updatedAt: string
}

export type Section = 'dashboard' | 'operations' | 'taxes' | 'connections' | 'settings'

export interface AppState {
  stores: Store[]
  operations: Operation[]
  credentials: ApiCredential[]
}

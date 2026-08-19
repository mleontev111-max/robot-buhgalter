export type MarketplaceId = 'ozon' | 'wb' | 'yandex' | 'avito'
export type TaxRegime = 'usn6' | 'usn15' | 'npd' | 'psn' | 'osno'
export type VatMode = 'auto' | 'exempt' | 'vat5' | 'vat7' | 'vat22'
export type LegalForm = 'ip' | 'ooo'

export interface Store {
  id: string
  name: string
  /** ИП или ООО — важно для расчёта ОСНО. */
  legalForm?: LegalForm
  regime: TaxRegime
  usnIncomeRate?: number
  usnProfitRate?: number
  vatMode?: VatMode
  insurancePremiums: number
  hasEmployees: boolean
  patentCost?: number
}

export interface Operation {
  id: string
  storeId: string
  marketplace: MarketplaceId
  date: string
  /** Доход от реализации — начислено покупателям до удержания комиссии маркетплейса, ₽ */
  revenue: number
  commission: number
  logistics: number
  ads: number
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

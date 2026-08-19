export type MarketplaceId = 'ozon' | 'wb' | 'yandex' | 'avito'

export type TaxRegime = 'usn6' | 'usn15' | 'npd' | 'psn' | 'osno'
export type VatMode = 'auto' | 'exempt' | 'vat5' | 'vat7' | 'vat22'

export interface Store {
  id: string
  name: string
  regime: TaxRegime
  /** Ставка УСН «Доходы», % (обычно 6%, но регион может установить пониженную) */
  usnIncomeRate?: number
  /** Ставка УСН «Доходы минус расходы», % (обычно 15%, региональная ставка может быть ниже) */
  usnProfitRate?: number
  /** Режим НДС для УСН: авто по лимитам 2026 года или выбранная ставка */
  vatMode?: VatMode
  /** Страховые взносы за год, ₽. Если не указаны, для ИП без работников рассчитываются автоматически по доходу. */
  insurancePremiums: number
  /** Есть наёмные сотрудники (для УСН «Доходы» и ПСН действует ограничение 50%) */
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
  /** Доход от реализации — начислено покупателям до удержания комиссии маркетплейса, ₽ */
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

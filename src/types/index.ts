export type MarketplaceId = 'ozon' | 'wb' | 'yandex' | 'avito'
export type TaxRegime = 'usn6' | 'usn15' | 'npd' | 'psn' | 'osno'
export type VatMode = 'auto' | 'exempt' | 'vat5' | 'vat7' | 'vat22'
export type LegalForm = 'ip' | 'ooo'

/**
 * Временный совместимый слой для текущего интерфейса.
 * Новая архитектура использует Organization/TaxRegistration/BusinessUnit/SalesChannel.
 */
export interface Store {
  id: string
  name: string
  /** ИП или ООО — важно для расчёта ОСНО. */
  legalForm?: LegalForm
  /** Новые связи доменной модели. На этапе миграции могут отсутствовать. */
  organizationId?: string
  taxRegistrationId?: string
  businessUnitId?: string
  channelIds?: string[]
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
  /** Новые связи доменной модели. */
  organizationId?: string
  businessUnitId?: string
  channelId?: string
  taxRegistrationId?: string
  sourceType?: 'marketplace_api' | 'bank_statement' | 'cash_register' | 'ofd' | 'excel' | 'csv' | 'manual'
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
  /** Новая модель: секрет принадлежит организации/каналу, а не всему приложению. */
  organizationId?: string
  channelId?: string
}

export type Section = 'dashboard' | 'operations' | 'taxes' | 'connections' | 'settings'

export interface AppState {
  stores: Store[]
  operations: Operation[]
  credentials: ApiCredential[]
  /** Целевая многопользовательская модель. Заполняется миграцией по мере перехода UI на неё. */
  users?: import('./domain').UserAccount[]
  organizations?: import('./domain').Organization[]
  taxRegistrations?: import('./domain').TaxRegistration[]
  businessUnits?: import('./domain').BusinessUnit[]
  salesChannels?: import('./domain').SalesChannel[]
  accessGrants?: import('./domain').AccessGrant[]
  subscriptions?: import('./domain').Subscription[]
  schemaVersion?: number
}

export type {
  AccessGrant,
  BusinessUnit,
  BusinessUnitType,
  DataSourceType,
  Organization,
  OrganizationStatus,
  PatentProfile,
  SalesChannel,
  SalesChannelType,
  Subscription,
  SubscriptionPlan,
  TaxRegistration,
  UserAccount,
  UserRole,
} from './domain'

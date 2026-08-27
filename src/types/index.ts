export type MarketplaceId = 'ozon' | 'wb' | 'yandex' | 'avito'
export type TaxRegime = 'usn6' | 'usn15' | 'npd' | 'psn' | 'osno'
export type VatMode = 'auto' | 'exempt' | 'vat5' | 'vat7' | 'vat22'
export type LegalForm = 'ip' | 'ooo'

export interface Store {
  id: string
  name: string
  legalForm?: LegalForm
  organizationId?: string
  taxRegistrationId?: string
  businessUnitId?: string
  channelIds?: string[]
  regime: TaxRegime
  usnIncomeRate?: number
  usnProfitRate?: number
  npdRate?: number
  vatMode?: VatMode
  priorYearRevenue?: number
  patentPotentialIncome?: number
  insurancePremiums: number
  hasEmployees: boolean
  patentCost?: number
}

export interface Operation {
  id: string
  storeId: string
  organizationId?: string
  businessUnitId?: string
  channelId?: string
  taxRegistrationId?: string
  sourceType?:
    'marketplace_api' | 'bank_statement' | 'cash_register' | 'ofd' | 'excel' | 'csv' | 'manual'
  marketplace: MarketplaceId
  date: string
  revenue: number
  commission: number
  logistics: number
  ads: number
  otherExpenses: number
  note?: string
}

export interface SyncCoverage {
  dateFrom: string
  dateTo: string
  operationCount: number
  sourceMode?: 'financial' | 'orders' | 'fallback'
  complete?: boolean
  warning?: string
}

/** Зашифрованный AES-GCM секрет: см. src/lib/secretCrypto.ts. Не содержит
 * пароль пользователя и сам по себе бесполезен без него. */
export interface EncryptedSecret {
  /** base64, случайный IV на каждое шифрование */
  iv: string
  ciphertext: string
}

/**
 * Одно подключение = один отдельный внешний кабинет/аккаунт.
 *
 * clientId/apiKey — рабочие значения в открытом виде, существуют только в
 * памяти (React-стейт) на время разблокированной сессии вкладки; в
 * localStorage вместо них пишется `secret` (см. src/lib/storage.ts). Если
 * шифрование ключей у пользователя не включено, secret отсутствует и
 * clientId/apiKey хранятся как раньше — открытым текстом.
 */
export interface ApiCredential {
  id?: string
  name?: string
  storeId: string
  marketplace: MarketplaceId
  clientId: string
  apiKey: string
  secret?: EncryptedSecret
  updatedAt: string
  organizationId?: string
  channelId?: string
  lastSyncAt?: string
  lastSyncCoverage?: SyncCoverage
}

export type TaxPaymentKind = 'usn' | 'patent' | 'insurance_fixed' | 'insurance_1pct' | 'other'
export interface TaxPayment {
  id: string
  organizationId: string
  kind: TaxPaymentKind
  amount: number
  paidAt: string
  obligationId?: string
  note?: string
  source?: 'manual' | 'bank' | 'ens'
}

export type Section =
  'dashboard' | 'organizations' | 'operations' | 'taxes' | 'connections' | 'settings'

export interface AppState {
  stores: Store[]
  operations: Operation[]
  credentials: ApiCredential[]
  /** Соль PBKDF2 для шифрования API-ключей (не секрет, генерируется один раз
   * при первом включении шифрования). См. src/lib/secretCrypto.ts. */
  credentialsSalt?: string
  taxPayments?: TaxPayment[]
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

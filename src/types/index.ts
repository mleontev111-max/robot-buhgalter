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
  sourceType?: 'marketplace_api' | 'bank_statement' | 'cash_register' | 'ofd' | 'excel' | 'csv' | 'manual'
  marketplace: MarketplaceId
  date: string
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
  organizationId?: string
  channelId?: string
}

export type TaxPaymentKind = 'usn' | 'patent' | 'insurance_fixed' | 'insurance_1pct' | 'other'
export interface TaxPayment {
  id: string
  organizationId: string
  kind: TaxPaymentKind
  amount: number
  paidAt: string
  /** Идентификатор обязательства из налогового календаря, если платеж относится к нему. */
  obligationId?: string
  note?: string
  source?: 'manual' | 'bank' | 'ens'
}

export type Section = 'dashboard' | 'organizations' | 'operations' | 'taxes' | 'connections' | 'settings'

export interface AppState {
  stores: Store[]
  operations: Operation[]
  credentials: ApiCredential[]
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

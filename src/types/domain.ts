/**
 * Целевая доменная модель коммерческой версии Робота-бухгалтера.
 *
 * Важный принцип: аккаунт пользователя, налогоплательщик, торговая точка
 * и канал продаж — разные сущности. Это позволяет одному клиенту иметь
 * несколько ИП/ООО, несколько режимов налогообложения и несколько каналов.
 */

import type { LegalForm, MarketplaceId, TaxRegime, VatMode } from './index'

export type UserRole = 'owner' | 'admin' | 'accountant' | 'client'
export type OrganizationStatus = 'active' | 'archived'
export type BusinessUnitType = 'retail_store' | 'online_store' | 'wholesale' | 'other'
export type SalesChannelType = 'marketplace' | 'website' | 'retail' | 'wholesale' | 'bank' | 'cash_register' | 'manual'
export type DataSourceType = 'marketplace_api' | 'bank_statement' | 'cash_register' | 'ofd' | 'excel' | 'csv' | 'manual'

export interface UserAccount {
  id: string
  email: string
  displayName: string
  role: UserRole
  organizationIds: string[]
  createdAt: string
  status: 'active' | 'blocked'
}

export interface Organization {
  id: string
  ownerUserId: string
  legalForm: LegalForm
  name: string
  taxId?: string
  registrationId?: string
  regionCode?: string
  registeredAddress?: string
  status: OrganizationStatus
  createdAt: string
}

export interface TaxRegistration {
  id: string
  organizationId: string
  regime: TaxRegime
  validFrom: string
  validTo?: string
  usnIncomeRate?: number
  usnProfitRate?: number
  vatMode?: VatMode
  hasEmployees: boolean
  employeesCount?: number
  patent?: PatentProfile
  notes?: string
}

export interface PatentPayment {
  dueDate: string
  amount: number
  share?: 'one_third' | 'two_thirds' | 'full'
}

export interface PatentProfile {
  patentNumber?: string
  activityCode?: string
  activityName?: string
  regionCode?: string
  validFrom: string
  validTo: string
  potentialIncome?: number
  cost: number
  /** quarterly оставлен для совместимости со старыми локальными данными. */
  paymentSchedule: 'single' | 'installments' | 'quarterly'
  payments?: PatentPayment[]
}

export interface BusinessUnit {
  id: string
  organizationId: string
  name: string
  type: BusinessUnitType
  address?: string
  taxRegistrationIds: string[]
  active: boolean
}

export interface SalesChannel {
  id: string
  organizationId: string
  businessUnitId?: string
  type: SalesChannelType
  marketplace?: MarketplaceId
  name: string
  sourceType: DataSourceType
  active: boolean
}

export interface AccessGrant {
  id: string
  userId: string
  organizationId: string
  role: Exclude<UserRole, 'owner'>
  createdAt: string
}

export type SubscriptionPlan = 'trial' | 'start' | 'business' | 'accountant'

export interface Subscription {
  id: string
  ownerUserId: string
  plan: SubscriptionPlan
  status: 'trialing' | 'active' | 'past_due' | 'cancelled'
  currentPeriodStart: string
  currentPeriodEnd: string
}

export const DOMAIN_SCHEMA_VERSION = 3

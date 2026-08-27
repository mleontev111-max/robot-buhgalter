import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppState, Store } from '@/types'
import { makeDemoState } from '@/lib/demo'

const KEY = 'robot-buhgalter-v3'

function migrateStores(stores: Store[]) {
  const organizations = stores.map((store) => ({
    id: store.organizationId ?? `org-${store.id}`,
    ownerUserId: 'local-owner',
    legalForm: store.legalForm ?? 'ip',
    name: store.name,
    status: 'active' as const,
    createdAt: new Date().toISOString(),
  }))
  const taxRegistrations = stores.map((store) => ({
    id: store.taxRegistrationId ?? `tax-${store.id}`,
    organizationId: store.organizationId ?? `org-${store.id}`,
    regime: store.regime,
    validFrom: '2026-01-01',
    usnIncomeRate: store.usnIncomeRate ?? 6,
    usnProfitRate: store.usnProfitRate ?? 15,
    vatMode: store.vatMode ?? 'auto',
    hasEmployees: Boolean(store.hasEmployees),
    employeesCount: store.hasEmployees ? undefined : 0,
    patent:
      store.regime === 'psn'
        ? {
            validFrom: '2026-01-01',
            validTo: '2026-12-31',
            cost: store.patentCost ?? 0,
            paymentSchedule: 'quarterly' as const,
          }
        : undefined,
  }))
  const businessUnits = stores.map((store) => ({
    id: store.businessUnitId ?? `bu-${store.id}`,
    organizationId: store.organizationId ?? `org-${store.id}`,
    name: store.name,
    type: 'other' as const,
    taxRegistrationIds: [store.taxRegistrationId ?? `tax-${store.id}`],
    active: true,
  }))
  const salesChannels = stores.map((store) => ({
    id: `ch-${store.id}-manual`,
    organizationId: store.organizationId ?? `org-${store.id}`,
    businessUnitId: store.businessUnitId ?? `bu-${store.id}`,
    type: 'manual' as const,
    name: 'Ручной ввод',
    sourceType: 'manual' as const,
    active: true,
  }))
  const users = [
    {
      id: 'local-owner',
      email: 'local@robot-buhgalter.local',
      displayName: 'Владелец',
      role: 'owner' as const,
      organizationIds: organizations.map((o) => o.id),
      createdAt: new Date().toISOString(),
      status: 'active' as const,
    },
  ]
  return { users, organizations, taxRegistrations, businessUnits, salesChannels }
}

function normalizeState(data: AppState): AppState {
  const stores = (data.stores ?? []).map((store) => ({
    ...store,
    legalForm: store.legalForm ?? 'ip',
    insurancePremiums: store.insurancePremiums === 53658 ? 0 : (store.insurancePremiums ?? 0),
    usnIncomeRate: store.usnIncomeRate ?? 6,
    usnProfitRate: store.usnProfitRate ?? 15,
    npdRate: store.npdRate ?? 6,
    vatMode: store.vatMode ?? 'auto',
    hasEmployees: Boolean(store.hasEmployees),
  }))
  const migrated = data.organizations?.length
    ? {
        users: data.users ?? [],
        organizations: data.organizations,
        taxRegistrations: data.taxRegistrations ?? [],
        businessUnits: data.businessUnits ?? [],
        salesChannels: data.salesChannels ?? [],
      }
    : migrateStores(stores)
  return {
    ...data,
    stores: stores.map((store) => ({
      ...store,
      organizationId: store.organizationId ?? `org-${store.id}`,
      taxRegistrationId: store.taxRegistrationId ?? `tax-${store.id}`,
      businessUnitId: store.businessUnitId ?? `bu-${store.id}`,
      channelIds: store.channelIds ?? [`ch-${store.id}-manual`],
    })),
    operations: (data.operations ?? []).map((operation) => {
      const store = stores.find((item) => item.id === operation.storeId)
      return {
        ...operation,
        organizationId:
          operation.organizationId ?? store?.organizationId ?? `org-${operation.storeId}`,
        businessUnitId:
          operation.businessUnitId ?? store?.businessUnitId ?? `bu-${operation.storeId}`,
        taxRegistrationId:
          operation.taxRegistrationId ?? store?.taxRegistrationId ?? `tax-${operation.storeId}`,
        channelId: operation.channelId ?? `ch-${operation.storeId}-manual`,
        sourceType: operation.sourceType ?? 'manual',
      }
    }),
    credentials: data.credentials ?? [],
    taxPayments: data.taxPayments ?? [],
    ...migrated,
    accessGrants: data.accessGrants ?? [],
    subscriptions: data.subscriptions ?? [],
    schemaVersion: 3,
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeState(JSON.parse(raw) as AppState)
  } catch {
    // Повреждённые локальные данные заменяем демо-контуром.
  }
  return normalizeState(makeDemoState())
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function useAppState() {
  const [state, setStateRaw] = useState<AppState>(loadState)
  useEffect(() => {
    saveState(state)
  }, [state])

  const setState = useCallback(
    (updater: (prev: AppState) => AppState) => setStateRaw((prev) => updater(prev)),
    [],
  )
  const resetToDemo = useCallback(() => setStateRaw(normalizeState(makeDemoState())), [])
  const clearAll = useCallback(
    () =>
      setStateRaw(normalizeState({ stores: [], operations: [], credentials: [], taxPayments: [] })),
    [],
  )

  return useMemo(
    () => ({ state, setState, resetToDemo, clearAll }),
    [state, setState, resetToDemo, clearAll],
  )
}

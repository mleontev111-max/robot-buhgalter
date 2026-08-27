import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AppState, Store } from '@/types'
import { makeDemoState } from '@/lib/demo'
import { encryptSecret, getSessionCredentialsKey } from '@/lib/secretCrypto'

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

/**
 * Готовит state к записи в localStorage: если ключи шифрования разблокированы
 * в этой вкладке (см. secretCrypto.ts), заменяет открытые apiKey/clientId в
 * credentials на зашифрованный secret. В React-стейте (аргумент state) при
 * этом ничего не меняется — расшифрованные значения остаются в памяти для UI,
 * шифруется только то, что реально уходит на диск.
 */
export async function buildPersistedState(state: AppState): Promise<AppState> {
  const key = getSessionCredentialsKey()
  if (!key) return state
  const credentials = await Promise.all(
    state.credentials.map(async (credential) => {
      if (!credential.apiKey && !credential.clientId) return credential
      const secret = await encryptSecret(
        { clientId: credential.clientId, apiKey: credential.apiKey },
        key,
      )
      return { ...credential, clientId: '', apiKey: '', secret }
    }),
  )
  return { ...state, credentials }
}

// Сохранения выстраиваются в очередь: без этого при двух быстрых подряд
// изменениях (например, ввод символа за символом в поле ключа) шифрование
// (асинхронное) могло бы завершиться не в том порядке, и в localStorage
// оказалась бы более старая версия поверх новой.
let pendingSave: Promise<void> = Promise.resolve()

export function saveState(state: AppState): Promise<void> {
  pendingSave = pendingSave
    .catch(() => undefined)
    .then(async () => {
      const persisted = await buildPersistedState(state)
      localStorage.setItem(KEY, JSON.stringify(persisted))
    })
  return pendingSave
}

export function useAppState() {
  const [state, setStateRaw] = useState<AppState>(loadState)
  useEffect(() => {
    saveState(state).catch((err) => console.error('Не удалось сохранить данные', err))
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

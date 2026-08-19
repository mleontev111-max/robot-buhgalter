import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '@/types'
import { makeDemoState } from '@/lib/demo'

const KEY = 'robot-buhgalter-v1'

function normalizeState(data: AppState): AppState {
  return {
    ...data,
    stores: (data.stores ?? []).map((store) => ({
      ...store,
      // Старое значение 53 658 ₽ было параметром 2025 года.
      // Для 2026 года 0 означает автоматический расчёт 57 390 ₽ + 1%.
      insurancePremiums: store.insurancePremiums === 53658 ? 0 : (store.insurancePremiums ?? 0),
      usnIncomeRate: store.usnIncomeRate ?? 6,
      usnProfitRate: store.usnProfitRate ?? 15,
      vatMode: store.vatMode ?? 'auto',
      hasEmployees: Boolean(store.hasEmployees),
    })),
    operations: data.operations ?? [],
    credentials: data.credentials ?? [],
  }
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return normalizeState(JSON.parse(raw) as AppState)
  } catch {
    /* повреждённые данные — начнём заново */
  }
  return {
    stores: [
      { id: 'lafka', name: 'Чайная лафка', regime: 'usn6', insurancePremiums: 0, hasEmployees: false, usnIncomeRate: 6, usnProfitRate: 15, vatMode: 'auto' },
      { id: 'thechai', name: 'the chai', regime: 'usn6', insurancePremiums: 0, hasEmployees: false, usnIncomeRate: 6, usnProfitRate: 15, vatMode: 'auto' },
    ],
    operations: [],
    credentials: [],
  }
}

export function saveState(state: AppState) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function useAppState() {
  const [state, setStateRaw] = useState<AppState>(loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const setState = useCallback((updater: (prev: AppState) => AppState) => {
    setStateRaw((prev) => updater(prev))
  }, [])

  const resetToDemo = useCallback(() => setStateRaw(makeDemoState()), [])
  const clearAll = useCallback(() => setStateRaw({ stores: [], operations: [], credentials: [] }), [])

  return { state, setState, resetToDemo, clearAll }
}

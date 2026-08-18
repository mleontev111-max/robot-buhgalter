import { useCallback, useEffect, useState } from 'react'
import type { AppState } from '@/types'
import { makeDemoState } from '@/lib/demo'

const KEY = 'robot-buhgalter-v1'

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as AppState
  } catch {
    /* повреждённые данные — начнём заново */
  }
  return {
    stores: [
      { id: 'lafka', name: 'Чайная лафка', regime: 'usn6', insurancePremiums: 53658, hasEmployees: false },
      { id: 'thechai', name: 'the chai', regime: 'usn6', insurancePremiums: 53658, hasEmployees: false },
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
  const clearAll = useCallback(
    () =>
      setStateRaw({
        stores: [],
        operations: [],
        credentials: [],
      }),
    [],
  )

  return { state, setState, resetToDemo, clearAll }
}

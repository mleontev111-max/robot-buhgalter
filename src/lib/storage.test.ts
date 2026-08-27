import { beforeEach, describe, expect, it } from 'vitest'
import type { AppState } from '@/types'
import { buildPersistedState, loadState, saveState } from './storage'
import {
  deriveCredentialsKey,
  generateCredentialsSalt,
  setSessionCredentialsKey,
} from './secretCrypto'

// В тестовой среде (vitest, окружение node) нет глобального localStorage —
// подставляем минимальный in-memory полифилл, этого достаточно для того,
// что реально использует storage.ts (getItem/setItem).
function installLocalStorageStub() {
  const store = new Map<string, string>()
  const stub: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => void store.set(key, value),
    removeItem: (key) => void store.delete(key),
    clear: () => store.clear(),
    key: (i) => [...store.keys()][i] ?? null,
    get length() {
      return store.size
    },
  }
  ;(globalThis as { localStorage: Storage }).localStorage = stub
  return stub
}

const baseState = (): AppState => ({
  stores: [],
  operations: [],
  credentials: [
    {
      id: 'cred-1',
      name: 'Ozon кабинет',
      storeId: 'store-1',
      marketplace: 'ozon',
      clientId: '111',
      apiKey: 'sk-live-secret',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ],
})

describe('storage: шифрование credentials на границе персистентности', () => {
  beforeEach(() => {
    installLocalStorageStub()
    setSessionCredentialsKey(null)
  })

  it('без активного ключа сессии сохраняет credentials как раньше (в открытом виде)', async () => {
    const state = baseState()
    const persisted = await buildPersistedState(state)
    expect(persisted.credentials[0].apiKey).toBe('sk-live-secret')
    expect(persisted.credentials[0].secret).toBeUndefined()
  })

  it('с активным ключом сессии шифрует apiKey/clientId и не пишет их в открытом виде', async () => {
    const salt = generateCredentialsSalt()
    const key = await deriveCredentialsKey('my-passphrase', salt)
    setSessionCredentialsKey(key)

    const state = { ...baseState(), credentialsSalt: salt }
    const persisted = await buildPersistedState(state)

    expect(persisted.credentials[0].apiKey).toBe('')
    expect(persisted.credentials[0].clientId).toBe('')
    expect(persisted.credentials[0].secret).toBeTruthy()
    expect(JSON.stringify(persisted)).not.toContain('sk-live-secret')

    // Исходный объект state (React-стейт в памяти) не мутирован —
    // расшифрованные значения остаются доступны UI.
    expect(state.credentials[0].apiKey).toBe('sk-live-secret')
  })

  it('saveState -> loadState: с ключом на диске остаётся только шифротекст', async () => {
    const salt = generateCredentialsSalt()
    const key = await deriveCredentialsKey('my-passphrase', salt)
    setSessionCredentialsKey(key)

    await saveState({ ...baseState(), credentialsSalt: salt })
    const reloaded = loadState()

    expect(reloaded.credentials[0].apiKey).toBe('')
    expect(reloaded.credentials[0].secret).toBeTruthy()
  })

  it('быстрые последовательные saveState применяются в порядке вызова (без гонки)', async () => {
    const first = { ...baseState(), credentials: [{ ...baseState().credentials[0], name: 'A' }] }
    const second = { ...baseState(), credentials: [{ ...baseState().credentials[0], name: 'B' }] }

    // Не ждём первый вызов — оба «в полёте» одновременно, как при быстром вводе в UI.
    const p1 = saveState(first)
    const p2 = saveState(second)
    await Promise.all([p1, p2])

    expect(loadState().credentials[0].name).toBe('B')
  })
})

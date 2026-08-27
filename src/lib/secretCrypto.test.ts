import { describe, expect, it } from 'vitest'
import {
  decryptSecret,
  deriveCredentialsKey,
  encryptSecret,
  generateCredentialsSalt,
  getSessionCredentialsKey,
  isCredentialsUnlocked,
  setSessionCredentialsKey,
} from './secretCrypto'

describe('шифрование API-ключей (secretCrypto)', () => {
  it('шифрует и расшифровывает произвольный объект правильным паролем', async () => {
    const salt = generateCredentialsSalt()
    const key = await deriveCredentialsKey('correct horse battery staple', salt)
    const payload = { clientId: '12345', apiKey: 'sk-secret-value' }

    const secret = await encryptSecret(payload, key)
    expect(secret.iv).toBeTruthy()
    expect(secret.ciphertext).toBeTruthy()
    // Ciphertext не должен содержать исходный секрет как есть.
    expect(secret.ciphertext).not.toContain('sk-secret-value')

    const decrypted = await decryptSecret<typeof payload>(secret, key)
    expect(decrypted).toEqual(payload)
  })

  it('не расшифровывается неверным паролем', async () => {
    const salt = generateCredentialsSalt()
    const rightKey = await deriveCredentialsKey('right-password', salt)
    const wrongKey = await deriveCredentialsKey('wrong-password', salt)
    const secret = await encryptSecret({ apiKey: 'top-secret' }, rightKey)

    await expect(decryptSecret(secret, wrongKey)).rejects.toThrow()
  })

  it('не расшифровывается тем же паролем, но другой солью', async () => {
    const key1 = await deriveCredentialsKey('same-password', generateCredentialsSalt())
    const key2 = await deriveCredentialsKey('same-password', generateCredentialsSalt())
    const secret = await encryptSecret({ apiKey: 'x' }, key1)

    await expect(decryptSecret(secret, key2)).rejects.toThrow()
  })

  it('каждое шифрование использует свой IV даже для одинаковых данных', async () => {
    const key = await deriveCredentialsKey('pw', generateCredentialsSalt())
    const a = await encryptSecret({ apiKey: 'same' }, key)
    const b = await encryptSecret({ apiKey: 'same' }, key)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('ключ сессии живёт только в памяти модуля до явной установки/сброса', async () => {
    expect(isCredentialsUnlocked()).toBe(false)
    const key = await deriveCredentialsKey('pw', generateCredentialsSalt())
    setSessionCredentialsKey(key)
    expect(isCredentialsUnlocked()).toBe(true)
    expect(getSessionCredentialsKey()).toBe(key)
    setSessionCredentialsKey(null)
    expect(isCredentialsUnlocked()).toBe(false)
  })
})

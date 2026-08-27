/**
 * Шифрование API-ключей маркетплейсов перед тем, как они лягут в localStorage.
 *
 * Модель угрозы: сегодня ключи лежат в localStorage открытым текстом — их
 * может прочитать что угодно, что имеет доступ к localStorage приложения
 * (DevTools, расширение браузера, физический доступ к профилю браузера,
 * случайно найденный экспорт до фикса "не включать ключи в backup").
 * Эта защита не спасает от активного XSS в самом приложении (пока вкладка
 * разблокирована, расшифрованные ключи всё равно лежат в памяти React-стейта
 * и участвуют в fetch-запросах) — но закрывает "пассивное" чтение хранилища.
 *
 * Механизм: PBKDF2(пароль пользователя, соль) → AES-GCM 256.
 * Пароль нигде не сохраняется. Производный CryptoKey живёт только в памяти
 * вкладки (session-модуль ниже) — после перезагрузки страницы нужно ввести
 * пароль заново, чтобы расшифровать сохранённые ключи.
 */
import type { EncryptedSecret } from '@/types'

const PBKDF2_ITERATIONS = 250_000
const SALT_BYTES = 16
const IV_BYTES = 12

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** Разовая соль на всю "базу" credentials этого браузера. Не секрет — как и
 * положено соли для PBKDF2, хранится рядом с данными в открытом виде. */
export function generateCredentialsSalt(): string {
  return toBase64(randomBytes(SALT_BYTES))
}

/** Разворачивает пароль пользователя + соль в AES-GCM ключ. Это единственная
 * дорогая операция (250k итераций PBKDF2) — делать её на каждое сохранение
 * не нужно, результат кэшируется в памяти сессии (см. ниже). */
export async function deriveCredentialsKey(
  passphrase: string,
  saltBase64: string,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: fromBase64(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(value: unknown, key: CryptoKey): Promise<EncryptedSecret> {
  const iv = randomBytes(IV_BYTES)
  const plaintext = new TextEncoder().encode(JSON.stringify(value))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext)
  return { iv: toBase64(iv), ciphertext: toBase64(new Uint8Array(ciphertext)) }
}

/** Бросает исключение (DOMException OperationError), если пароль неверный —
 * AES-GCM проверяет целостность и не расшифрует чем-то кроме исходного ключа. */
export async function decryptSecret<T>(secret: EncryptedSecret, key: CryptoKey): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(secret.iv) },
    key,
    fromBase64(secret.ciphertext),
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}

// --- Ключ сессии текущей вкладки: намеренно НЕ персистится нигде. ---
let sessionKey: CryptoKey | null = null

export function setSessionCredentialsKey(key: CryptoKey | null) {
  sessionKey = key
}

export function getSessionCredentialsKey(): CryptoKey | null {
  return sessionKey
}

export function isCredentialsUnlocked(): boolean {
  return sessionKey !== null
}

import { createCipheriv, createDecipheriv, createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const VERSION = 'v1'
const scrypt = promisify(scryptCallback)
const PASSWORD_VERSION = 's1'
const SCRYPT_KEY_LENGTH = 32

export function hashSessionToken(token) {
  if (!token || typeof token !== 'string') throw new Error('Session token is required')
  return createHash('sha256').update(token, 'utf8').digest('hex')
}

export function generateSessionToken() {
  return randomBytes(32).toString('base64url')
}

export function parseEncryptionKey(encoded = process.env.CREDENTIALS_ENCRYPTION_KEY) {
  if (!encoded) throw new Error('CREDENTIALS_ENCRYPTION_KEY is required')
  const key = Buffer.from(encoded, 'base64')
  if (key.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes encoded as base64')
  return key
}

export function encryptCredentials(credentials, key = parseEncryptionKey()) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(VERSION))
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return [VERSION, iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.')
}

export function decryptCredentials(payload, key = parseEncryptionKey()) {
  const [version, ivPart, tagPart, ciphertextPart, extra] = String(payload).split('.')
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart || extra) {
    throw new Error('Unsupported encrypted credentials payload')
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
  decipher.setAAD(Buffer.from(VERSION))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ])
  return JSON.parse(plaintext.toString('utf8'))
}

export function secretMatches(left, right) {
  const a = Buffer.from(String(left))
  const b = Buffer.from(String(right))
  return a.length === b.length && timingSafeEqual(a, b)
}

export function externalAccountHint(clientId) {
  const value = String(clientId ?? '').trim()
  if (!value) return null
  return value.length <= 4 ? '*'.repeat(value.length) : `${'*'.repeat(value.length - 4)}${value.slice(-4)}`
}

export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 1024) {
    throw new Error('Password must contain between 12 and 1024 characters')
  }
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, SCRYPT_KEY_LENGTH)
  return [PASSWORD_VERSION, salt.toString('base64url'), Buffer.from(derived).toString('base64url')].join('.')
}

export async function verifyPassword(password, encoded) {
  try {
    const [version, saltPart, hashPart, extra] = String(encoded).split('.')
    if (version !== PASSWORD_VERSION || !saltPart || !hashPart || extra) return false
    const expected = Buffer.from(hashPart, 'base64url')
    if (expected.length !== SCRYPT_KEY_LENGTH) return false
    const actual = Buffer.from(await scrypt(String(password), Buffer.from(saltPart, 'base64url'), expected.length))
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function requestFingerprint(value) {
  if (!value) return null
  return createHash('sha256').update(String(value)).digest('hex')
}

export function networkPrefix(value) {
  const address = String(value ?? '').replace(/^::ffff:/, '')
  if (!address) return null
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(address)) return `${address.split('.').slice(0, 3).join('.')}.0/24`
  if (address.includes(':')) return `${address.split(':').slice(0, 4).join(':')}::/64`
  return null
}

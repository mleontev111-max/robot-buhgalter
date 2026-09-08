import { describe, expect, it } from 'vitest'
import { decryptCredentials, encryptCredentials, externalAccountHint, generateSessionToken, hashPassword, hashSessionToken, networkPrefix, verifyPassword } from './security.mjs'
import { can, requireOrganizationAccess } from './tenancy.mjs'

const key = Buffer.alloc(32, 7)

describe('production credential security', () => {
  it('encrypts credentials with authenticated encryption', () => {
    const secret = { clientId: '12345678', apiKey: 'super-secret' }
    const payload = encryptCredentials(secret, key)
    expect(payload).not.toContain(secret.apiKey)
    expect(decryptCredentials(payload, key)).toEqual(secret)
  })

  it('rejects tampered ciphertext', () => {
    const payload = encryptCredentials({ apiKey: 'secret' }, key)
    const parts = payload.split('.')
    const tag = Buffer.from(parts[2], 'base64url')
    tag[0] ^= 1
    parts[2] = tag.toString('base64url')
    expect(() => decryptCredentials(parts.join('.'), key)).toThrow()
  })

  it('stores only hashes of high-entropy session tokens', () => {
    const token = generateSessionToken()
    expect(token.length).toBeGreaterThan(32)
    expect(hashSessionToken(token)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashSessionToken(token)).not.toContain(token)
  })

  it('exposes only a masked external account hint', () => {
    expect(externalAccountHint('12345678')).toBe('****5678')
  })
})

describe('tenant authorization', () => {
  const principal = {
    userId: 'user-1',
    memberships: [
      { organizationId: 'org-owner', role: 'owner' },
      { organizationId: 'org-viewer', role: 'viewer' },
    ],
  }

  it('allows actions granted by the membership role', () => {
    expect(requireOrganizationAccess(principal, 'org-owner', 'manage_accounts').role).toBe('owner')
    expect(can('viewer', 'read')).toBe(true)
  })

  it('denies cross-tenant and excessive access', () => {
    expect(() => requireOrganizationAccess(principal, 'another-org', 'read')).toThrow('access denied')
    expect(() => requireOrganizationAccess(principal, 'org-viewer', 'manage_accounts')).toThrow('access denied')
  })
})

describe('password authentication', () => {
  it('hashes and verifies passwords without storing plaintext', async () => {
    const password = 'correct horse battery staple'
    const encoded = await hashPassword(password)
    expect(encoded).not.toContain(password)
    expect(await verifyPassword(password, encoded)).toBe(true)
    expect(await verifyPassword('wrong password', encoded)).toBe(false)
  })

  it('uses a unique salt for each password hash', async () => {
    const password = 'another sufficiently long password'
    expect(await hashPassword(password)).not.toBe(await hashPassword(password))
  })

  it('rejects short passwords at creation time', async () => {
    await expect(hashPassword('short')).rejects.toThrow('between 12 and 1024')
  })

  it('stores a network prefix instead of a full client IP', () => {
    expect(networkPrefix('192.0.2.123')).toBe('192.0.2.0/24')
    expect(networkPrefix('2001:db8:1234:5678:abcd::1')).toBe('2001:db8:1234:5678::/64')
  })
})

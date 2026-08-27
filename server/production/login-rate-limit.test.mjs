import { beforeEach, describe, expect, it } from 'vitest'
import { clearLoginAttempts, consumeLoginAttempt, resetLoginRateLimitsForTests } from './login-rate-limit.mjs'

describe('login rate limiting', () => {
  beforeEach(() => resetLoginRateLimitsForTests())

  it('blocks attempts after the configured limit', () => {
    const key = 'test-ip:user@example.test'
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(consumeLoginAttempt(key, 1_000).allowed).toBe(true)
    }
    const blocked = consumeLoginAttempt(key, 1_000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(900)
  })

  it('resets after success or window expiration', () => {
    const key = 'test-ip:user@example.test'
    consumeLoginAttempt(key, 1_000)
    clearLoginAttempts(key)
    expect(consumeLoginAttempt(key, 1_001).allowed).toBe(true)

    for (let attempt = 0; attempt < 5; attempt += 1) consumeLoginAttempt(key, 1_001)
    expect(consumeLoginAttempt(key, 1_001 + 15 * 60 * 1_000).allowed).toBe(true)
  })
})

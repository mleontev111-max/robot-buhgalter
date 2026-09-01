const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5
const attempts = new Map()

export function loginRateLimitKey(req, email) {
  return `${req.ip ?? req.socket?.remoteAddress ?? 'unknown'}:${String(email).trim().toLowerCase()}`
}

export function consumeLoginAttempt(key, now = Date.now()) {
  const current = attempts.get(key)
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  current.count += 1
  if (current.count <= MAX_ATTEMPTS) return { allowed: true, retryAfterSeconds: 0 }
  return { allowed: false, retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000) }
}

export function clearLoginAttempts(key) {
  attempts.delete(key)
}

export function resetLoginRateLimitsForTests() {
  attempts.clear()
}

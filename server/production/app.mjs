import express from 'express'
import { z } from 'zod'
import { authenticate } from './auth.mjs'
import { principalTransaction, query } from './db.mjs'
import { encryptCredentials, externalAccountHint, generateSessionToken, hashSessionToken, networkPrefix, requestFingerprint, verifyPassword } from './security.mjs'
import { requireOrganizationAccess } from './tenancy.mjs'
import { clearLoginAttempts, consumeLoginAttempt, loginRateLimitKey } from './login-rate-limit.mjs'

const marketplaceAccountInput = z.object({
  salesChannelId: z.string().uuid(),
  marketplace: z.enum(['ozon', 'wb', 'yandex', 'avito']),
  name: z.string().trim().min(1).max(120),
  clientId: z.string().max(300).default(''),
  apiKey: z.string().min(1).max(4000),
})

const loginInput = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(1).max(1024),
})

const invalidLoginHash = 's1.AAAAAAAAAAAAAAAAAAAAAA.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

export function createProductionApp() {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '256kb' }))

  app.get('/health', (_req, res) => res.json({ ok: true, service: 'robot-buhgalter-api' }))
  app.get('/ready', async (_req, res, next) => {
    try {
      await query('SELECT 1')
      res.json({ ok: true, database: 'ready' })
    } catch (error) { next(error) }
  })

  app.post('/auth/login', async (req, res, next) => {
    try {
      const input = loginInput.parse(req.body)
      const rateLimitKey = loginRateLimitKey(req, input.email)
      const limit = consumeLoginAttempt(rateLimitKey)
      if (!limit.allowed) {
        res.set('Retry-After', String(limit.retryAfterSeconds))
        return res.status(429).json({ ok: false, error: 'Too many login attempts' })
      }
      const found = await query(
        `SELECT u.id, u.email, p.password_hash
         FROM users u JOIN password_credentials p ON p.user_id = u.id
         WHERE u.email = $1 AND u.status = 'active'`, [input.email],
      )
      const credential = found.rows[0]
      const valid = await verifyPassword(input.password, credential?.password_hash ?? invalidLoginHash)
      if (!credential || !valid) return res.status(401).json({ ok: false, error: 'Invalid email or password' })

      const token = generateSessionToken()
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000)
      await query(
        `INSERT INTO sessions (user_id, token_hash, expires_at, user_agent_hash, ip_prefix)
         VALUES ($1, $2, $3, $4, $5)`,
        [credential.id, hashSessionToken(token), expiresAt, requestFingerprint(req.get('user-agent')), networkPrefix(req.ip)],
      )
      clearLoginAttempts(rateLimitKey)
      res.set('Cache-Control', 'no-store')
      return res.json({ ok: true, token, tokenType: 'Bearer', expiresAt: expiresAt.toISOString() })
    } catch (error) { next(error) }
  })

  app.use('/v1', authenticate)

  app.post('/v1/auth/logout', async (req, res, next) => {
    try {
      await query('UPDATE sessions SET revoked_at = now() WHERE token_hash = $1', [req.sessionTokenHash])
      res.set('Cache-Control', 'no-store')
      res.status(204).end()
    } catch (error) { next(error) }
  })

  app.get('/v1/organizations', async (req, res, next) => {
    try {
      const result = await principalTransaction(req.principal.userId, (client) => client.query(
        `SELECT o.id, o.name, o.legal_form, o.status, m.role
         FROM organizations o
         JOIN organization_memberships m ON m.organization_id = o.id
         WHERE m.user_id = $1 ORDER BY o.name`, [req.principal.userId],
      ))
      res.json({ ok: true, organizations: result.rows })
    } catch (error) { next(error) }
  })

  app.get('/v1/organizations/:organizationId/marketplace-accounts', async (req, res, next) => {
    try {
      requireOrganizationAccess(req.principal, req.params.organizationId, 'read')
      const result = await principalTransaction(req.principal.userId, (client) => client.query(
        `SELECT id, sales_channel_id, marketplace, name, external_account_hint,
                credentials_key_version, created_at, updated_at
         FROM marketplace_accounts WHERE organization_id = $1 ORDER BY name`,
        [req.params.organizationId],
      ))
      res.json({ ok: true, accounts: result.rows })
    } catch (error) { next(error) }
  })

  app.post('/v1/organizations/:organizationId/marketplace-accounts', async (req, res, next) => {
    try {
      const organizationId = req.params.organizationId
      requireOrganizationAccess(req.principal, organizationId, 'manage_accounts')
      const input = marketplaceAccountInput.parse(req.body)
      const encrypted = encryptCredentials({ clientId: input.clientId, apiKey: input.apiKey })
      const account = await principalTransaction(req.principal.userId, async (client) => {
        const result = await client.query(
          `INSERT INTO marketplace_accounts
             (organization_id, sales_channel_id, marketplace, name, external_account_hint, encrypted_credentials)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, sales_channel_id, marketplace, name, external_account_hint,
                     credentials_key_version, created_at, updated_at`,
          [organizationId, input.salesChannelId, input.marketplace, input.name, externalAccountHint(input.clientId), encrypted],
        )
        await client.query(
          `INSERT INTO audit_events (organization_id, actor_user_id, action, target_type, target_id)
           VALUES ($1, $2, 'marketplace_account.created', 'marketplace_account', $3)`,
          [organizationId, req.principal.userId, result.rows[0].id],
        )
        return result.rows[0]
      })
      res.status(201).json({ ok: true, account })
    } catch (error) { next(error) }
  })

  app.use((error, _req, res, _next) => {
    if (error instanceof z.ZodError) return res.status(400).json({ ok: false, error: 'Invalid request', issues: error.issues })
    const status = Number(error.status) || 500
    if (status >= 500) console.error(error)
    return res.status(status).json({ ok: false, error: status >= 500 ? 'Internal server error' : error.message })
  })

  return app
}

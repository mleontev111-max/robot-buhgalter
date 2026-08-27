import { query } from './db.mjs'
import { hashSessionToken } from './security.mjs'

function bearerToken(header) {
  const match = /^Bearer\s+(.+)$/i.exec(header ?? '')
  return match?.[1]
}

export async function authenticate(req, res, next) {
  try {
    const token = bearerToken(req.headers.authorization)
    if (!token) return res.status(401).json({ ok: false, error: 'Authentication required' })
    const result = await query(
      `SELECT s.user_id, u.email, m.organization_id, m.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id AND u.status = 'active'
       LEFT JOIN organization_memberships m ON m.user_id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
      [hashSessionToken(token)],
    )
    if (!result.rows.length) return res.status(401).json({ ok: false, error: 'Invalid or expired session' })
    req.principal = {
      userId: result.rows[0].user_id,
      email: result.rows[0].email,
      memberships: result.rows
        .filter((row) => row.organization_id)
        .map((row) => ({ organizationId: row.organization_id, role: row.role })),
    }
    req.sessionTokenHash = hashSessionToken(token)
    await query('UPDATE sessions SET last_seen_at = now() WHERE token_hash = $1', [hashSessionToken(token)])
    next()
  } catch (error) {
    next(error)
  }
}

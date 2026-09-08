import { z } from 'zod'
import { query } from './db.mjs'
import { hashPassword } from './security.mjs'

const input = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  password: z.string().min(12).max(1024),
  displayName: z.string().trim().min(1).max(120),
  organizationName: z.string().trim().min(1).max(200),
  legalForm: z.enum(['ip', 'ooo']),
}).parse({
  email: process.env.BOOTSTRAP_EMAIL,
  password: process.env.BOOTSTRAP_PASSWORD,
  displayName: process.env.BOOTSTRAP_DISPLAY_NAME,
  organizationName: process.env.BOOTSTRAP_ORGANIZATION_NAME,
  legalForm: process.env.BOOTSTRAP_LEGAL_FORM,
})

const passwordHash = await hashPassword(input.password)

const result = await query(
  `SELECT user_id, organization_id
   FROM bootstrap_initial_owner($1, $2, $3, $4, $5)`,
  [input.email, input.displayName, input.legalForm, input.organizationName, passwordHash],
)
const created = { userId: result.rows[0].user_id, organizationId: result.rows[0].organization_id }

console.log(`Bootstrap owner created: user=${created.userId}, organization=${created.organizationId}`)

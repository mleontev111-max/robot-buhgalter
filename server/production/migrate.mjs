import { readFile, readdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getPool } from './db.mjs'

const directory = join(dirname(fileURLToPath(import.meta.url)), 'migrations')
const pool = await getPool()
await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
  name text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
)`)

for (const name of (await readdir(directory)).filter((item) => item.endsWith('.sql')).sort()) {
  const applied = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name])
  if (applied.rowCount) continue
  const sql = await readFile(join(directory, name), 'utf8')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name])
    await client.query('COMMIT')
    console.log(`Applied migration ${name}`)
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

await pool.end()

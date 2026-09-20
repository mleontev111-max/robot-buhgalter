let pool

export async function getPool() {
  if (pool) return pool
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  let pg
  try {
    pg = await import('pg')
  } catch {
    throw new Error('PostgreSQL driver is missing. Install the "pg" package before starting production backend.')
  }
  pool = new pg.default.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_SSL === 'disable' ? false : { rejectUnauthorized: true },
    max: Number(process.env.DATABASE_POOL_SIZE ?? 10),
  })
  return pool
}

export async function query(text, values = []) {
  return (await getPool()).query(text, values)
}

export async function transaction(work) {
  const client = await (await getPool()).connect()
  try {
    await client.query('BEGIN')
    const result = await work(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function principalTransaction(userId, work) {
  return transaction(async (client) => {
    await client.query("SELECT set_config('app.user_id', $1, true)", [userId])
    return work(client)
  })
}

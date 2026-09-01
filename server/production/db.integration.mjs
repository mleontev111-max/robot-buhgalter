import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { randomBytes } from 'node:crypto'
import { tmpdir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import pg from 'pg'
import { hashPassword } from './security.mjs'

// Self-relative, like migrate.mjs's own directory lookup — so this script
// works whether it's invoked as `node server/production/db.integration.mjs`
// from the repo root (as documented) or as `npm run test:db` from inside
// server/production/ (where npm sets CWD to the package directory).
const here = dirname(fileURLToPath(import.meta.url))
const migrateScript = join(here, 'migrate.mjs')
const appRoleGrantsSql = join(here, 'sql/app-role-grants.sql')

const suffix = randomBytes(5).toString('hex')
const container = `robot-buhgalter-pg-test-${suffix}`
const apiContainer = `robot-buhgalter-api-test-${suffix}`
const password = `test-${randomBytes(16).toString('hex')}`
const image = process.env.POSTGRES_TEST_IMAGE ?? 'postgres:16-alpine'
const testMode = process.env.POSTGRES_TEST_MODE ?? 'docker'
let localDataDirectory
let localPostgresStarted = false

const runDocker = (...args) => execFileSync('docker', args, { encoding: 'utf8' }).trim()
const assert = (condition, message) => {
  if (!condition) throw new Error(message)
}

async function waitForDatabase(connectionString) {
  let lastError
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const client = new pg.Client({ connectionString })
    try {
      await client.connect()
      await client.query('SELECT 1')
      await client.end()
      return
    } catch (error) {
      lastError = error
      await client.end().catch(() => {})
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw lastError
}

try {
  let port
  let adminUrl
  if (testMode === 'local') {
    localDataDirectory = await mkdtemp(join(tmpdir(), 'robot-buhgalter-pg-test-'))
    port = String(55_000 + Math.floor(Math.random() * 5_000))
    execFileSync(
      'initdb',
      ['--pgdata', localDataDirectory, '--auth', 'trust', '--username', 'postgres', '--set', 'dynamic_shared_memory_type=mmap'],
      { stdio: 'ignore' },
    )
    execFileSync('pg_ctl', ['--pgdata', localDataDirectory, '--options', `-h 127.0.0.1 -p ${port}`, '--wait', 'start'], { stdio: 'ignore' })
    localPostgresStarted = true
    const maintenanceUrl = `postgresql://postgres@127.0.0.1:${port}/postgres`
    await waitForDatabase(maintenanceUrl)
    const maintenance = new pg.Client({ connectionString: maintenanceUrl })
    await maintenance.connect()
    await maintenance.query('CREATE DATABASE robot_buhgalter')
    await maintenance.end()
    adminUrl = `postgresql://postgres@127.0.0.1:${port}/robot_buhgalter`
  } else {
    const id = runDocker(
      'run', '--detach', '--name', container,
      '--env', `POSTGRES_PASSWORD=${password}`,
      '--env', 'POSTGRES_DB=robot_buhgalter',
      '--publish', '127.0.0.1::5432',
      image,
    )
    assert(id, 'Disposable PostgreSQL container did not start')
    const portOutput = runDocker('port', container, '5432/tcp')
    port = portOutput.match(/:(\d+)$/)?.[1]
    assert(port, `Cannot determine PostgreSQL port from: ${portOutput}`)
    adminUrl = `postgresql://postgres:${password}@127.0.0.1:${port}/robot_buhgalter`
  }
  await waitForDatabase(adminUrl)

  const migrationEnv = { ...process.env, DATABASE_URL: adminUrl, DATABASE_SSL: 'disable' }
  execFileSync(process.execPath, [migrateScript], { stdio: 'inherit', env: migrationEnv })
  execFileSync(process.execPath, [migrateScript], { stdio: 'inherit', env: migrationEnv })

  const admin = new pg.Pool({ connectionString: adminUrl })
  const appPassword = `app-${randomBytes(16).toString('hex')}`
  await admin.query(`CREATE ROLE robot_buhgalter_app LOGIN PASSWORD '${appPassword}'`)
  await admin.query(await readFile(appRoleGrantsSql, 'utf8'))

  const bootstrap = await admin.connect()
  try {
    await bootstrap.query('BEGIN')
    const firstOwner = await bootstrap.query(
      `SELECT * FROM bootstrap_initial_owner($1, $2, $3, $4, $5)`,
      ['bootstrap@example.test', 'Bootstrap Owner', 'ip', 'Bootstrap Organization', 'test-password-hash'],
    )
    assert(firstOwner.rowCount === 1, 'Initial owner bootstrap did not create exactly one owner')
    let repeatedBootstrapRejected = false
    try {
      await bootstrap.query(
        `SELECT * FROM bootstrap_initial_owner($1, $2, $3, $4, $5)`,
        ['second@example.test', 'Second Owner', 'ip', 'Second Organization', 'test-password-hash'],
      )
    } catch {
      repeatedBootstrapRejected = true
    }
    assert(repeatedBootstrapRejected, 'Repeated initial owner bootstrap was not rejected')
    await bootstrap.query('ROLLBACK')
  } finally {
    bootstrap.release()
  }

  const userA = '10000000-0000-4000-8000-000000000001'
  const userB = '10000000-0000-4000-8000-000000000002'
  const orgA = '20000000-0000-4000-8000-000000000001'
  const orgB = '20000000-0000-4000-8000-000000000002'
  const taxA = '30000000-0000-4000-8000-000000000001'
  const taxB = '30000000-0000-4000-8000-000000000002'
  const unitA = '40000000-0000-4000-8000-000000000001'
  const unitB = '40000000-0000-4000-8000-000000000002'
  const channelA = '50000000-0000-4000-8000-000000000001'
  const channelB = '50000000-0000-4000-8000-000000000002'
  const loginPassword = 'integration test password'
  const loginPasswordHash = await hashPassword(loginPassword)

  const seed = await admin.connect()
  await seed.query('BEGIN')
  try {
    await seed.query(
      `INSERT INTO users (id, email, display_name) VALUES
       ($1, 'a@example.test', 'A'), ($2, 'b@example.test', 'B')`, [userA, userB],
    )
    await seed.query(
      `INSERT INTO organizations (id, legal_form, name) VALUES
       ($1, 'ip', 'Organization A'), ($2, 'ip', 'Organization B')`, [orgA, orgB],
    )
    await seed.query(
      `INSERT INTO organization_memberships (organization_id, user_id, role) VALUES
       ($1, $2, 'owner'), ($3, $4, 'viewer')`, [orgA, userA, orgB, userB],
    )
    await seed.query(
      `INSERT INTO password_credentials (user_id, password_hash) VALUES ($1, $2)`,
      [userA, loginPasswordHash],
    )
    await seed.query(
      `INSERT INTO tax_registrations (id, organization_id, regime, valid_from) VALUES
       ($1, $2, 'usn6', '2026-01-01'), ($3, $4, 'usn6', '2026-01-01')`, [taxA, orgA, taxB, orgB],
    )
    await seed.query(
      `INSERT INTO business_units (id, organization_id, name, unit_type) VALUES
       ($1, $2, 'Unit A', 'online_store'), ($3, $4, 'Unit B', 'online_store')`, [unitA, orgA, unitB, orgB],
    )
    await seed.query(
      `INSERT INTO sales_channels
         (id, organization_id, business_unit_id, marketplace, name, channel_type, source_type) VALUES
       ($1, $2, $3, 'ozon', 'Ozon A', 'marketplace', 'marketplace_api'),
       ($4, $5, $6, 'ozon', 'Ozon B', 'marketplace', 'marketplace_api')`,
      [channelA, orgA, unitA, channelB, orgB, unitB],
    )
    await seed.query(
      `INSERT INTO operations
         (organization_id, business_unit_id, sales_channel_id, tax_registration_id, source_type,
          external_operation_id, operation_date, revenue) VALUES
       ($1, $2, $3, $4, 'marketplace_api', 'external-a', '2026-01-10', 100),
       ($5, $6, $7, $8, 'marketplace_api', 'external-b', '2026-01-10', 200)`,
      [orgA, unitA, channelA, taxA, orgB, unitB, channelB, taxB],
    )
    await seed.query('COMMIT')
  } catch (error) {
    await seed.query('ROLLBACK')
    throw error
  } finally {
    seed.release()
  }

  const appUrl = `postgresql://robot_buhgalter_app:${appPassword}@127.0.0.1:${port}/robot_buhgalter`
  const app = new pg.Pool({ connectionString: appUrl })

  if (process.env.ROBOT_BUHGALTER_TEST_IMAGE && testMode === 'docker') {
    const containerDatabaseUrl = `postgresql://robot_buhgalter_app:${appPassword}@127.0.0.1:5432/robot_buhgalter`
    runDocker(
      'run', '--detach', '--name', apiContainer,
      '--network', `container:${container}`,
      '--env', `DATABASE_URL=${containerDatabaseUrl}`,
      '--env', 'DATABASE_SSL=disable',
      '--env', `CREDENTIALS_ENCRYPTION_KEY=${Buffer.alloc(32, 9).toString('base64')}`,
      process.env.ROBOT_BUHGALTER_TEST_IMAGE,
    )
    let ready = false
    for (let attempt = 0; attempt < 30; attempt += 1) {
      try {
        runDocker(
          'exec', apiContainer, 'node', '-e',
          "fetch('http://127.0.0.1:8788/ready').then(async r=>{if(!r.ok)throw new Error(await r.text())}).catch(()=>process.exit(1))",
        )
        ready = true
        break
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    assert(ready, 'Backend image did not become database-ready')
    runDocker(
      'exec', apiContainer, 'node', '--input-type=module', '-e',
      `const base='http://127.0.0.1:8788';
       const login=await fetch(base+'/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'a@example.test',password:'${loginPassword}'})});
       const auth=await login.json(); if(!login.ok||!auth.token)process.exit(1);
       const headers={authorization:'Bearer '+auth.token};
       const organizations=await fetch(base+'/v1/organizations',{headers});
       const body=await organizations.json(); if(!organizations.ok||body.organizations?.length!==1||body.organizations[0].id!=='${orgA}')process.exit(2);
       const logout=await fetch(base+'/v1/auth/logout',{method:'POST',headers}); if(logout.status!==204)process.exit(3);
       const revoked=await fetch(base+'/v1/organizations',{headers}); if(revoked.status!==401)process.exit(4);`,
    )
  }

  const clientA = await app.connect()
  try {
    await clientA.query('BEGIN')
    await clientA.query("SELECT set_config('app.user_id', $1, true)", [userA])
    const visible = await clientA.query('SELECT organization_id, revenue FROM operations ORDER BY revenue')
    assert(visible.rowCount === 1, `User A must see exactly one operation, saw ${visible.rowCount}`)
    assert(visible.rows[0].organization_id === orgA, 'User A saw another tenant operation')

    const otherTenant = await clientA.query('SELECT id FROM organizations WHERE id = $1', [orgB])
    assert(otherTenant.rowCount === 0, 'User A can read organization B')

    let duplicateRejected = false
    try {
      await clientA.query(
        `INSERT INTO operations
           (organization_id, business_unit_id, sales_channel_id, tax_registration_id,
            source_type, external_operation_id, operation_date, revenue)
         VALUES ($1, $2, $3, $4, 'marketplace_api', 'external-a', '2026-01-12', 999)`,
        [orgA, unitA, channelA, taxA],
      )
    } catch {
      duplicateRejected = true
    }
    assert(duplicateRejected, 'Duplicate marketplace operation was not rejected')
    await clientA.query('ROLLBACK')

    await clientA.query('BEGIN')
    await clientA.query("SELECT set_config('app.user_id', $1, true)", [userA])

    let crossTenantRejected = false
    try {
      await clientA.query(
        `INSERT INTO operations
           (organization_id, business_unit_id, sales_channel_id, tax_registration_id,
            source_type, external_operation_id, operation_date, revenue)
         VALUES ($1, $2, $3, $4, 'marketplace_api', 'cross-tenant', '2026-01-11', 1)`,
        [orgA, unitA, channelB, taxA],
      )
    } catch {
      crossTenantRejected = true
    }
    assert(crossTenantRejected, 'Cross-tenant foreign key was not rejected')
    await clientA.query('ROLLBACK')
  } finally {
    clientA.release()
  }

  const clientB = await app.connect()
  try {
    await clientB.query('BEGIN')
    await clientB.query("SELECT set_config('app.user_id', $1, true)", [userB])
    let viewerWriteRejected = false
    try {
      await clientB.query(
        `INSERT INTO tax_payments (organization_id, tax_registration_id, payment_kind, amount, paid_at)
         VALUES ($1, $2, 'usn', 1, '2026-01-20')`,
        [orgB, taxB],
      )
    } catch {
      viewerWriteRejected = true
    }
    assert(viewerWriteRejected, 'Viewer write was not rejected by RLS')
    await clientB.query('ROLLBACK')
  } finally {
    clientB.release()
  }

  await app.end()
  await admin.end()
  console.log('PostgreSQL integration checks passed: migrations, auth lifecycle, RLS, roles and tenant foreign keys')
} finally {
  if (testMode === 'local' && localDataDirectory) {
    try {
      if (localPostgresStarted) {
        execFileSync('pg_ctl', ['--pgdata', localDataDirectory, '--mode', 'fast', '--wait', 'stop'], { stdio: 'ignore' })
      }
    } finally {
      await rm(localDataDirectory, { recursive: true, force: true })
    }
  } else {
    try {
      runDocker('rm', '--force', apiContainer)
    } catch {
      // The API container may not have been created.
    }
    try {
      runDocker('rm', '--force', container)
    } catch {
      // The container may not have been created.
    }
  }
}

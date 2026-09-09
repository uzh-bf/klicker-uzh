const { createRequire } = require('node:module')
const path = require('node:path')

function connectionConfig(env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.CI !== 'true') {
    throw new Error('Disposable database provisioning requires a CI shard')
  }

  // This is the shard's private service, never a caller-provided database URL
  // or a loopback port that might forward to another environment.
  return {
    host: 'postgres',
    port: 5432,
    user: 'klicker-prod',
    password: 'klicker',
    database: 'klicker-prod',
    ssl: false,
    options: '',
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
    query_timeout: 15000,
  }
}

async function provisionDatabase(client) {
  try {
    await client.connect()
    const { rows } = await client.query(`
      SELECT current_database() AS database,
             session_user AS login, current_user AS role,
             EXISTS (SELECT FROM pg_roles WHERE rolname = 'klicker_test') AS role_exists,
             EXISTS (SELECT FROM pg_database WHERE datname = 'klicker_test') AS database_exists
    `)
    const identity = rows[0]
    if (
      rows.length !== 1 ||
      identity.database !== 'klicker-prod' ||
      identity.login !== 'klicker-prod' ||
      identity.role !== 'klicker-prod' ||
      identity.role_exists !== false ||
      identity.database_exists !== false
    ) {
      throw new Error(
        'Expected a fresh CI service without a test database or role'
      )
    }

    await client.query(`CREATE ROLE klicker_test LOGIN PASSWORD 'klicker'
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`)
    await client.query('CREATE DATABASE klicker_test OWNER klicker_test')
    // A database comment survives Prisma's schema reset. Never adopt or mark
    // an existing database, including after a partially failed provisioning.
    await client.query(
      "COMMENT ON DATABASE klicker_test IS 'klicker-disposable-test-v1'"
    )
  } finally {
    await client.end()
  }
}

async function main() {
  const config = connectionConfig(process.env)
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: GitHub Actions environment contract; this script runs outside Turbo
  const workspace = process.env.GITHUB_WORKSPACE
  if (!workspace || !path.isAbsolute(workspace)) {
    throw new Error('CI workspace is unavailable')
  }
  const workspaceRequire = createRequire(
    path.join(workspace, 'packages/prisma/package.json')
  )
  const { Client } = workspaceRequire('pg')
  await provisionDatabase(new Client(config))
  console.log('Provisioned dedicated disposable Playwright database')
}

if (require.main === module) {
  main().catch(() => {
    // Driver errors can contain connection data. Keep CI output values-free.
    console.error(
      'Disposable database provisioning failed; reset was not started'
    )
    process.exitCode = 1
  })
}

module.exports = { connectionConfig, provisionDatabase }

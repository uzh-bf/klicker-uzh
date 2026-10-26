import assert from 'node:assert/strict'
import test from 'node:test'
import {
  type BootstrapClientConnector,
  bootstrapNorthflankPostgres,
} from '../scripts/northflankBootstrap.js'
import {
  DISPOSABLE_DATABASE_MARKER,
  disposableDatabaseIdentityQuery,
} from '../src/disposableDatabase.js'

const HOST = 'postgres.synthetic.invalid'
const ADMIN_URL =
  'postgresql://provider_admin:synthetic-admin@' +
  HOST +
  ':5432/klicker_test?sslmode=require'
const URL_ENV = 'KLICKER_NORTHFLANK_BOOTSTRAP_DATABASE_URL'
const HOST_ENV = 'KLICKER_NORTHFLANK_POSTGRES_HOST'
const DISPOSABLE_ENV = 'KLICKER_NORTHFLANK_DISPOSABLE'
const APP_PASSWORD_ENV = 'KLICKER_NORTHFLANK_APP_PASSWORD'
const ENV = {
  [URL_ENV]: ADMIN_URL,
  [HOST_ENV]: HOST,
  [DISPOSABLE_ENV]: '1',
  [APP_PASSWORD_ENV]: 'synthetic-app-password',
}
const fresh = (overrides: Record<string, unknown> = {}) => ({
  database: 'klicker_test',
  admin_role: 'provider_admin',
  same_identity: true,
  marker_free: true,
  authorized: true,
  fresh: true,
  ...overrides,
})
const identity = (database: string) => ({
  database,
  login: 'klicker_test',
  role: 'klicker_test',
  marker: DISPOSABLE_DATABASE_MARKER,
  privileged: false,
})
const access = (database: string) => ({
  database,
  owns_database: true,
  can_create_schema: true,
})
type HarnessOptions = {
  password?: string
  status?: Record<string, unknown>[]
  writeFailure?: string
  access?: (database: string) => Record<string, unknown>[]
}
function harness(options: HarnessOptions = {}) {
  const queries: string[] = []
  const writes: string[] = []
  const apps: string[] = []
  let statusReads = 0
  let calls = 0
  const connect: BootstrapClientConnector = async (connectionString) => {
    calls += 1
    if (calls === 1) {
      return {
        async query(query) {
          queries.push(query)
          if (query.includes('northflank-bootstrap-status-v1')) {
            const row = options.status?.[statusReads++] ?? fresh()
            return { rows: [row] }
          }
          if (query.includes('northflank-bootstrap-lock-v1')) {
            return { rows: [{ locked: true }] }
          }
          writes.push(query)
          if (options.writeFailure && query.includes(options.writeFailure)) {
            throw new Error('synthetic-provider-secret')
          }
          return { rows: [] }
        },
        end: async () => undefined,
      }
    }
    const url = new URL(connectionString)
    if (
      url.username !== 'klicker_test' ||
      decodeURIComponent(url.password) !==
        (options.password ?? ENV[APP_PASSWORD_ENV])
    ) {
      throw new Error('synthetic-provider-secret')
    }
    const database = url.pathname.slice(1)
    return {
      async query(query) {
        if (query === disposableDatabaseIdentityQuery) {
          apps.push(database)
          return { rows: [identity(database)] }
        }
        if (query.includes('northflank-bootstrap-access-v1')) {
          const rows = options.access?.(database) ?? [access(database)]
          return { rows }
        }
        throw new Error('synthetic-provider-secret')
      },
      end: async () => undefined,
    }
  }
  return { connect, queries, writes, apps, calls: () => calls }
}

test('dry run validates, locks, rechecks and never writes', async () => {
  const fake = harness()
  const result = await bootstrapNorthflankPostgres({
    env: ENV,
    connect: fake.connect,
  })
  assert.deepEqual(result, { mode: 'dry-run' })
  assert.deepEqual(
    fake.queries.map(
      (query) => query.match(/northflank-bootstrap-(status|lock)-v1/)?.[1]
    ),
    ['status', 'lock', 'status']
  )
  assert.deepEqual(fake.writes, [])
  assert.deepEqual(fake.apps, [])
})

test('rejects malformed authority, URLs and environment inputs before connecting', async () => {
  const fake = harness()
  const invalid = [
    { [HOST_ENV]: 'other.invalid' },
    { [URL_ENV]: ADMIN_URL.replace('/klicker_test', '/klicker_prod') },
    { [URL_ENV]: ADMIN_URL.replace('?sslmode=require', '') },
    { [URL_ENV]: `${ADMIN_URL}&host=other.invalid` },
    { [DISPOSABLE_ENV]: 'true' },
    { [APP_PASSWORD_ENV]: undefined },
    { PGHOST: 'other.invalid' },
    { DATABASE_URL: ADMIN_URL },
  ]

  for (const override of invalid) {
    await assert.rejects(
      bootstrapNorthflankPostgres({
        env: { ...ENV, ...override },
        connect: fake.connect,
      })
    )
  }
  assert.equal(fake.calls(), 0)
})

test('refuses mismatched administrators, insufficient authority and nonfresh targets', async () => {
  for (const status of [
    fresh({ admin_role: 'other_admin' }),
    fresh({ authorized: false }),
    fresh({ fresh: false }),
  ]) {
    const fake = harness({ status: [status] })
    await assert.rejects(
      bootstrapNorthflankPostgres({
        env: { ...ENV, DRY_RUN: 'false' },
        connect: fake.connect,
      })
    )
    assert.deepEqual(fake.writes, [])
  }
})

test('applies the guarded writes in order and verifies both app databases', async () => {
  const fake = harness()
  const result = await bootstrapNorthflankPostgres({
    env: {
      ...ENV,
      DRY_RUN: 'false',
      KLICKER_NORTHFLANK_HATCHET_PASSWORD: 'synthetic-hatchet-password',
    },
    connect: fake.connect,
  })

  assert.deepEqual(result, { mode: 'applied' })
  const expected = [
    /^CREATE ROLE "klicker_test" LOGIN PASSWORD '/,
    /^GRANT "klicker_test" TO "provider_admin"$/,
    /^ALTER DATABASE "klicker_test" OWNER TO "klicker_test"$/,
    /^ALTER SCHEMA "public" OWNER TO "klicker_test"$/,
    /^GRANT USAGE, CREATE ON SCHEMA "public" TO "klicker_test"$/,
    /^COMMENT ON DATABASE "klicker_test" IS /,
    /^CREATE DATABASE "klicker_test_shadow" OWNER "klicker_test"$/,
    /^COMMENT ON DATABASE "klicker_test_shadow" IS /,
    /^CREATE ROLE "hatchet" LOGIN PASSWORD '/,
    /^GRANT "hatchet" TO "provider_admin"$/,
    /^CREATE DATABASE "hatchet" OWNER "hatchet"$/,
  ]
  assert.equal(fake.writes.length, expected.length)
  expected.forEach((pattern, index) => {
    assert.match(fake.writes[index] ?? '', pattern)
  })
  assert.deepEqual(fake.apps, ['klicker_test', 'klicker_test_shadow'])
})

test('preserves reserved characters when verifying the restricted password', async () => {
  const password = 'synthetic%41@/#:%zz'
  const fake = harness({ password })
  const result = await bootstrapNorthflankPostgres({
    env: { ...ENV, DRY_RUN: 'false', [APP_PASSWORD_ENV]: password },
    connect: fake.connect,
  })
  assert.deepEqual(result, { mode: 'applied' })
  assert.deepEqual(fake.apps, ['klicker_test', 'klicker_test_shadow'])
})

test('stops after a partial write failure without retrying', async () => {
  const fake = harness({ writeFailure: 'GRANT USAGE, CREATE ON SCHEMA' })
  await assert.rejects(
    bootstrapNorthflankPostgres({
      env: { ...ENV, DRY_RUN: 'false' },
      connect: fake.connect,
    }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic-provider-secret/)
      return error instanceof Error
    }
  )
  assert.equal(fake.writes.length, 5)
  assert.deepEqual(fake.apps, [])
  assert.equal(fake.calls(), 1)
})

test('rejects restricted-login verification failure without another write', async () => {
  const fake = harness({
    access: (database) => [{ ...access(database), can_create_schema: false }],
  })
  await assert.rejects(
    bootstrapNorthflankPostgres({
      env: { ...ENV, DRY_RUN: 'false' },
      connect: fake.connect,
    }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic-provider-secret/)
      return error instanceof Error
    }
  )
  assert.equal(fake.writes.length, 8)
  assert.deepEqual(fake.apps, ['klicker_test'])
  assert.equal(fake.calls(), 2)
})

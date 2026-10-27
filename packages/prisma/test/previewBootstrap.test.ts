import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  type BootstrapClientConnector,
  bootstrapPreviewPostgres,
} from '../scripts/previewBootstrap.js'
import {
  DISPOSABLE_DATABASE_MARKER,
  disposableDatabaseIdentityQuery,
} from '../src/disposableDatabase.js'

const HOST = 'postgres.synthetic.invalid'
const ADMIN_URL =
  'postgresql://provider_admin:synthetic-admin@' +
  HOST +
  ':5432/klicker_test?sslmode=require'
const URL_ENV = 'KLICKER_PREVIEW_BOOTSTRAP_DATABASE_URL'
const HOST_ENV = 'KLICKER_PREVIEW_POSTGRES_HOST'
const DISPOSABLE_ENV = 'KLICKER_PREVIEW_DISPOSABLE'
const APP_PASSWORD_ENV = 'KLICKER_PREVIEW_APP_PASSWORD'
const ENV = {
  [URL_ENV]: ADMIN_URL,
  [HOST_ENV]: HOST,
  [DISPOSABLE_ENV]: '1',
  [APP_PASSWORD_ENV]: 'synthetic-app-password',
}

test('reports bootstrap refusal through the CLI without disclosing credentials', () => {
  const result = spawnSync(
    process.execPath,
    [
      fileURLToPath(
        new URL('../node_modules/tsx/dist/cli.mjs', import.meta.url)
      ),
      fileURLToPath(new URL('../scripts/previewBootstrap.ts', import.meta.url)),
    ],
    {
      encoding: 'utf8',
      timeout: 10_000,
      env: { ...process.env, ...ENV, DATABASE_URL: ADMIN_URL },
    }
  )
  assert.equal(result.status, 2)
  assert.doesNotMatch(result.stderr + result.stdout, /synthetic-admin/)
})

test('forwards only recognized bootstrap failure codes and suppresses raw tool output', () => {
  const folder = mkdtempSync(path.join(tmpdir(), 'preview-bootstrap-'))
  try {
    writeFileSync(
      path.join(folder, 'pnpm'),
      `#!${process.execPath}\nconsole.log('synthetic-secret'); console.error('synthetic-secret'); process.exit(Number(process.env.KLICKER_TEST_BOOTSTRAP_EXIT))\n`,
      { mode: 0o700 }
    )
    const runner = fileURLToPath(
      new URL('../../../deploy/preview/bootstrap.mjs', import.meta.url)
    )
    for (const code of [2, 3, 4, 5, 19]) {
      const result = spawnSync(process.execPath, [runner, 'bootstrap'], {
        encoding: 'utf8',
        timeout: 10_000,
        env: {
          ...process.env,
          PATH: `${folder}${path.delimiter}${process.env.PATH}`,
          KLICKER_TEST_BOOTSTRAP_EXIT: String(code),
        },
      })
      assert.equal(result.status, 1)
      assert.doesNotMatch(result.stderr + result.stdout, /synthetic-secret/)
      assert.equal(
        result.stderr.includes(`KLICKER_BOOTSTRAP_FAILURE_${code}`),
        code !== 19
      )
    }
  } finally {
    rmSync(folder, { recursive: true, force: true })
  }
})
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
  credentials?: { app?: string }
  status?: Record<string, unknown>[]
  writeFailure?: string
  access?: (database: string) => Record<string, unknown>[]
}
function harness(options: HarnessOptions = {}) {
  const queries: string[] = []
  const writes: string[] = []
  const verifications: string[] = []
  let statusReads = 0
  let calls = 0
  const connect: BootstrapClientConnector = async (connectionString) => {
    calls += 1
    if (calls === 1) {
      return {
        async query(query) {
          queries.push(query)
          if (query.includes('preview-bootstrap-status-v1')) {
            const row = options.status?.[statusReads++] ?? fresh()
            return { rows: [row] }
          }
          if (query.includes('preview-bootstrap-lock-v1')) {
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
    let expectedPassword: string | undefined
    if (url.username === 'klicker_test') {
      expectedPassword = options.credentials?.app ?? ENV[APP_PASSWORD_ENV]
    }
    if (
      expectedPassword === undefined ||
      decodeURIComponent(url.password) !== expectedPassword
    ) {
      throw new Error('synthetic-provider-secret')
    }
    const database = url.pathname.slice(1)
    return {
      async query(query) {
        if (query === disposableDatabaseIdentityQuery) {
          if (!['klicker_test', 'klicker_test_shadow'].includes(database)) {
            throw new Error('synthetic-provider-secret')
          }
          verifications.push(database)
          return { rows: [identity(database)] }
        }
        if (query.includes('preview-bootstrap-access-v1')) {
          const rows = options.access?.(database) ?? [access(database)]
          return { rows }
        }
        throw new Error('synthetic-provider-secret')
      },
      end: async () => undefined,
    }
  }
  return { connect, queries, writes, verifications, calls: () => calls }
}

test('dry run validates, locks, rechecks and never writes', async () => {
  const fake = harness()
  const result = await bootstrapPreviewPostgres({
    env: ENV,
    connect: fake.connect,
  })
  assert.deepEqual(result, { mode: 'dry-run' })
  assert.deepEqual(
    fake.queries.map(
      (query) => query.match(/preview-bootstrap-(status|lock)-v1/)?.[1]
    ),
    ['status', 'lock', 'status']
  )
  assert.deepEqual(fake.writes, [])
  assert.deepEqual(fake.verifications, [])
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
      bootstrapPreviewPostgres({
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
      bootstrapPreviewPostgres({
        env: { ...ENV, DRY_RUN: 'false' },
        connect: fake.connect,
      })
    )
    assert.deepEqual(fake.writes, [])
  }
})

test('applies the guarded writes and verifies both restricted application databases', async () => {
  const fake = harness()
  const result = await bootstrapPreviewPostgres({
    env: {
      ...ENV,
      DRY_RUN: 'false',
    },
    connect: fake.connect,
  })

  assert.deepEqual(result, { mode: 'applied' })
  const expected = [
    /^CREATE ROLE "klicker_test" LOGIN PASSWORD '/,
    /^GRANT "klicker_test" TO "provider_admin" WITH INHERIT TRUE, SET TRUE$/,
    /^ALTER DATABASE "klicker_test" OWNER TO "klicker_test"$/,
    /^ALTER SCHEMA "public" OWNER TO "klicker_test"$/,
    /^GRANT USAGE, CREATE ON SCHEMA "public" TO "klicker_test"$/,
    /^COMMENT ON DATABASE "klicker_test" IS /,
    /^CREATE DATABASE "klicker_test_shadow" OWNER "klicker_test"$/,
    /^COMMENT ON DATABASE "klicker_test_shadow" IS /,
  ]
  assert.equal(fake.writes.length, expected.length)
  expected.forEach((pattern, index) => {
    assert.match(fake.writes[index] ?? '', pattern)
  })
  assert.deepEqual(fake.verifications, ['klicker_test', 'klicker_test_shadow'])
  assert.equal(fake.calls(), 3)
})

test('preserves reserved characters when verifying the restricted password', async () => {
  const password = 'synthetic%41@/#:%zz'
  const fake = harness({ credentials: { app: password } })
  const result = await bootstrapPreviewPostgres({
    env: { ...ENV, DRY_RUN: 'false', [APP_PASSWORD_ENV]: password },
    connect: fake.connect,
  })
  assert.deepEqual(result, { mode: 'applied' })
  assert.deepEqual(fake.verifications, ['klicker_test', 'klicker_test_shadow'])
})

test('stops after a partial write failure without retrying', async () => {
  const fake = harness({ writeFailure: 'GRANT USAGE, CREATE ON SCHEMA' })
  await assert.rejects(
    bootstrapPreviewPostgres({
      env: { ...ENV, DRY_RUN: 'false' },
      connect: fake.connect,
    }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic-provider-secret/)
      return error instanceof Error
    }
  )
  assert.equal(fake.writes.length, 5)
  assert.deepEqual(fake.verifications, [])
  assert.equal(fake.calls(), 1)
})

test('rejects restricted-login verification failure without another write', async () => {
  const fake = harness({
    access: (database) => [{ ...access(database), can_create_schema: false }],
  })
  await assert.rejects(
    bootstrapPreviewPostgres({
      env: { ...ENV, DRY_RUN: 'false' },
      connect: fake.connect,
    }),
    (error: Error) => {
      assert.doesNotMatch(error.message, /synthetic-provider-secret/)
      return error instanceof Error
    }
  )
  assert.equal(fake.writes.length, 8)
  assert.deepEqual(fake.verifications, ['klicker_test'])
  assert.equal(fake.calls(), 2)
})

test('refuses legacy and unsupported bootstrap keys before connecting', async () => {
  for (const key of [
    'KLICKER_NORTHFLANK_DISPOSABLE',
    'KLICKER_PREVIEW_HATCHET_PASSWORD',
    'KLICKER_PREVIEW_UNKNOWN',
  ]) {
    const fake = harness()
    await assert.rejects(
      bootstrapPreviewPostgres({
        env: { ...ENV, [key]: 'synthetic-unused-value' },
        connect: fake.connect,
      })
    )
    assert.equal(fake.calls(), 0)
    assert.deepEqual(fake.writes, [])
  }
})

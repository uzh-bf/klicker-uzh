const assert = require('node:assert/strict')
const { describe, test } = require('node:test')

const {
  connectionConfig,
  provisionDatabase,
} = require('./prepare-test-database.cjs')

const freshIdentity = {
  database: 'klicker-prod',
  login: 'klicker-prod',
  role: 'klicker-prod',
  role_exists: false,
  database_exists: false,
}

const identityQuery = `
  SELECT current_database() AS database,
         session_user AS login, current_user AS role,
         EXISTS (SELECT FROM pg_roles WHERE rolname = 'klicker_test') AS role_exists,
         EXISTS (SELECT FROM pg_database WHERE datname = 'klicker_test') AS database_exists
`

const roleQuery = `CREATE ROLE klicker_test LOGIN PASSWORD 'klicker'
  NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS`

const databaseQuery = 'CREATE DATABASE klicker_test OWNER klicker_test'
const markerQuery =
  "COMMENT ON DATABASE klicker_test IS 'klicker-disposable-test-v1'"

function normalizeSql(sql) {
  return sql.replace(/\s+/g, ' ').trim()
}

function makeClient(options = {}) {
  const { failAt } = options
  const rows = Object.hasOwn(options, 'rows') ? options.rows : [freshIdentity]
  const calls = []
  let queryNumber = 0

  const client = {
    async connect() {
      calls.push({ kind: 'connect' })
      if (failAt?.kind === 'connect') {
        throw failAt.error
      }
    },

    async query(sql) {
      queryNumber += 1
      const kind =
        queryNumber === 1
          ? 'identity-query'
          : queryNumber === 2
            ? 'create-role'
            : queryNumber === 3
              ? 'create-database'
              : 'comment'
      calls.push({ kind, sql })

      if (failAt?.kind === kind) {
        throw failAt.error
      }

      return queryNumber === 1 ? { rows } : { rows: [] }
    },

    async end() {
      calls.push({ kind: 'end' })
    },
  }

  return { calls, client }
}

function callKinds(calls) {
  return calls.map(({ kind }) => kind)
}

function querySql(calls) {
  return calls.filter(({ sql }) => sql).map(({ sql }) => normalizeSql(sql))
}

describe('prepare-test-database', () => {
  test('rejects every context that is not an exact CI shard', () => {
    const rejectedEnvironments = [
      {},
      { GITHUB_ACTIONS: 'true' },
      { CI: 'true' },
      { GITHUB_ACTIONS: 'false', CI: 'true' },
      { GITHUB_ACTIONS: 'true', CI: 'false' },
      { GITHUB_ACTIONS: true, CI: true },
    ]

    for (const environment of rejectedEnvironments) {
      assert.throws(() => connectionConfig(environment), Error)
    }
  })

  test('uses the fixed disposable target despite hostile connection variables', () => {
    const config = connectionConfig({
      GITHUB_ACTIONS: 'true',
      CI: 'true',
      DATABASE_URL: 'postgres://hostile.invalid:6543/hostile',
      PGHOST: 'hostile.invalid',
      PGPORT: '6543',
      PGUSER: 'hostile-user',
      PGPASSWORD: 'hostile-password',
      PGDATABASE: 'hostile-database',
    })

    assert.deepEqual(config, {
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
    })
  })

  test('does not mutate a service with an unexpected identity or inventory', async (t) => {
    const cases = [
      ['wrong database', { ...freshIdentity, database: 'other-database' }],
      ['wrong login', { ...freshIdentity, login: 'other-login' }],
      ['wrong role', { ...freshIdentity, role: 'other-role' }],
      ['existing role', { ...freshIdentity, role_exists: true }],
      ['existing database', { ...freshIdentity, database_exists: true }],
    ]

    for (const [name, identity] of cases) {
      await t.test(name, async () => {
        const { calls, client } = makeClient({ rows: [identity] })

        await assert.rejects(() => provisionDatabase(client), Error)
        assert.deepEqual(callKinds(calls), ['connect', 'identity-query', 'end'])
        assert.deepEqual(querySql(calls), [normalizeSql(identityQuery)])
      })
    }
  })

  test('does not mutate when the identity query has unknown rows', async (t) => {
    const cases = [
      ['no rows', []],
      ['multiple rows', [freshIdentity, freshIdentity]],
      ['missing rows', undefined],
    ]

    for (const [name, rows] of cases) {
      await t.test(name, async () => {
        const { calls, client } = makeClient({ rows })

        await assert.rejects(() => provisionDatabase(client), Error)
        assert.deepEqual(callKinds(calls), ['connect', 'identity-query', 'end'])
        assert.deepEqual(querySql(calls), [normalizeSql(identityQuery)])
      })
    }
  })

  test('propagates provisioning failures and always ends the client', async (t) => {
    const failures = [
      ['connect', 'connect', []],
      ['identity query', 'identity-query', [identityQuery]],
      ['role creation', 'create-role', [identityQuery, roleQuery]],
      [
        'database creation',
        'create-database',
        [identityQuery, roleQuery, databaseQuery],
      ],
      [
        'marker comment',
        'comment',
        [identityQuery, roleQuery, databaseQuery, markerQuery],
      ],
    ]

    for (const [name, kind, executedQueries] of failures) {
      await t.test(name, async () => {
        const error = new Error(kind)
        const { calls, client } = makeClient({
          failAt: { error, kind },
        })

        await assert.rejects(
          () => provisionDatabase(client),
          (actual) => {
            assert.strictEqual(actual, error)
            return true
          }
        )
        assert.equal(calls.at(-1).kind, 'end')
        assert.deepEqual(
          querySql(calls),
          executedQueries.map((query) => normalizeSql(query))
        )
      })
    }
  })

  test('creates the constrained role, database, and marker in order', async () => {
    const { calls, client } = makeClient()

    await provisionDatabase(client)

    assert.deepEqual(callKinds(calls), [
      'connect',
      'identity-query',
      'create-role',
      'create-database',
      'comment',
      'end',
    ])
    assert.deepEqual(querySql(calls), [
      normalizeSql(identityQuery),
      normalizeSql(roleQuery),
      normalizeSql(databaseQuery),
      normalizeSql(markerQuery),
    ])
  })
})

import assert from 'node:assert/strict'
import test from 'node:test'

import {
  assertDisposableDatabaseIdentity,
  assertNoPostgresEnvironmentOverrides,
  createGuardablePoolConfig,
  DISPOSABLE_DATABASE_MARKER,
  disposableDatabaseIdentityQuery,
  requireDisposableDatabase,
  validateDisposableDatabaseUrl,
} from '../src/disposableDatabase.js'

const databaseUrl = (database = 'klicker_test', login = 'klicker_test') =>
  `postgres://${login}:synthetic-password@db.example/${database}`

type IdentityRow = {
  database: string
  login: string
  role: string
  marker: string
  privileged: boolean
}

const identityRow = (
  database = 'klicker_test',
  overrides: Partial<IdentityRow> = {}
): IdentityRow => ({
  database,
  login: 'klicker_test',
  role: 'klicker_test',
  marker: DISPOSABLE_DATABASE_MARKER,
  privileged: false,
  ...overrides,
})

type PoolClientDouble = Parameters<
  ReturnType<typeof createGuardablePoolConfig>['config']['verify']
>[0]

type QueryClientDouble = {
  query: (query: string) => Promise<unknown>
}

const asPoolClient = (client: QueryClientDouble) =>
  client as unknown as PoolClientDouble

const deferred = <T>() => {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

const verify = (
  config: ReturnType<typeof createGuardablePoolConfig>['config'],
  client: QueryClientDouble
) =>
  new Promise<Error | undefined>((resolve) => {
    config.verify(asPoolClient(client), (error) => resolve(error))
  })

test('accepts only strict disposable URLs and the two allowed options', () => {
  const validUrls = [
    databaseUrl(),
    databaseUrl().replace('postgres://', 'postgresql://'),
    `${databaseUrl()}?schema=public`,
    `${databaseUrl()}?sslmode=require`,
    `${databaseUrl()}?schema=public&sslmode=verify-full`,
  ]

  for (const url of validUrls) {
    assert.equal(validateDisposableDatabaseUrl(url), url)
  }

  const invalidUrls: Array<string | undefined> = [
    undefined,
    '',
    databaseUrl('klicker_prod'),
    databaseUrl('klicker_test', 'klicker_prod'),
    `${databaseUrl()}?host=localhost`,
    `${databaseUrl()}?application_name=synthetic`,
    `${databaseUrl()}?connect_timeout=5`,
    `${databaseUrl()}?sslmode=prefer`,
    `${databaseUrl()}?schema=private`,
    `${databaseUrl()}?schema=public&schema=public`,
    `${databaseUrl()}?sslmode=require&sslmode=require`,
    `${databaseUrl()}#synthetic-fragment`,
  ]

  for (const url of invalidUrls) {
    assert.throws(() => validateDisposableDatabaseUrl(url))
  }
})

test('keeps the shadow database explicit in URL and identity validation', () => {
  const shadowUrl = databaseUrl('klicker_test_shadow')
  assert.equal(
    validateDisposableDatabaseUrl(shadowUrl, 'klicker_test_shadow'),
    shadowUrl
  )
  assert.throws(() => validateDisposableDatabaseUrl(shadowUrl))

  const shadowIdentity = [identityRow('klicker_test_shadow')]
  assert.doesNotThrow(() =>
    assertDisposableDatabaseIdentity(shadowIdentity, 'klicker_test_shadow')
  )
  assert.throws(() => assertDisposableDatabaseIdentity(shadowIdentity))
})

test('rejects every unsafe identity field and malformed row shape', () => {
  const invalidRows: unknown[] = [
    undefined,
    null,
    [],
    [identityRow(), identityRow()],
    [identityRow('other_database')],
    [identityRow('klicker_test', { login: 'other_login' })],
    [identityRow('klicker_test', { role: 'other_role' })],
    [identityRow('klicker_test', { marker: 'other-marker' })],
    [identityRow('klicker_test', { privileged: true })],
  ]

  for (const rows of invalidRows) {
    assert.throws(() => assertDisposableDatabaseIdentity(rows))
  }
})

test('uses the captured URL even when the environment changes', async () => {
  const guard = createGuardablePoolConfig(databaseUrl('klicker_prod'))
  const identityQueries: string[] = []
  const client = {
    async $queryRawUnsafe(query: string) {
      identityQueries.push(query)
      return [identityRow()]
    },
  }
  guard.register(client)

  const previousDatabaseUrl = process.env.DATABASE_URL
  try {
    process.env.DATABASE_URL = databaseUrl()
    await assert.rejects(requireDisposableDatabase(client))
  } finally {
    if (previousDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL
    } else {
      process.env.DATABASE_URL = previousDatabaseUrl
    }
  }

  assert.deepEqual(identityQueries, [])
})

test('refuses PostgreSQL environment overrides before querying identity', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  let identityQueryCount = 0
  const client = {
    async $queryRawUnsafe() {
      identityQueryCount += 1
      return [identityRow()]
    },
  }
  guard.register(client)

  const previousOverride = process.env.PG_SYNTHETIC_OVERRIDE
  try {
    process.env.PG_SYNTHETIC_OVERRIDE = 'synthetic-host'
    assert.throws(() => assertNoPostgresEnvironmentOverrides())
    await assert.rejects(requireDisposableDatabase(client))
  } finally {
    if (previousOverride === undefined) {
      delete process.env.PG_SYNTHETIC_OVERRIDE
    } else {
      process.env.PG_SYNTHETIC_OVERRIDE = previousOverride
    }
  }

  assert.equal(identityQueryCount, 0)
})

test('refuses an unregistered client without running an identity query', async () => {
  let identityQueryCount = 0
  const client = {
    async $queryRawUnsafe() {
      identityQueryCount += 1
      return [identityRow()]
    },
  }

  await assert.rejects(requireDisposableDatabase(client))
  assert.equal(identityQueryCount, 0)
})

test('refuses a client after a pool connection was used without the guard', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  let verifyDoneCalls = 0
  let poolIdentityQueryCount = 0
  let prismaIdentityQueryCount = 0
  const client = {
    async query() {
      poolIdentityQueryCount += 1
      return { rows: [identityRow()] }
    },
    async $queryRawUnsafe() {
      prismaIdentityQueryCount += 1
      return [identityRow()]
    },
  }
  guard.register(client)

  guard.config.verify(asPoolClient(client), () => {
    verifyDoneCalls += 1
  })

  assert.equal(verifyDoneCalls, 1)
  assert.equal(poolIdentityQueryCount, 0)
  await assert.rejects(requireDisposableDatabase(client))
  assert.equal(prismaIdentityQueryCount, 0)
})

test('arms synchronously and withholds pool checkout until identity resolves', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const rawIdentity = deferred<unknown[]>()
  const poolIdentity = deferred<{ rows: unknown }>()
  const rawQueries: string[] = []
  const poolQueries: string[] = []
  const client = {
    $queryRawUnsafe(query: string) {
      rawQueries.push(query)
      return rawIdentity.promise
    },
    query(query: string) {
      poolQueries.push(query)
      return poolIdentity.promise
    },
  }
  guard.register(client)

  const setup = requireDisposableDatabase(client)
  let verifyDone = false
  const checkout = new Promise<Error | undefined>((resolve) => {
    guard.config.verify(asPoolClient(client), (error) => {
      verifyDone = true
      resolve(error)
    })
  })

  await Promise.resolve()
  assert.equal(verifyDone, false)
  assert.deepEqual(rawQueries, [disposableDatabaseIdentityQuery])
  assert.deepEqual(poolQueries, [disposableDatabaseIdentityQuery])

  poolIdentity.resolve({ rows: [identityRow()] })
  assert.equal(await checkout, undefined)
  rawIdentity.resolve([identityRow()])
  await setup
})

test('rejects a reconnect when its marker is wrong', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const setupClient = {
    async $queryRawUnsafe() {
      return [identityRow()]
    },
  }
  guard.register(setupClient)
  await requireDisposableDatabase(setupClient)

  const poolQueries: string[] = []
  const error = await verify(guard.config, {
    async query(query: string) {
      poolQueries.push(query)
      return { rows: [identityRow('klicker_test', { marker: 'wrong' })] }
    },
  })

  assert.ok(error instanceof Error)
  assert.deepEqual(poolQueries, [disposableDatabaseIdentityQuery])
})

test('rejects a reconnect when its identity query fails', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const setupClient = {
    async $queryRawUnsafe() {
      return [identityRow()]
    },
  }
  guard.register(setupClient)
  await requireDisposableDatabase(setupClient)

  const poolQueries: string[] = []
  const error = await verify(guard.config, {
    async query(query: string) {
      poolQueries.push(query)
      throw new Error('synthetic identity failure')
    },
  })

  assert.ok(error instanceof Error)
  assert.deepEqual(poolQueries, [disposableDatabaseIdentityQuery])
})

test('refuses cleanup after setup identity failure before any mutation', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const identityQueries: string[] = []
  let mutationCalls = 0
  const client = {
    async $queryRawUnsafe(query: string) {
      identityQueries.push(query)
      return [identityRow('klicker_test', { marker: 'wrong' })]
    },
  }
  guard.register(client)

  await assert.rejects(requireDisposableDatabase(client))
  await assert.rejects(async () => {
    await requireDisposableDatabase(client)
    mutationCalls += 1
  })

  assert.equal(mutationCalls, 0)
  assert.deepEqual(identityQueries, [
    disposableDatabaseIdentityQuery,
    disposableDatabaseIdentityQuery,
  ])
})

test('accepts a marked unprivileged identity and a successful reconnect', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const setupQueries: string[] = []
  const setupClient = {
    async $queryRawUnsafe(query: string) {
      setupQueries.push(query)
      return [identityRow()]
    },
  }
  guard.register(setupClient)

  assert.equal(await requireDisposableDatabase(setupClient), undefined)

  const reconnectQueries: string[] = []
  assert.equal(
    await verify(guard.config, {
      async query(query: string) {
        reconnectQueries.push(query)
        return { rows: [identityRow()] }
      },
    }),
    undefined
  )
  assert.deepEqual(setupQueries, [disposableDatabaseIdentityQuery])
  assert.deepEqual(reconnectQueries, [disposableDatabaseIdentityQuery])
})

test('retains registered provenance across a module reload', async () => {
  const guard = createGuardablePoolConfig(databaseUrl())
  const identityQueries: string[] = []
  const client = {
    async $queryRawUnsafe(query: string) {
      identityQueries.push(query)
      return [identityRow()]
    },
  }
  guard.register(client)

  const reloaded = await import(
    `${new URL('../src/disposableDatabase.ts', import.meta.url).href}?reload=${Date.now()}`
  )
  await reloaded.requireDisposableDatabase(client)

  assert.deepEqual(identityQueries, [disposableDatabaseIdentityQuery])
})

import type { PoolClient } from 'pg'

export const DISPOSABLE_DATABASE_MARKER = 'klicker-disposable-test-v1'
export type DisposableDatabase = 'klicker_test' | 'klicker_test_shadow'

export function assertNoPostgresEnvironmentOverrides() {
  if (Object.keys(process.env).some((key) => key.startsWith('PG'))) {
    throw new Error(
      'PostgreSQL environment overrides are forbidden for disposable database operations'
    )
  }
}

const refusal = () =>
  new Error(
    'Disposable database verification failed. Use a freshly provisioned klicker_test database and login; retained databases and port forwards are not test targets.'
  )

export function validateDisposableDatabaseUrl(
  connectionString: string | undefined,
  database: DisposableDatabase = 'klicker_test'
): string {
  try {
    if (!connectionString) throw refusal()
    const url = new URL(connectionString)
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      !url.hostname ||
      url.hash ||
      decodeURIComponent(url.username) !== 'klicker_test' ||
      !url.password ||
      decodeURIComponent(url.pathname) !== `/${database}`
    ) {
      throw refusal()
    }
    const seen = new Set<string>()
    for (const [key, value] of url.searchParams) {
      if (seen.has(key)) throw refusal()
      seen.add(key)
      if (key === 'schema' && value === 'public') continue
      if (
        key === 'sslmode' &&
        ['disable', 'require', 'verify-ca', 'verify-full'].includes(value)
      ) {
        continue
      }
      throw refusal()
    }
    return connectionString
  } catch {
    // Connection strings and driver errors can contain credentials.
    throw refusal()
  }
}

export const disposableDatabaseIdentityQuery = `
SELECT current_database() AS database, session_user AS login,
       current_user AS role,
       shobj_description(d.oid, 'pg_database') AS marker,
       r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR
       r.rolreplication OR r.rolbypassrls AS privileged
FROM pg_database d JOIN pg_roles r ON r.rolname = session_user
WHERE d.datname = current_database()`

export function assertDisposableDatabaseIdentity(
  rows: unknown,
  database: DisposableDatabase = 'klicker_test'
) {
  if (!Array.isArray(rows) || rows.length !== 1) throw refusal()
  const row = rows[0]
  if (
    row?.database !== database ||
    row?.login !== 'klicker_test' ||
    row?.role !== 'klicker_test' ||
    row?.marker !== DISPOSABLE_DATABASE_MARKER ||
    row?.privileged !== false
  ) {
    throw refusal()
  }
}

type GuardedClient = {
  $queryRawUnsafe: (query: string) => PromiseLike<unknown>
}
type GuardState = {
  connectionString: string | undefined
  required: boolean
  usedWithoutGuard: boolean
}

// Keep client provenance with the cached singleton across module reloads.
const guardGlobal = globalThis as typeof globalThis & {
  disposablePrismaGuards?: WeakMap<object, GuardState>
}
guardGlobal.disposablePrismaGuards ??= new WeakMap()
const guards = guardGlobal.disposablePrismaGuards

export function createGuardablePoolConfig(
  connectionString: string | undefined
) {
  const state: GuardState = {
    connectionString,
    required: false,
    usedWithoutGuard: false,
  }
  const config = {
    connectionString,
    // pg-pool waits for this callback before handing out each new connection.
    verify(client: PoolClient, done: (error?: Error) => void) {
      if (!state.required) {
        state.usedWithoutGuard = true
        done()
        return
      }
      client.query(disposableDatabaseIdentityQuery).then(
        ({ rows }) => {
          try {
            assertDisposableDatabaseIdentity(rows)
            done()
          } catch {
            done(refusal())
          }
        },
        () => done(refusal())
      )
    },
  }
  return {
    config,
    register(client: object) {
      guards.set(client, state)
    },
  }
}

export async function requireDisposableDatabase(client: GuardedClient) {
  assertNoPostgresEnvironmentOverrides()
  const state = guards.get(client)
  if (!state || state.usedWithoutGuard) throw refusal()
  validateDisposableDatabaseUrl(state.connectionString)
  // Arm synchronously before the first await, including concurrent callers.
  state.required = true
  try {
    assertDisposableDatabaseIdentity(
      await client.$queryRawUnsafe(disposableDatabaseIdentityQuery)
    )
  } catch {
    throw refusal()
  }
}

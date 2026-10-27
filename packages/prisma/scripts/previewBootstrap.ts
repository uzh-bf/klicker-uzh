import { fileURLToPath } from 'node:url'
import pg from 'pg'
import {
  assertDisposableDatabaseIdentity,
  DISPOSABLE_DATABASE_MARKER,
  disposableDatabaseIdentityQuery,
} from '../src/disposableDatabase.js'

const APP = 'klicker_test'
const SHADOW = 'klicker_test_shadow'
const INPUT_ERROR =
  'Preview bootstrap input rejected; no database writes were attempted'
const INSPECT_ERROR =
  'Preview bootstrap inspection failed; no database writes were attempted'
const WRITE_ERROR =
  'Preview bootstrap write failed; recreate the disposable environment'
const VERIFY_ERROR =
  'Preview bootstrap verification failed; recreate the disposable environment'
const FORBIDDEN_URL_ENVIRONMENT = new Set([
  'DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'PRISMA_DATABASE_URL',
])

type Environment = Readonly<Record<string, string | undefined>>
export type BootstrapQueryClient = {
  query: (query: string) => Promise<{ rows: Record<string, unknown>[] }>
  end: () => Promise<void>
}
export type BootstrapClientConnector = (
  connectionString: string
) => PromiseLike<BootstrapQueryClient>

const BOOTSTRAP_KEYS = new Set([
  'KLICKER_PREVIEW_DISPOSABLE',
  'KLICKER_PREVIEW_POSTGRES_HOST',
  'KLICKER_PREVIEW_BOOTSTRAP_DATABASE_URL',
  'KLICKER_PREVIEW_APP_PASSWORD',
])

function readConfig(env: Environment) {
  for (const key of Object.keys(env)) {
    if (
      key.startsWith('PG') ||
      key.startsWith('KLICKER_NORTHFLANK_') ||
      (key.startsWith('KLICKER_PREVIEW_') && !BOOTSTRAP_KEYS.has(key)) ||
      (FORBIDDEN_URL_ENVIRONMENT.has(key) && env[key] !== undefined)
    ) {
      throw new Error(INPUT_ERROR)
    }
  }
  if (env.KLICKER_PREVIEW_DISPOSABLE !== '1') throw new Error(INPUT_ERROR)

  const intendedHost = env.KLICKER_PREVIEW_POSTGRES_HOST
  const rawUrl = env.KLICKER_PREVIEW_BOOTSTRAP_DATABASE_URL
  let url: URL | undefined
  let adminUser = ''
  try {
    if (!rawUrl || !intendedHost || /\s/u.test(intendedHost)) {
      throw new Error(INPUT_ERROR)
    }
    url = new URL(rawUrl)
    const parameters = [...url.searchParams]
    if (
      !['postgres:', 'postgresql:'].includes(url.protocol) ||
      url.hostname !== intendedHost ||
      url.pathname !== `/${APP}` ||
      url.hash ||
      parameters.length !== 1 ||
      parameters[0]?.[0] !== 'sslmode' ||
      !['require', 'verify-ca', 'verify-full'].includes(
        parameters[0]?.[1] ?? ''
      )
    ) {
      throw new Error(INPUT_ERROR)
    }
    adminUser = decodeURIComponent(url.username)
    const adminPassword = decodeURIComponent(url.password)
    if (
      !adminUser ||
      !adminPassword ||
      /\p{Cc}/u.test(adminUser + adminPassword)
    ) {
      throw new Error(INPUT_ERROR)
    }
  } catch {
    throw new Error(INPUT_ERROR)
  }
  if (!url) throw new Error(INPUT_ERROR)

  const appPassword = env.KLICKER_PREVIEW_APP_PASSWORD
  if (
    !appPassword ||
    appPassword.length > 1024 ||
    /\p{Cc}/u.test(appPassword)
  ) {
    throw new Error(INPUT_ERROR)
  }
  return {
    adminUser,
    adminUrl: url.toString(),
    appPassword,
    dryRun: env.DRY_RUN !== 'false',
  }
}

// PostgreSQL hides backend_type for sessions owned by unrelated roles.
const statusQuery = [
  '/* preview-bootstrap-status-v1 */',
  'SELECT current_database() AS database, session_user AS admin_role,',
  '       session_user = current_user AS same_identity,',
  "       shobj_description(d.oid, 'pg_database') IS NULL AS marker_free,",
  "       current_setting('server_version_num')::integer >= 170000",
  '         AND (r.rolsuper OR (r.rolcreatedb AND r.rolcreaterole))',
  "         AND (r.rolsuper OR pg_has_role(r.oid, d.datdba, 'MEMBER'))",
  '         AS authorized,',
  '       (EXISTS (SELECT 1 FROM pg_namespace n',
  "                WHERE n.nspname = 'public')",
  '        AND NOT EXISTS (SELECT 1 FROM pg_class c',
  '                         JOIN pg_namespace n ON n.oid = c.relnamespace',
  "                        WHERE n.nspname = 'public'",
  "                          AND c.relkind IN ('r','p','v','m','S','f')",
  "                          AND NOT (c.relkind = 'v' AND EXISTS (",
  '                            SELECT 1 FROM pg_depend dep',
  '                            JOIN pg_extension ext ON ext.oid = dep.refobjid',
  "                            WHERE dep.classid = 'pg_class'::regclass",
  '                              AND dep.objid = c.oid',
  "                              AND dep.refclassid = 'pg_extension'::regclass",
  "                              AND dep.deptype = 'e'",
  "                              AND ((ext.extname = 'pg_stat_statements'",
  "                                    AND c.relname IN ('pg_stat_statements', 'pg_stat_statements_info'))",
  "                                OR (ext.extname = 'pg_stat_kcache'",
  "                                    AND c.relname IN ('pg_stat_kcache', 'pg_stat_kcache_detail')))",
  '                          )))',
  '        AND NOT EXISTS (SELECT 1 FROM pg_roles',
  "                        WHERE rolname IN ('klicker_test', 'hatchet'))",
  '        AND NOT EXISTS (SELECT 1 FROM pg_database',
  '                        WHERE datname IN',
  "                          ('klicker_test_shadow', 'hatchet'))",
  '        AND NOT EXISTS (SELECT 1 FROM pg_stat_activity',
  '                        WHERE datname = current_database()',
  '                          AND pid <> pg_backend_pid()',
  "                          AND COALESCE(backend_type, 'client backend')",
  "                              = 'client backend')) AS fresh",
  '  FROM pg_roles r',
  '  JOIN pg_database d ON d.datname = current_database()',
  ' WHERE r.rolname = session_user',
].join('\n')

const lockQuery =
  '/* preview-bootstrap-lock-v1 */\n' +
  'SELECT pg_try_advisory_lock(1885973301, 1) AS locked'

const accessQuery = [
  '/* preview-bootstrap-access-v1 */',
  'SELECT current_database() AS database, d.datdba = r.oid AS owns_database,',
  "       has_schema_privilege(current_user, 'public', 'CREATE') AS can_create_schema",
  '  FROM pg_database d',
  '  JOIN pg_roles r ON r.rolname = session_user',
  ' WHERE d.datname = current_database()',
].join('\n')

async function connectPostgres(
  connectionString: string
): Promise<BootstrapQueryClient> {
  const client = new pg.Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  })
  try {
    await client.connect()
  } catch {
    await client.end().catch(() => undefined)
    throw new Error(INSPECT_ERROR)
  }
  return {
    query: async (query) =>
      (await client.query(query)) as {
        rows: Record<string, unknown>[]
      },
    end: async () => client.end(),
  }
}

export async function bootstrapPreviewPostgres(
  options: { env?: Environment; connect?: BootstrapClientConnector } = {}
): Promise<{ mode: 'dry-run' | 'applied' }> {
  const config = readConfig(options.env ?? process.env)
  const connect = options.connect ?? connectPostgres
  let admin: BootstrapQueryClient | undefined
  let phase: 'inspect' | 'write' | 'verify' = 'inspect'

  try {
    const session = await connect(config.adminUrl)
    admin = session
    const checkTarget = async () => {
      const { rows } = await session.query(statusQuery)
      const row = rows[0]
      if (
        !row ||
        row.database !== APP ||
        row.admin_role !== config.adminUser ||
        row.same_identity !== true ||
        row.authorized !== true ||
        row.marker_free !== true
      ) {
        throw new Error(INSPECT_ERROR)
      }
      if (row.fresh !== true) throw new Error(INSPECT_ERROR)
    }

    await checkTarget()
    const { rows: lockRows } = await session.query(lockQuery)
    if (lockRows[0]?.locked !== true) throw new Error(INSPECT_ERROR)
    await checkTarget()
    if (config.dryRun) return { mode: 'dry-run' }

    phase = 'write'
    const app = pg.escapeIdentifier(APP)
    const shadow = pg.escapeIdentifier(SHADOW)
    const publicSchema = pg.escapeIdentifier('public')
    const currentAdmin = pg.escapeIdentifier(config.adminUser)
    const marker = pg.escapeLiteral(DISPOSABLE_DATABASE_MARKER)
    const writes = [
      [
        'CREATE ROLE',
        app,
        'LOGIN PASSWORD',
        pg.escapeLiteral(config.appPassword),
        'NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS',
      ].join(' '),
      ['GRANT', app, 'TO', currentAdmin, 'WITH INHERIT TRUE, SET TRUE'].join(
        ' '
      ),
      ['ALTER DATABASE', app, 'OWNER TO', app].join(' '),
      ['ALTER SCHEMA', publicSchema, 'OWNER TO', app].join(' '),
      ['GRANT USAGE, CREATE ON SCHEMA', publicSchema, 'TO', app].join(' '),
      ['COMMENT ON DATABASE', app, 'IS', marker].join(' '),
      ['CREATE DATABASE', shadow, 'OWNER', app].join(' '),
      ['COMMENT ON DATABASE', shadow, 'IS', marker].join(' '),
    ]
    for (const statement of writes) await session.query(statement)
    await session.end().catch(() => undefined)
    admin = undefined

    phase = 'verify'
    for (const database of [APP, SHADOW] as const) {
      let appClient: BootstrapQueryClient | undefined
      try {
        const url = new URL(config.adminUrl)
        url.username = APP
        url.password = encodeURIComponent(config.appPassword)
        url.pathname = `/${database}`
        appClient = await connect(url.toString())
        const identity = await appClient.query(disposableDatabaseIdentityQuery)
        assertDisposableDatabaseIdentity(identity.rows, database)
        const access = await appClient.query(accessQuery)
        const row = access.rows[0]
        if (
          row?.database !== database ||
          row.owns_database !== true ||
          row.can_create_schema !== true
        ) {
          throw new Error(VERIFY_ERROR)
        }
      } finally {
        if (appClient) await appClient.end().catch(() => undefined)
      }
    }
    return { mode: 'applied' }
  } catch {
    if (phase === 'write') throw new Error(WRITE_ERROR)
    if (phase === 'verify') throw new Error(VERIFY_ERROR)
    throw new Error(INSPECT_ERROR)
  } finally {
    if (admin) await admin.end().catch(() => undefined)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  bootstrapPreviewPostgres().then(
    ({ mode }) => {
      console.log(
        mode === 'dry-run'
          ? 'Preview PostgreSQL bootstrap validated; no writes performed'
          : 'Preview PostgreSQL bootstrap completed and verified'
      )
    },
    (error: Error) => {
      console.error(error.message)
      const failureExitCodes = new Map([
        [INPUT_ERROR, 2],
        [INSPECT_ERROR, 3],
        [WRITE_ERROR, 4],
        [VERIFY_ERROR, 5],
      ])
      process.exitCode = failureExitCodes.get(error.message) ?? 1
    }
  )
}

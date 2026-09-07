// ref: https://github.com/prisma/prisma/discussions/10854

import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'
import type { PrismaClient } from '@klicker-uzh/prisma/client'

export interface Migration {
  id: string
  isIdempotent?: true
  migrate: (tx: PrismaMigrationClient) => Promise<void>
}

interface MigrateOptions {
  registry?: readonly Migration[]
  retryBaseDelayMs?: number
}

type MigrationOutcome = 'applied' | 'skipped'

const MIGRATION_RETRY_ATTEMPTS = 3
const MIGRATION_RETRY_BASE_DELAY_MS = 2000
const MIGRATION_TRANSACTION_TIMEOUT_MS = 120000

// Prisma error codes a fresh attempt can recover from: the database is not
// reachable yet (P1001, P1002), an operation or connection pool checkout timed
// out (P1008, P2024), the server closed the connection (P1017), the interactive
// transaction expired (P2028, e.g. while waiting for the advisory lock held by
// another replica), or a write conflict / deadlock (P2034).
const TRANSIENT_PRISMA_ERROR_CODES = new Set([
  'P1001',
  'P1002',
  'P1008',
  'P1017',
  'P2024',
  'P2028',
  'P2034',
])

// Socket errors from the pg driver and PostgreSQL SQLSTATE codes for a database
// that is still starting up, refusing further connections, or that dropped the
// connection or deadlocked.
const TRANSIENT_DRIVER_ERROR_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  '08001',
  '08003',
  '08006',
  '40001',
  '40P01',
  '53300',
  '57P03',
])

const TRANSIENT_ERROR_MESSAGES = [
  'connection',
  'timeout',
  'econnrefused',
  'enotfound',
  'database unavailable',
  'too many connections',
]

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  // Prisma request errors expose `code`; client initialization errors expose
  // `errorCode`.
  const { code, errorCode } = error as { code?: unknown; errorCode?: unknown }
  if (typeof code === 'string') return code
  if (typeof errorCode === 'string') return errorCode
  return undefined
}

function isTransientDatabaseError(error: unknown): boolean {
  const code = getErrorCode(error)
  if (
    code !== undefined &&
    (TRANSIENT_PRISMA_ERROR_CODES.has(code) ||
      TRANSIENT_DRIVER_ERROR_CODES.has(code))
  ) {
    return true
  }

  if (!(error instanceof Error)) return false

  if (
    error.cause !== undefined &&
    error.cause !== error &&
    isTransientDatabaseError(error.cause)
  ) {
    return true
  }

  const message = error.message.toLowerCase()
  return TRANSIENT_ERROR_MESSAGES.some((fragment) => message.includes(fragment))
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return getErrorCode(error) === 'P2002'
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms))
}

// Runtime data migrations that run once on backend startup. Entries are removed
// again after they have been applied in every environment, so this list is
// intentionally empty most of the time.
const migrations: Migration[] = []

async function runIdempotentMigration(
  prisma: PrismaClient,
  { id, migrate: runMigration }: Migration
): Promise<MigrationOutcome> {
  const existing = await prisma.migration.findFirst({ where: { id } })
  if (existing !== null) return 'skipped'

  console.log(`Migrating ${id} (idempotent mode without transaction)`)

  await runMigration(prisma)
  try {
    await prisma.migration.create({ data: { id } })
  } catch (error) {
    // Another replica recorded this migration concurrently; the migration
    // itself is idempotent so this is safe to skip.
    if (!isUniqueConstraintViolation(error)) throw error
  }

  return 'applied'
}

async function runTransactionalMigration(
  prisma: PrismaClient,
  { id, migrate: runMigration }: Migration
): Promise<MigrationOutcome> {
  // The advisory lock serializes concurrent replicas: a second pod blocks until
  // the first pod's transaction commits, then sees the migration record and
  // skips the work. hashtext maps the migration id to the bigint key
  // PostgreSQL advisory locks require.
  return prisma.$transaction(
    async (tx: PrismaMigrationClient): Promise<MigrationOutcome> => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}))`

      const existing = await tx.migration.findFirst({ where: { id } })
      if (existing !== null) return 'skipped'

      console.log(`Migrating ${id} (with transaction)`)
      await runMigration(tx)
      await tx.migration.create({ data: { id } })

      return 'applied'
    },
    {
      timeout: MIGRATION_TRANSACTION_TIMEOUT_MS,
    }
  )
}

async function runWithRetry(
  id: string,
  run: () => Promise<MigrationOutcome>,
  retryBaseDelayMs: number,
  attempt = 1
): Promise<MigrationOutcome> {
  try {
    return await run()
  } catch (error) {
    if (
      attempt >= MIGRATION_RETRY_ATTEMPTS ||
      !isTransientDatabaseError(error)
    ) {
      throw error
    }

    const delay = retryBaseDelayMs * 2 ** (attempt - 1)
    console.warn(
      `Migration ${id} attempt ${attempt}/${MIGRATION_RETRY_ATTEMPTS} failed (transient), retrying in ${delay}ms: `,
      error
    )
    await sleep(delay)

    return runWithRetry(id, run, retryBaseDelayMs, attempt + 1)
  }
}

export async function migrate(
  prisma: PrismaClient,
  {
    registry = migrations,
    retryBaseDelayMs = MIGRATION_RETRY_BASE_DELAY_MS,
  }: MigrateOptions = {}
) {
  for (const migration of registry) {
    const outcome = await runWithRetry(
      migration.id,
      () =>
        migration.isIdempotent
          ? runIdempotentMigration(prisma, migration)
          : runTransactionalMigration(prisma, migration),
      retryBaseDelayMs
    )

    if (outcome === 'applied') {
      console.log(`Migrated ${migration.id}`)
    } else {
      console.log(`Migration ${migration.id} already applied, skipping`)
    }
  }
}

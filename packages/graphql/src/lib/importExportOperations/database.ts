import { PrismaClient } from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { createHash } from 'node:crypto'
import { Client } from 'pg'
import { ImportExportOperationError, resolveDatabaseUrl } from './runtime.js'

export type OperationsPrisma = PrismaClient
type AdvisoryLockSession = Pick<
  Client,
  'connect' | 'end' | 'off' | 'on' | 'query'
>
type AdvisoryLockSessionFactory = () => AdvisoryLockSession

const databaseUrlByClient = new WeakMap<OperationsPrisma, string>()
const IMPORT_EXPORT_ADVISORY_LOCK_NAMESPACE = 1262836053
const IMPORT_EXPORT_ROLLOUT_LOCK_KEY = 1

export function createOperationsPrisma(env: NodeJS.ProcessEnv = process.env) {
  const connectionString = resolveDatabaseUrl(env)
  const adapter = new PrismaPg({
    connectionString,
    max: 1,
  })
  const prisma = new PrismaClient({ adapter, log: [] })
  databaseUrlByClient.set(prisma, connectionString)
  return prisma
}

export async function getOperationsDatabaseIdentity(prisma: OperationsPrisma) {
  const rows = await prisma.$queryRaw<
    Array<{
      databaseName: string
      serverAddress: string | null
      serverPort: number | null
    }>
  >`
    SELECT current_database()::text AS "databaseName",
           inet_server_addr()::text AS "serverAddress",
           inet_server_port()::integer AS "serverPort"
  `
  const row = rows[0]
  if (!row?.databaseName) {
    throw new ImportExportOperationError('DATABASE_IDENTITY_UNAVAILABLE')
  }
  return createHash('sha256')
    .update(
      JSON.stringify([
        row.databaseName,
        row.serverAddress ?? 'local',
        row.serverPort ?? 0,
      ])
    )
    .digest('hex')
}

export async function withAdvisoryLock<T>({
  prisma,
  run,
  createSession,
}: {
  prisma: OperationsPrisma
  run: (assertLockHeld: () => void) => Promise<T>
  createSession?: AdvisoryLockSessionFactory
}) {
  const connectionString = databaseUrlByClient.get(prisma)
  if (!createSession && !connectionString) {
    throw new ImportExportOperationError('ADVISORY_LOCK_SESSION_UNAVAILABLE')
  }
  const session = createSession?.() ?? new Client({ connectionString })
  let connectionLost = false
  const handleConnectionError = () => {
    connectionLost = true
  }
  const assertLockHeld = () => {
    if (connectionLost) {
      throw new ImportExportOperationError('ADVISORY_LOCK_CONNECTION_LOST')
    }
  }
  let acquired = false
  let result: T | undefined
  let primaryError: unknown

  try {
    session.on('error', handleConnectionError)
    await session.connect()
    const lock = await session.query(
      'SELECT pg_try_advisory_lock($1, $2) AS acquired',
      [IMPORT_EXPORT_ADVISORY_LOCK_NAMESPACE, IMPORT_EXPORT_ROLLOUT_LOCK_KEY]
    )
    acquired = lock.rows[0]?.acquired === true
    if (!acquired) {
      throw new ImportExportOperationError('OPERATION_ALREADY_RUNNING')
    }
    result = await run(assertLockHeld)
    assertLockHeld()
  } catch (error) {
    primaryError = error
  } finally {
    let releaseFailed = false
    if (acquired && !connectionLost) {
      try {
        const unlock = await session.query(
          'SELECT pg_advisory_unlock($1, $2) AS released',
          [
            IMPORT_EXPORT_ADVISORY_LOCK_NAMESPACE,
            IMPORT_EXPORT_ROLLOUT_LOCK_KEY,
          ]
        )
        releaseFailed = unlock.rows[0]?.released !== true
      } catch {
        releaseFailed = true
      }
    }
    session.off('error', handleConnectionError)
    try {
      await session.end()
    } catch {
      releaseFailed = true
    }
    if (!primaryError && (connectionLost || releaseFailed)) {
      primaryError = new ImportExportOperationError(
        connectionLost
          ? 'ADVISORY_LOCK_CONNECTION_LOST'
          : 'ADVISORY_LOCK_RELEASE_FAILED'
      )
    }
  }

  if (primaryError) throw primaryError
  return result as T
}

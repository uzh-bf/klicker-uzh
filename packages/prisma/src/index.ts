import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './client.js'
import {
  createGuardablePoolConfig,
  requireDisposableDatabase,
  validateDisposableDatabaseUrl,
} from './disposableDatabase.js'

export * from './chatAccountUsage.js'
export { requireDisposableDatabase } from './disposableDatabase.js'

// TODO: figure out whether using Pool with pg is a good idea for us (or does pgbouncer do that server-side)
// import { Pool } from 'pg'
// const pool = new Pool(poolConfig)

const globalForPrisma = global as unknown as { prisma: PrismaClient }

// Parse log levels from environment variable, fallback to default levels
const validLevels = ['query', 'info', 'warn', 'error'] as const
type PrismaLogLevel = (typeof validLevels)[number]

const getLogLevels = (): Array<PrismaLogLevel> => {
  const logLevelsEnv = process.env.PRISMA_LOG_LEVELS
  if (!logLevelsEnv) {
    return ['warn', 'error']
  }

  const levels = logLevelsEnv
    .split(',')
    .map((level) => level.trim())
    .filter((level) =>
      validLevels.includes(level as any)
    ) as Array<PrismaLogLevel>

  return levels.length > 0 ? levels : ['warn', 'error']
}

function createPrismaClient(
  connectionString = process.env.DATABASE_URL
): PrismaClient {
  const guard = createGuardablePoolConfig(connectionString)
  // TODO other optimization params? move prisma optimize etc. here?
  const adapter = new PrismaPg(guard.config)

  const client = new PrismaClient({
    adapter,
    log: getLogLevels(),
  })
  guard.register(client)
  return client
}

export async function createDisposableTestPrismaClient(
  connectionString: string
) {
  validateDisposableDatabaseUrl(connectionString)
  const client = createPrismaClient(connectionString)
  try {
    await requireDisposableDatabase(client)
    return client
  } catch (error) {
    await client.$disconnect()
    throw error
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './client.js'

export * from './chatAccountUsage.js'
export * from './chatbotPromptCatalog.js'
export { DEFAULT_TUTOR_PROMPT } from './chatbotPromptDefaults.js'
export type { ChatbotPromptProjection } from './chatbotPromptProjection.js'
export { projectLegacySystemPrompts } from './chatbotPromptProjection.js'

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

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    // TODO other optimization params? move prisma optimize etc. here?
  })

  return new PrismaClient({
    adapter,
    log: getLogLevels(),
  })
}

export const prisma = globalForPrisma.prisma || createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

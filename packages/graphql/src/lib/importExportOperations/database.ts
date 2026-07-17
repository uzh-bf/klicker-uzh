import { PrismaClient } from '@klicker-uzh/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { ImportExportOperationError, resolveDatabaseUrl } from './runtime.js'

export type OperationsPrisma = PrismaClient

export function createOperationsPrisma(env: NodeJS.ProcessEnv = process.env) {
  const adapter = new PrismaPg({
    connectionString: resolveDatabaseUrl(env),
    max: 1,
  })
  return new PrismaClient({ adapter, log: [] })
}

export async function withAdvisoryLock<T>({
  prisma,
  operationKey,
  run,
}: {
  prisma: OperationsPrisma
  operationKey: number
  run: () => Promise<T>
}) {
  const namespaceKey = 1262836053
  const lock = await prisma.$queryRaw<
    Array<{ acquired: boolean }>
  >`SELECT pg_try_advisory_lock(${namespaceKey}, ${operationKey}) AS acquired`
  if (!lock[0]?.acquired) {
    throw new ImportExportOperationError('OPERATION_ALREADY_RUNNING')
  }
  try {
    return await run()
  } finally {
    await prisma.$queryRaw<
      Array<{ released: boolean }>
    >`SELECT pg_advisory_unlock(${namespaceKey}, ${operationKey}) AS released`
  }
}

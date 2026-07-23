import type { PrismaClient } from '@klicker-uzh/prisma/client'

/**
 * Narrows a Prisma model delegate to read-only operations only.
 * Write methods (create, update, delete, upsert) are excluded at the type level.
 */
type ReadonlyDelegate<T> = {
  [K in keyof T as K extends
    | 'findMany'
    | 'findFirst'
    | 'findFirstOrThrow'
    | 'findUnique'
    | 'findUniqueOrThrow'
    | 'count'
    | 'aggregate'
    | 'groupBy'
    ? K
    : never]: T[K]
}

/**
 * A read-only subset of PrismaClient where every model delegate
 * only exposes read operations. Prevents accidental writes at compile time.
 */
export type ReadonlyPrismaClient = {
  [K in keyof PrismaClient as PrismaClient[K] extends { findMany: any }
    ? K
    : never]: ReadonlyDelegate<PrismaClient[K]>
}

const WRITE_BLOCKED_MSG = 'Write blocked: read-only export client'

const ALLOWED_OPERATIONS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
])

export function createReadonlyClient(
  prisma: PrismaClient
): ReadonlyPrismaClient {
  // Top-level $allOperations intercepts BOTH model operations and top-level
  // raw queries ($queryRaw/$executeRaw/$queryRawUnsafe/$executeRawUnsafe), so
  // raw writes (and raw reads, which could mutate) are blocked too — not just
  // model-level writes. Only the read operations in ALLOWED_OPERATIONS pass.
  return prisma.$extends({
    query: {
      async $allOperations({ operation, query, args }) {
        if (!ALLOWED_OPERATIONS.has(operation)) {
          throw new Error(`${WRITE_BLOCKED_MSG} (attempted: ${operation})`)
        }
        return query(args)
      },
    },
  }) as unknown as ReadonlyPrismaClient
}

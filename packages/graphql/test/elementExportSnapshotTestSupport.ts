import { prisma } from '@klicker-uzh/prisma'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../src/lib/context.js'

export function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

export async function waitForBarrier(
  barrier: Promise<void>,
  operation: Promise<unknown>
) {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      barrier,
      operation.then(
        () => {
          throw new Error(
            'Operation completed before reaching its test barrier.'
          )
        },
        (error) => {
          throw error
        }
      ),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error('Operation did not reach its test barrier.')),
          5_000
        )
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function hasNestedErrorCode(error: unknown, expectedCode: string) {
  const pending: unknown[] = [error]
  const seen = new Set<object>()
  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    if (
      Reflect.get(current, 'code') === expectedCode ||
      Reflect.get(current, 'originalCode') === expectedCode
    ) {
      return true
    }
    for (const key of ['meta', 'cause', 'driverAdapterError']) {
      pending.push(Reflect.get(current, key))
    }
  }
  return false
}

export function restoreEnvironmentVariable(
  name: string,
  value: string | undefined
) {
  if (typeof value === 'undefined') {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

export function transactionContext(
  ctx: ContextWithUser,
  transactionPrisma: PrismaTransactionContextWithUser['prisma']
): PrismaTransactionContextWithUser {
  return { ...ctx, prisma: transactionPrisma }
}

export type BoundedLockObservation = {
  query: 'entries' | 'selectedItems'
  rowCount: number
}

export function observeBoundedLockQueries(
  transactionPrisma: PrismaTransactionContextWithUser['prisma'],
  observations: BoundedLockObservation[]
) {
  return new Proxy(transactionPrisma, {
    get(target, property, receiver) {
      if (property === '$queryRaw') {
        return async (...args: unknown[]) => {
          const queryRaw = Reflect.get(target, property, target) as (
            ...queryArgs: unknown[]
          ) => Promise<unknown>
          const result = await Reflect.apply(queryRaw, target, args)
          const template = args[0]
          const sql = Array.isArray(template) ? template.join('?') : ''
          if (Array.isArray(result)) {
            if (sql.includes('bounded_entries_per_collection')) {
              observations.push({ query: 'entries', rowCount: result.length })
            } else if (sql.includes('bounded_selected_relations')) {
              observations.push({
                query: 'selectedItems',
                rowCount: result.length,
              })
            }
          }
          return result
        }
      }
      const value = Reflect.get(target, property, receiver)
      return typeof value === 'function' ? value.bind(target) : value
    },
  }) as PrismaTransactionContextWithUser['prisma']
}

export function withElementReadBarrier(ctx: ContextWithUser) {
  const afterFirstElementRead = deferred()
  const resume = deferred()
  const prismaWithBarrier = {
    $transaction: async (
      callback: (
        tx: PrismaTransactionContextWithUser['prisma']
      ) => Promise<unknown>,
      options: Parameters<typeof prisma.$transaction>[1]
    ) =>
      await prisma.$transaction(async (tx) => {
        let elementReads = 0
        const element = new Proxy(tx.element, {
          get(target, property, receiver) {
            if (property === 'findMany') {
              return async (
                ...args: Parameters<typeof tx.element.findMany>
              ) => {
                const result = await tx.element.findMany(...args)
                elementReads += 1
                if (elementReads === 1) {
                  afterFirstElementRead.resolve()
                  await resume.promise
                }
                return result
              }
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
        const transactionClient = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === 'element') return element
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }) as PrismaTransactionContextWithUser['prisma']

        return await callback(transactionClient)
      }, options),
  } as unknown as ContextWithUser['prisma']

  return {
    ctx: { ...ctx, prisma: prismaWithBarrier },
    afterFirstElementRead,
    resume,
  }
}

export function withAnswerCollectionReadBarrier(ctx: ContextWithUser) {
  const afterFirstCollectionRead = deferred()
  const resume = deferred()
  const prismaWithBarrier = {
    $transaction: async (
      callback: (
        tx: PrismaTransactionContextWithUser['prisma']
      ) => Promise<unknown>,
      options: Parameters<typeof prisma.$transaction>[1]
    ) =>
      await prisma.$transaction(async (tx) => {
        let collectionReads = 0
        const answerCollection = new Proxy(tx.answerCollection, {
          get(target, property, receiver) {
            if (property === 'findMany') {
              return async (
                ...args: Parameters<typeof tx.answerCollection.findMany>
              ) => {
                const result = await tx.answerCollection.findMany(...args)
                collectionReads += 1
                if (collectionReads === 1) {
                  afterFirstCollectionRead.resolve()
                  await resume.promise
                }
                return result
              }
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
        const transactionClient = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === 'answerCollection') return answerCollection
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }) as PrismaTransactionContextWithUser['prisma']

        return await callback(transactionClient)
      }, options),
  } as unknown as ContextWithUser['prisma']

  return {
    ctx: { ...ctx, prisma: prismaWithBarrier },
    afterFirstCollectionRead,
    resume,
  }
}

export function withAnswerCollectionEntryWriteBarrier(ctx: ContextWithUser) {
  const afterEntryWrite = deferred()
  const resume = deferred()
  const prismaWithBarrier = {
    $transaction: async (
      callback: (
        tx: PrismaTransactionContextWithUser['prisma']
      ) => Promise<unknown>,
      options: Parameters<typeof prisma.$transaction>[1]
    ) =>
      await prisma.$transaction(async (tx) => {
        const answerCollectionEntry = new Proxy(tx.answerCollectionEntry, {
          get(target, property, receiver) {
            if (property === 'update') {
              return async (
                ...args: Parameters<typeof tx.answerCollectionEntry.update>
              ) => {
                const result = await tx.answerCollectionEntry.update(...args)
                afterEntryWrite.resolve()
                await resume.promise
                return result
              }
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
        const transactionClient = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === 'answerCollectionEntry') {
              return answerCollectionEntry
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }) as PrismaTransactionContextWithUser['prisma']

        return await callback(transactionClient)
      }, options),
  } as unknown as ContextWithUser['prisma']

  return {
    ctx: { ...ctx, prisma: prismaWithBarrier },
    afterEntryWrite,
    resume,
  }
}

export function withElementMaterializationCounter(ctx: ContextWithUser) {
  let fullElementReads = 0
  let rawQueries = 0
  const prismaWithCounter = {
    $transaction: async (
      callback: (
        tx: PrismaTransactionContextWithUser['prisma']
      ) => Promise<unknown>,
      options: Parameters<typeof prisma.$transaction>[1]
    ) =>
      await prisma.$transaction(async (tx) => {
        const element = new Proxy(tx.element, {
          get(target, property, receiver) {
            if (property === 'findMany') {
              return async (
                ...args: Parameters<typeof tx.element.findMany>
              ) => {
                if (args[0]?.select?.answerCollectionItems) {
                  fullElementReads += 1
                }
                return await tx.element.findMany(...args)
              }
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        })
        const transactionClient = new Proxy(tx, {
          get(target, property, receiver) {
            if (property === 'element') return element
            if (property === '$queryRaw') {
              return async (
                ...args: Parameters<typeof tx.$queryRaw>
              ): Promise<unknown> => {
                rawQueries += 1
                return await tx.$queryRaw(...args)
              }
            }
            const value = Reflect.get(target, property, receiver)
            return typeof value === 'function' ? value.bind(target) : value
          },
        }) as PrismaTransactionContextWithUser['prisma']

        return await callback(transactionClient)
      }, options),
  } as unknown as ContextWithUser['prisma']

  return {
    ctx: { ...ctx, prisma: prismaWithCounter },
    observations: () => ({ fullElementReads, rawQueries }),
  }
}

import { prisma } from '@klicker-uzh/prisma'
import {
  ElementStatus,
  ElementType,
  ImportExportPackageArtifactDirection,
  ImportExportPackageArtifactState,
  PermissionLevel,
  Prisma,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import type {
  ContextWithUser,
  PrismaTransactionContextWithUser,
} from '../src/lib/context.js'
import {
  ImportExportDomainError,
  ImportExportErrorCode,
} from '../src/lib/importExportErrors.js'
import {
  MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_CONTENT_LENGTH,
  MAX_IMPORT_EXPORT_PACKAGE_BYTES,
  MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES,
  MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS,
} from '../src/lib/importExportPackageConfig.js'
import {
  assertElementExportSnapshotPublishable,
  loadElementExportSnapshot,
} from '../src/services/elementExportSnapshot.js'
import { completeImportExportPackageArtifact } from '../src/services/importExportPersistence.js'
import { editAnswerCollectionEntry } from '../src/services/resources.js'

function deferred() {
  let resolve!: () => void
  let reject!: (error: unknown) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

async function waitForBarrier(
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

function hasNestedErrorCode(error: unknown, expectedCode: string) {
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

function restoreEnvironmentVariable(name: string, value: string | undefined) {
  if (typeof value === 'undefined') {
    delete process.env[name]
  } else {
    process.env[name] = value
  }
}

function transactionContext(
  ctx: ContextWithUser,
  transactionPrisma: PrismaTransactionContextWithUser['prisma']
): PrismaTransactionContextWithUser {
  return { ...ctx, prisma: transactionPrisma }
}

type BoundedLockObservation = {
  query: 'entries' | 'selectedItems'
  rowCount: number
}

function observeBoundedLockQueries(
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

function withElementReadBarrier(ctx: ContextWithUser) {
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

function withAnswerCollectionReadBarrier(ctx: ContextWithUser) {
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

function withAnswerCollectionEntryWriteBarrier(ctx: ContextWithUser) {
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

function withElementMaterializationCounter(ctx: ContextWithUser) {
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

describe('coherent element export snapshots and publication', () => {
  const originalEnabled = process.env.IMPORT_EXPORT_ENABLED
  const originalPrivatePreview = process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY
  let ownerId: string
  let ctx: ContextWithUser
  let collectionId: number
  let oldEntryId: number
  let newEntryId: number
  let elementId: number

  beforeEach(async () => {
    process.env.IMPORT_EXPORT_ENABLED = 'true'
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'false'
    ownerId = randomUUID()
    await prisma.user.create({
      data: {
        id: ownerId,
        name: 'Export snapshot owner',
        email: `export-snapshot-${ownerId}@example.invalid`,
        shortname: `export-snapshot-${ownerId.slice(0, 8)}`,
        role: UserRole.USER,
        privatePreview: true,
      },
    })
    const collection = await prisma.answerCollection.create({
      data: {
        name: 'Snapshot collection',
        description: 'Snapshot collection description',
        ownerId,
        entries: {
          create: [{ value: 'Old selected entry' }, { value: 'New entry' }],
        },
      },
      include: { entries: { orderBy: { value: 'asc' } } },
    })
    collectionId = collection.id
    newEntryId = collection.entries[0]!.id
    oldEntryId = collection.entries[1]!.id
    const element = await prisma.element.create({
      data: {
        name: 'Snapshot selection',
        content: 'Old coherent content',
        explanation: 'Old coherent explanation',
        type: ElementType.SELECTION,
        status: ElementStatus.READY,
        options: { hasSampleSolution: true, numberOfInputs: 1 },
        basePoints: true,
        pointsMultiplier: 1,
        ownerId,
        answerCollectionId: collectionId,
        answerCollectionItems: { connect: { id: oldEntryId } },
      },
    })
    elementId = element.id
    await prisma.derivedPermission.createMany({
      data: [
        {
          userId: ownerId,
          elementId,
          permissionLevel: PermissionLevel.OWNER,
        },
        {
          userId: ownerId,
          answerCollectionId: collectionId,
          permissionLevel: PermissionLevel.OWNER,
        },
      ],
    })
    ctx = {
      user: {
        sub: ownerId,
        role: UserRole.USER,
        scope: UserLoginScope.FULL_ACCESS,
        catalystInstitutional: false,
        catalystIndividual: false,
      },
      prisma,
      emitter: { emit: vi.fn() },
      tasks: {
        refreshImportExportFingerprints: {
          runNoWait: vi.fn().mockResolvedValue(undefined),
        },
      },
    } as unknown as ContextWithUser
  })

  afterEach(async () => {
    await prisma.importExportPackageArtifact.deleteMany({
      where: { ownerId },
    })
    await prisma.user.deleteMany({ where: { id: ownerId } })
    restoreEnvironmentVariable('IMPORT_EXPORT_ENABLED', originalEnabled)
    restoreEnvironmentVariable(
      'IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY',
      originalPrivatePreview
    )
  })

  it('keeps a same-count selected relation swap in one repeatable-read snapshot', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          DELETE FROM "_ElementAnswerCollectionUsedItems"
          WHERE "A" = ${oldEntryId} AND "B" = ${elementId}
        `
        await tx.$executeRaw`
          INSERT INTO "_ElementAnswerCollectionUsedItems" ("A", "B")
          VALUES (${newEntryId}, ${elementId})
        `
      })
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      explanation: 'Old coherent explanation',
      answerCollectionItems: [{ id: oldEntryId }],
    })

    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      explanation: 'Old coherent explanation',
      answerCollectionItems: [{ id: newEntryId }],
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps content and options from one database snapshot', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$executeRaw`
        UPDATE "Element"
        SET
          "content" = ${'New coherent content'},
          "options" = ${JSON.stringify({
            hasSampleSolution: false,
            numberOfInputs: 2,
          })}::jsonb
        WHERE "id" = ${elementId}
      `
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.elements[0]).toMatchObject({
      content: 'Old coherent content',
      options: { hasSampleSolution: true, numberOfInputs: 1 },
    })
    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.elements[0]).toMatchObject({
      content: 'New coherent content',
      options: { hasSampleSolution: false, numberOfInputs: 2 },
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps collection metadata and entry values from one database snapshot', async () => {
    const barrier = withAnswerCollectionReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(
      barrier.afterFirstCollectionRead.promise,
      snapshotPromise
    )

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`
          UPDATE "AnswerCollection"
          SET "name" = ${'New collection name'}
          WHERE "id" = ${collectionId}
        `
        await tx.$executeRaw`
          UPDATE "AnswerCollectionEntry"
          SET "value" = ${'Changed selected entry'}
          WHERE "id" = ${oldEntryId}
        `
      })
    } finally {
      barrier.resume.resolve()
    }

    const oldSnapshot = await snapshotPromise
    expect(oldSnapshot.answerCollections[0]).toMatchObject({
      name: 'Snapshot collection',
      entries: expect.arrayContaining([
        expect.objectContaining({
          id: oldEntryId,
          value: 'Old selected entry',
        }),
      ]),
    })
    const newSnapshot = await loadElementExportSnapshot([elementId], ctx)
    expect(newSnapshot.answerCollections[0]).toMatchObject({
      name: 'New collection name',
      entries: expect.arrayContaining([
        expect.objectContaining({
          id: oldEntryId,
          value: 'Changed selected entry',
        }),
      ]),
    })
    expect(newSnapshot.revision.token).not.toBe(oldSnapshot.revision.token)
  })

  it('keeps later element batches on the same repeatable-read database snapshot', async () => {
    const elements = await Promise.all(
      Array.from({ length: 21 }, (_, index) =>
        prisma.element.create({
          data: {
            name: `Batched snapshot element ${index + 1}`,
            content: `Old batched content ${index + 1}`,
            type: ElementType.CONTENT,
            status: ElementStatus.READY,
            options: {},
            basePoints: false,
            pointsMultiplier: 1,
            ownerId,
          },
        })
      )
    )
    await prisma.derivedPermission.createMany({
      data: elements.map(({ id }) => ({
        userId: ownerId,
        elementId: id,
        permissionLevel: PermissionLevel.OWNER,
      })),
    })
    const target = elements.at(-1)!
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot(
      elements.map(({ id }) => id),
      barrier.ctx
    )
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.element.update({
        where: { id: target.id },
        data: {
          content: 'New content committed between export batches',
          version: { increment: 1 },
        },
      })
    } finally {
      barrier.resume.resolve()
    }

    const snapshot = await snapshotPromise
    expect(snapshot.elements.at(-1)?.content).toBe('Old batched content 21')
    await expect(
      loadElementExportSnapshot([target.id], ctx)
    ).resolves.toMatchObject({
      elements: [{ content: 'New content committed between export batches' }],
    })
  })

  it('rejects aggregate source bytes before materializing full element records', async () => {
    const maximumText = '\u0800'.repeat(MAX_IMPORT_EXPORT_CONTENT_LENGTH)
    await prisma.element.createMany({
      data: Array.from({ length: 9 }, (_, index) => ({
        name: `Aggregate source element ${index + 1}`,
        content: maximumText,
        explanation: maximumText,
        type: ElementType.SC,
        status: ElementStatus.READY,
        options: {
          displayMode: 'LIST',
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          choices: [
            { ix: 0, value: 'A' },
            { ix: 1, value: 'B' },
          ],
        },
        basePoints: true,
        pointsMultiplier: 1,
        ownerId,
      })),
    })
    const oversizedElements = await prisma.element.findMany({
      where: {
        ownerId,
        name: { startsWith: 'Aggregate source element ' },
      },
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    await prisma.derivedPermission.createMany({
      data: oversizedElements.map(({ id }) => ({
        userId: ownerId,
        elementId: id,
        permissionLevel: PermissionLevel.OWNER,
      })),
    })
    expect(
      oversizedElements.length * Buffer.byteLength(maximumText, 'utf8') * 2
    ).toBeGreaterThan(MAX_IMPORT_EXPORT_PACKAGE_BYTES)
    const counter = withElementMaterializationCounter(ctx)

    await expect(
      loadElementExportSnapshot(
        oversizedElements.map(({ id }) => id),
        counter.ctx
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_PACKAGE_TOO_LARGE,
    })
    expect(counter.observations()).toEqual({
      fullElementReads: 0,
      rawQueries: 1,
    })
  })

  it('keeps authorization coherent during the snapshot and rejects the stale revision at publication', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$executeRaw`
        UPDATE "DerivedPermission"
        SET "permissionLevel" = 'WRITE'::"PermissionLevel"
        WHERE "userId" = ${ownerId}::uuid AND "elementId" = ${elementId}
      `
    } finally {
      barrier.resume.resolve()
    }

    const snapshot = await snapshotPromise
    expect(snapshot.elements[0]?.exportPermission).toBe(PermissionLevel.OWNER)
    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            snapshot.revision,
            transactionContext(ctx, tx)
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
  })

  it('keeps deletion coherent during the snapshot and rejects the stale revision at publication', async () => {
    const barrier = withElementReadBarrier(ctx)
    const snapshotPromise = loadElementExportSnapshot([elementId], barrier.ctx)
    await waitForBarrier(barrier.afterFirstElementRead.promise, snapshotPromise)

    try {
      await prisma.$executeRaw`
        UPDATE "Element"
        SET "isDeleted" = true
        WHERE "id" = ${elementId}
      `
    } finally {
      barrier.resume.resolve()
    }

    await expect(snapshotPromise).resolves.toMatchObject({
      elements: [{ id: elementId }],
    })
    const snapshot = await snapshotPromise
    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            snapshot.revision,
            transactionContext(ctx, tx)
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
  })

  it('rejects any source or final authorization change before publication', async () => {
    const sourceSnapshot = await loadElementExportSnapshot([elementId], ctx)
    await prisma.element.update({
      where: { id: elementId },
      data: {
        content: 'Changed before publication',
        version: { increment: 1 },
      },
    })

    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            sourceSnapshot.revision,
            transactionContext(ctx, tx)
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })

    const permissionSnapshot = await loadElementExportSnapshot([elementId], ctx)
    await prisma.derivedPermission.updateMany({
      where: { userId: ownerId, elementId },
      data: { permissionLevel: PermissionLevel.WRITE },
    })
    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            permissionSnapshot.revision,
            transactionContext(ctx, tx)
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
  })

  it('fails a contended publication guard without deadlocking the authoring entry edit', async () => {
    const snapshot = await loadElementExportSnapshot([elementId], ctx)
    const barrier = withAnswerCollectionEntryWriteBarrier(ctx)
    const writer = editAnswerCollectionEntry(
      {
        id: oldEntryId,
        collectionId,
        value: 'Authoring edit wins after export retry',
      },
      barrier.ctx
    )
    await waitForBarrier(barrier.afterEntryWrite.promise, writer)

    try {
      await expect(
        prisma.$transaction(
          async (tx) =>
            await assertElementExportSnapshotPublishable(
              snapshot.revision,
              transactionContext(ctx, tx)
            ),
          { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
        )
      ).rejects.toMatchObject({
        code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
      })
    } finally {
      barrier.resume.resolve()
    }

    await expect(writer).resolves.toMatchObject({
      id: oldEntryId,
      value: 'Authoring edit wins after export retry',
    })
    await expect(
      prisma.answerCollectionEntry.findUnique({
        where: { id: oldEntryId },
        select: { value: true },
      })
    ).resolves.toEqual({ value: 'Authoring edit wins after export retry' })
  })

  it('rejects oversized collection entries after locking only the bounded maximum plus one', async () => {
    const snapshot = await loadElementExportSnapshot([elementId], ctx)
    await prisma.answerCollectionEntry.createMany({
      data: Array.from(
        { length: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 25 },
        (_, index) => ({
          collectionId,
          value: `Oversized collection entry ${index + 1}`,
        })
      ),
    })
    const observations: BoundedLockObservation[] = []

    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            snapshot.revision,
            transactionContext(ctx, observeBoundedLockQueries(tx, observations))
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10_000,
        }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
    expect(observations).toContainEqual({
      query: 'entries',
      rowCount: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1,
    })
    expect(
      observations.find(({ query }) => query === 'entries')?.rowCount
    ).toBeLessThan(MAX_IMPORT_EXPORT_TOTAL_ANSWER_COLLECTION_ENTRIES + 1)
  })

  it('rejects oversized selected relations after locking only the bounded maximum plus one', async () => {
    const snapshot = await loadElementExportSnapshot([elementId], ctx)
    const unrelatedCollection = await prisma.answerCollection.create({
      data: {
        name: 'Oversized selected relation source',
        description: 'Entries used to verify bounded publication locking',
        ownerId,
      },
    })
    await prisma.answerCollectionEntry.createMany({
      data: Array.from(
        { length: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 25 },
        (_, index) => ({
          collectionId: unrelatedCollection.id,
          value: `Oversized selected relation ${index + 1}`,
        })
      ),
    })
    await prisma.$executeRaw`
      INSERT INTO "_ElementAnswerCollectionUsedItems" ("A", "B")
      SELECT entry."id", ${elementId}
      FROM "AnswerCollectionEntry" entry
      WHERE entry."collectionId" = ${unrelatedCollection.id}
    `
    const observations: BoundedLockObservation[] = []

    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            snapshot.revision,
            transactionContext(ctx, observeBoundedLockQueries(tx, observations))
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10_000,
        }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
    expect(observations).toContainEqual({
      query: 'selectedItems',
      rowCount: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES + 1,
    })
  })

  it('accepts the aggregate selected-item maximum and rejects one additional relation', async () => {
    await prisma.answerCollectionEntry.createMany({
      data: Array.from(
        { length: MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES - 2 },
        (_, index) => ({
          collectionId,
          value: `Aggregate selected entry ${index + 1}`,
        })
      ),
    })
    const entryIds = (
      await prisma.answerCollectionEntry.findMany({
        where: { collectionId },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
    ).map(({ id }) => id)
    expect(entryIds).toHaveLength(MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES)

    const additionalElements = await Promise.all(
      [2, 3].map((suffix) =>
        prisma.element.create({
          data: {
            name: `Aggregate selection ${suffix}`,
            content: `Aggregate selection content ${suffix}`,
            type: ElementType.SELECTION,
            status: ElementStatus.READY,
            options: { hasSampleSolution: true, numberOfInputs: 1 },
            basePoints: true,
            pointsMultiplier: 1,
            ownerId,
            answerCollectionId: collectionId,
          },
        })
      )
    )
    await prisma.derivedPermission.createMany({
      data: additionalElements.map(({ id }) => ({
        userId: ownerId,
        elementId: id,
        permissionLevel: PermissionLevel.OWNER,
      })),
    })
    const selectedCounts = [
      MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
      MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES,
      MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS -
        MAX_IMPORT_EXPORT_ANSWER_COLLECTION_ENTRIES * 2,
    ]
    const selectedElementIds = [
      elementId,
      ...additionalElements.map(({ id }) => id),
    ]
    await prisma.$executeRaw`
      DELETE FROM "_ElementAnswerCollectionUsedItems"
      WHERE "B" IN (${Prisma.join(selectedElementIds)})
    `
    for (const [index, selectedElementId] of selectedElementIds.entries()) {
      await prisma.$executeRaw`
        INSERT INTO "_ElementAnswerCollectionUsedItems" ("A", "B")
        SELECT entry."id", ${selectedElementId}
        FROM "AnswerCollectionEntry" entry
        WHERE entry."collectionId" = ${collectionId}
        ORDER BY entry."id"
        LIMIT ${selectedCounts[index]!}
      `
    }

    const atLimit = await loadElementExportSnapshot(selectedElementIds, ctx)
    expect(
      atLimit.elements.reduce(
        (total, element) => total + element.answerCollectionItems.length,
        0
      )
    ).toBe(MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS)

    await prisma.$executeRaw`
      INSERT INTO "_ElementAnswerCollectionUsedItems" ("A", "B")
      VALUES (
        ${entryIds[selectedCounts[2]!]!},
        ${selectedElementIds[2]!}
      )
    `
    const observations: BoundedLockObservation[] = []
    await expect(
      prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            atLimit.revision,
            transactionContext(ctx, observeBoundedLockQueries(tx, observations))
          ),
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
          timeout: 10_000,
        }
      )
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
    expect(observations).toContainEqual({
      query: 'selectedItems',
      rowCount: MAX_IMPORT_EXPORT_TOTAL_SELECTED_ANSWER_COLLECTION_ITEMS + 1,
    })
    await expect(
      loadElementExportSnapshot(selectedElementIds, ctx)
    ).rejects.toMatchObject({
      code: ImportExportErrorCode.EXPORT_AGGREGATE_LIMIT,
    })
  })

  it('holds source locks through the READY transition so a later edit is serialized afterward', async () => {
    const snapshot = await loadElementExportSnapshot([elementId], ctx)
    const artifactId = randomUUID()
    await prisma.importExportPackageArtifact.create({
      data: {
        id: artifactId,
        ownerId,
        direction: ImportExportPackageArtifactDirection.EXPORT,
        state: ImportExportPackageArtifactState.UPLOADING,
        storageContainer: 'klicker-import-export',
        storageBlob: `exports/${ownerId}/${artifactId}.zip`,
        reservedBytes: 4,
        expiresAt: new Date(Date.now() + 60_000),
      },
    })
    const readyBeforeCommit = deferred()
    const commitPublication = deferred()
    const publication = prisma.$transaction(
      async (tx) => {
        const txCtx = transactionContext(ctx, tx)
        await assertElementExportSnapshotPublishable(snapshot.revision, txCtx)
        const completed = await completeImportExportPackageArtifact({
          prisma: tx,
          artifactId,
          ownerId,
          bytes: 4,
          sha256: 'a'.repeat(64),
        })
        expect(completed).toBe(true)
        readyBeforeCommit.resolve()
        await commitPublication.promise
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        timeout: 10_000,
      }
    )
    await waitForBarrier(readyBeforeCommit.promise, publication)

    try {
      let blockedError: unknown
      try {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'")
          await tx.element.update({
            where: { id: elementId },
            data: {
              content: 'Must wait until publication commits',
              version: { increment: 1 },
            },
          })
        })
      } catch (error) {
        blockedError = error
      }
      expect(hasNestedErrorCode(blockedError, '55P03')).toBe(true)
    } finally {
      commitPublication.resolve()
    }

    await publication
    await prisma.element.update({
      where: { id: elementId },
      data: { content: 'Serialized after READY', version: { increment: 1 } },
    })
    await expect(
      prisma.importExportPackageArtifact.findUnique({
        where: { id: artifactId },
        select: { state: true },
      })
    ).resolves.toEqual({ state: ImportExportPackageArtifactState.READY })
  })

  it('fails closed if private-preview eligibility changes before publication', async () => {
    process.env.IMPORT_EXPORT_PRIVATE_PREVIEW_ONLY = 'true'
    const snapshot = await loadElementExportSnapshot([elementId], ctx)
    await prisma.user.update({
      where: { id: ownerId },
      data: { privatePreview: false },
    })

    let thrown: unknown
    try {
      await prisma.$transaction(
        async (tx) =>
          await assertElementExportSnapshotPublishable(
            snapshot.revision,
            transactionContext(ctx, tx)
          ),
        { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted }
      )
    } catch (error) {
      thrown = error
    }
    expect(thrown).toBeInstanceOf(ImportExportDomainError)
    expect(thrown).toMatchObject({
      code: ImportExportErrorCode.EXPORT_SOURCE_CHANGED,
    })
  })
})

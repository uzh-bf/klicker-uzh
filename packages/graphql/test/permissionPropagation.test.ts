import type { Context } from '@hatchet-dev/typescript-sdk'
import { prisma as sharedPrisma } from '@klicker-uzh/prisma'
import {
  AuditLogType,
  ObjectType,
  PermissionLevel,
  PermissionPropagationCursorKind,
  PermissionPropagationMode,
  PermissionPropagationSignalSource,
  type PermissionPropagationWork,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlerGlobalContext,
  PermissionPropagationTaskInput,
} from '@klicker-uzh/types'
import { randomUUID } from 'node:crypto'
import {
  PERMISSION_PROPAGATION_RECOVERY_SLO_MS,
  acquirePermissionPropagationFence,
  handlePermissionPropagationReconciliation,
  handlePermissionPropagationWork,
  markPermissionPropagationDispatched,
  permissionPropagationKey,
  reconcilePendingPermissionPropagationWork,
  upsertPermissionPropagationWork,
  type PermissionPropagationScope,
} from '../src/services/permissionPropagation.js'

describe('durable permission propagation state', () => {
  const prisma: PrismaClient = sharedPrisma
  const workKeys = new Set<string>()
  const userIds = new Set<string>()

  afterEach(async () => {
    await prisma.auditLogEntry.deleteMany({
      where: { sourceUserId: { in: [...userIds] } },
    })
    await prisma.permissionPropagationFailure.deleteMany({
      where: { workKey: { in: [...workKeys] } },
    })
    await prisma.permissionPropagationWork.deleteMany({
      where: { key: { in: [...workKeys] } },
    })
    await prisma.permissionPropagationReconciliationState.deleteMany({
      where: { id: 'permission-propagation' },
    })
    await prisma.permissionPropagationCursor.deleteMany()
    await prisma.permissionPropagationSignalCursor.deleteMany()
    await prisma.catalogCollection.deleteMany({
      where: { ownerId: { in: [...userIds] } },
    })
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } })
    workKeys.clear()
    userIds.clear()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  function objectScope(
    objectId: string = randomUUID()
  ): PermissionPropagationScope {
    return trackScope({
      objectType: ObjectType.CATALOG_COLLECTION,
      objectId,
      mode: PermissionPropagationMode.OBJECT,
    } as const)
  }

  function trackScope<T extends PermissionPropagationScope>(scope: T) {
    workKeys.add(permissionPropagationKey(scope))
    return scope
  }

  async function createCatalogPermissionFixture(name: string) {
    const ownerId = randomUUID()
    const sharedUserId = randomUUID()
    const catalogCollectionId = randomUUID()
    const scope = objectScope(catalogCollectionId)
    userIds.add(ownerId)
    userIds.add(sharedUserId)

    await prisma.user.createMany({
      data: [
        {
          id: ownerId,
          email: `${ownerId}@example.invalid`,
          shortname: ownerId,
        },
        {
          id: sharedUserId,
          email: `${sharedUserId}@example.invalid`,
          shortname: sharedUserId,
        },
      ],
    })
    await prisma.catalogCollection.create({
      data: { id: catalogCollectionId, name, ownerId },
    })

    return { catalogCollectionId, ownerId, scope, sharedUserId }
  }

  function upsertWorkUnderFence(
    scope: PermissionPropagationScope,
    input: { dirtyAt?: Date; updateAccessRequests: boolean }
  ) {
    return prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      return upsertPermissionPropagationWork(tx, { scope, ...input })
    })
  }

  function workerContexts(client: PrismaClient = prisma) {
    const loggerError = vi.fn()
    return {
      globalCtx: { prisma: client } as HatchetHandlerGlobalContext,
      executionCtx: {
        logger: { error: loggerError },
      } as unknown as Context<unknown>,
      loggerError,
    }
  }

  it('rolls source and durable work back in the same fenced transaction', async () => {
    const { catalogCollectionId, scope, sharedUserId } =
      await createCatalogPermissionFixture(
        'Permission propagation transaction test'
      )

    await expect(
      prisma.$transaction(async (tx) => {
        await acquirePermissionPropagationFence(tx)
        await tx.permission.create({
          data: {
            catalogCollectionId,
            userId: sharedUserId,
            permissionLevel: PermissionLevel.READ,
          },
        })
        await upsertPermissionPropagationWork(tx, {
          scope,
          updateAccessRequests: false,
        })
        throw new Error('rollback test')
      })
    ).rejects.toThrow('rollback test')

    await expect(
      prisma.permission.count({
        where: { catalogCollectionId, userId: sharedUserId },
      })
    ).resolves.toBe(0)
    await expect(
      prisma.permissionPropagationWork.findUnique({
        where: { key: permissionPropagationKey(scope) },
      })
    ).resolves.toBeNull()
  })

  it('preserves the first unresolved deadline and coalesces access-request work', async () => {
    const scope = objectScope()
    const firstDirtyAt = new Date('2026-07-30T12:00:00.000Z')
    const laterDirtyAt = new Date('2026-07-30T12:01:00.000Z')

    const first = await upsertWorkUnderFence(scope, {
      dirtyAt: firstDirtyAt,
      updateAccessRequests: false,
    })
    const second = await upsertWorkUnderFence(scope, {
      dirtyAt: laterDirtyAt,
      updateAccessRequests: true,
    })
    const third = await upsertWorkUnderFence(scope, {
      dirtyAt: new Date('2026-07-30T12:02:00.000Z'),
      updateAccessRequests: false,
    })

    expect(first.generation).toBe(1n)
    expect(second.generation).toBe(2n)
    expect(third.generation).toBe(3n)
    expect(third.dirtyAt).toEqual(firstDirtyAt)
    expect(third.recoverBy).toEqual(
      new Date(firstDirtyAt.getTime() + PERMISSION_PROPAGATION_RECOVERY_SLO_MS)
    )
    expect(third.updateAccessRequests).toBe(true)
  })

  it('serializes overlapping fenced transactions on the same object', async () => {
    const scope = objectScope()
    const order: string[] = []

    // start the second transaction only once the first provably holds the fence,
    // so the assertion cannot pass or fail on scheduler timing alone
    let firstHoldsFence: () => void
    const fenceHeld = new Promise<void>((resolve) => {
      firstHoldsFence = resolve
    })

    const first = prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      order.push('first-fence')
      firstHoldsFence()
      // hold the fence long enough that the second transaction must queue on it
      await new Promise((resolve) => setTimeout(resolve, 300))
      await upsertPermissionPropagationWork(tx, {
        scope,
        updateAccessRequests: false,
      })
      order.push('first-commit')
    })
    await fenceHeld
    const second = prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      order.push('second-fence')
      await upsertPermissionPropagationWork(tx, {
        scope,
        updateAccessRequests: true,
      })
      order.push('second-commit')
    })
    await Promise.all([first, second])

    // the second transaction may not observe permission state mid-flight
    expect(order).toEqual([
      'first-fence',
      'first-commit',
      'second-fence',
      'second-commit',
    ])
    // both generations landed, so neither write was lost to a stale read
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: permissionPropagationKey(scope) },
      })
    ).resolves.toMatchObject({
      generation: 2n,
      processedGeneration: 0n,
      updateAccessRequests: true,
    })
  })

  it('resets the deadline and access-request intent after clean work', async () => {
    const scope = objectScope()
    const firstDirtyAt = new Date('2026-07-30T12:00:00.000Z')
    const nextDirtyAt = new Date('2026-07-30T13:00:00.000Z')

    const first = await upsertWorkUnderFence(scope, {
      dirtyAt: firstDirtyAt,
      updateAccessRequests: true,
    })
    await prisma.permissionPropagationWork.update({
      where: { key: first.key },
      data: { processedGeneration: first.generation },
    })

    const next = await upsertWorkUnderFence(scope, {
      dirtyAt: nextDirtyAt,
      updateAccessRequests: false,
    })

    expect(next.generation).toBe(2n)
    expect(next.dirtyAt).toEqual(nextDirtyAt)
    expect(next.recoverBy).toEqual(
      new Date(nextDirtyAt.getTime() + PERMISSION_PROPAGATION_RECOVERY_SLO_MS)
    )
    expect(next.updateAccessRequests).toBe(false)
  })

  it('advances dispatch state only for an accepted existing generation', async () => {
    const scope = objectScope()
    const work = await upsertWorkUnderFence(scope, {
      updateAccessRequests: false,
    })
    const firstAcceptedAt = new Date('2026-07-30T12:00:00.000Z')
    const repeatedAcceptedAt = new Date('2026-07-30T12:01:00.000Z')

    await expect(
      markPermissionPropagationDispatched(prisma, {
        key: work.key,
        generation: 2n,
        acceptedAt: firstAcceptedAt,
      })
    ).resolves.toBe(false)
    await expect(
      markPermissionPropagationDispatched(prisma, {
        key: work.key,
        generation: 1n,
        acceptedAt: firstAcceptedAt,
      })
    ).resolves.toBe(true)
    await expect(
      markPermissionPropagationDispatched(prisma, {
        key: work.key,
        generation: 1n,
        acceptedAt: repeatedAcceptedAt,
      })
    ).resolves.toBe(true)
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: work.key },
      })
    ).resolves.toMatchObject({
      dispatchedGeneration: 1n,
      lastDispatchedAt: repeatedAcceptedAt,
    })
  })

  it('uses UTF-8 byte lengths and lets the database reject a mismatched key', async () => {
    const scope = objectScope('é:a')
    const key = permissionPropagationKey(scope)

    expect(key).toBe('18:CATALOG_COLLECTION4:é:a6:OBJECT-:')
    await expect(
      prisma.permissionPropagationWork.create({
        data: {
          key: `${key}-mismatch`,
          objectType: scope.objectType,
          objectId: scope.objectId,
          mode: scope.mode,
          dirtyAt: new Date(),
          recoverBy: new Date(),
        },
      })
    ).rejects.toThrow()
  })

  it('enforces supported objects, scope shape, counters, and recovery windows in the database', async () => {
    const objectId = randomUUID()
    const userId = randomUUID()
    const now = new Date()

    await expect(
      prisma.permissionPropagationWork.create({
        data: {
          key: `10:USER_GROUP36:${objectId}6:OBJECT-:`,
          objectType: ObjectType.USER_GROUP,
          objectId,
          mode: PermissionPropagationMode.OBJECT,
          dirtyAt: now,
          recoverBy: now,
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.permissionPropagationWork.create({
        data: {
          key: `18:CATALOG_COLLECTION36:${objectId}6:OBJECT36:${userId}`,
          objectType: ObjectType.CATALOG_COLLECTION,
          objectId,
          mode: PermissionPropagationMode.OBJECT,
          userId,
          dirtyAt: now,
          recoverBy: now,
        },
      })
    ).rejects.toThrow()

    const scope = objectScope()
    await expect(
      prisma.permissionPropagationWork.create({
        data: {
          key: permissionPropagationKey(scope),
          objectType: scope.objectType,
          objectId: scope.objectId,
          mode: scope.mode,
          generation: 0,
          dirtyAt: now,
          recoverBy: now,
        },
      })
    ).rejects.toThrow()

    const invalidRecoveryScope = objectScope()
    await expect(
      prisma.permissionPropagationWork.create({
        data: {
          key: permissionPropagationKey(invalidRecoveryScope),
          objectType: invalidRecoveryScope.objectType,
          objectId: invalidRecoveryScope.objectId,
          mode: invalidRecoveryScope.mode,
          dirtyAt: now,
          recoverBy: new Date(now.getTime() - 1),
        },
      })
    ).rejects.toThrow()

    await expect(
      prisma.permissionPropagationReconciliationState.create({
        data: {
          id: 'permission-propagation',
          sampleObjectType: ObjectType.USER_GROUP,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.permissionPropagationSignalCursor.create({
        data: {
          source: PermissionPropagationSignalSource.PERMISSION,
          through: now,
          sourceId: 1,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.permissionPropagationSignalCursor.create({
        data: {
          source: PermissionPropagationSignalSource.DIRECT_AUDIT,
          through: now,
          sourceId: 1,
          relationId: 0,
          relationMaxId: 1,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.permissionPropagationSignalCursor.create({
        data: {
          source: PermissionPropagationSignalSource.USER_GROUP,
          through: now,
          sourceId: 0,
          relationId: 0,
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.permissionPropagationCursor.create({
        data: {
          kind: PermissionPropagationCursorKind.FULL_SWEEP,
          objectType: ObjectType.CATALOG_COLLECTION,
          objectId: '',
        },
      })
    ).rejects.toThrow()
    await expect(
      prisma.permissionPropagationCursor.create({
        data: {
          kind: PermissionPropagationCursorKind.SAMPLE,
          objectType: ObjectType.USER_GROUP,
        },
      })
    ).rejects.toThrow()
  })

  it('coalesces a stale task onto the latest generation and makes duplicate delivery a no-op', async () => {
    const { catalogCollectionId, scope, sharedUserId } =
      await createCatalogPermissionFixture('Permission propagation worker test')

    const first = await prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      await tx.permission.create({
        data: {
          catalogCollectionId,
          userId: sharedUserId,
          permissionLevel: PermissionLevel.READ,
        },
      })
      return upsertPermissionPropagationWork(tx, {
        scope,
        updateAccessRequests: false,
      })
    })
    const latest = await prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      await tx.permission.update({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId,
            userId: sharedUserId,
          },
        },
        data: { permissionLevel: PermissionLevel.WRITE },
      })
      return upsertPermissionPropagationWork(tx, {
        scope,
        updateAccessRequests: false,
      })
    })
    const taskInput: PermissionPropagationTaskInput = {
      workKey: first.key,
      taskGeneration: first.generation.toString(),
    }
    const { globalCtx, executionCtx, loggerError } = workerContexts()

    await expect(
      handlePermissionPropagationWork(taskInput, globalCtx, executionCtx)
    ).resolves.toEqual({
      status: 'processed',
      processedGeneration: latest.generation.toString(),
    })
    await expect(
      prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId,
            userId: sharedUserId,
          },
        },
      })
    ).resolves.toMatchObject({ permissionLevel: PermissionLevel.WRITE })
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: first.key },
      })
    ).resolves.toMatchObject({
      generation: 2n,
      processedGeneration: 2n,
    })

    await expect(
      handlePermissionPropagationWork(taskInput, globalCtx, executionCtx)
    ).resolves.toEqual({
      status: 'already-processed',
      processedGeneration: latest.generation.toString(),
    })
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('persists one failure against the latest generation observed under the fence', async () => {
    const scope = trackScope({
      objectType: ObjectType.ANSWER_COLLECTION,
      objectId: 'not-an-integer',
      mode: PermissionPropagationMode.OBJECT,
    } as const)
    const first = await upsertWorkUnderFence(scope, {
      updateAccessRequests: false,
    })
    const latest = await upsertWorkUnderFence(scope, {
      updateAccessRequests: false,
    })
    const taskInput: PermissionPropagationTaskInput = {
      workKey: first.key,
      taskGeneration: first.generation.toString(),
    }
    const { globalCtx, executionCtx, loggerError } = workerContexts()

    await expect(
      handlePermissionPropagationWork(taskInput, globalCtx, executionCtx)
    ).rejects.toThrow('numeric object ID is invalid')
    await expect(
      handlePermissionPropagationWork(taskInput, globalCtx, executionCtx)
    ).rejects.toThrow('numeric object ID is invalid')

    await expect(
      prisma.permissionPropagationFailure.findMany({
        where: { workKey: first.key },
      })
    ).resolves.toEqual([
      expect.objectContaining({
        workKey: first.key,
        generation: latest.generation,
        code: 'WORKER_EXECUTION_FAILED',
      }),
    ])
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: first.key },
      })
    ).resolves.toMatchObject({
      generation: 2n,
      processedGeneration: 0n,
    })
    expect(loggerError).not.toHaveBeenCalled()
  })

  it('rejects malformed durable counters before acknowledging work', async () => {
    const scope = objectScope()
    const now = new Date()
    const malformedWork: PermissionPropagationWork = {
      key: permissionPropagationKey(scope),
      objectType: scope.objectType,
      objectId: scope.objectId,
      mode: scope.mode,
      userId: null,
      generation: 1n,
      processedGeneration: 2n,
      dispatchedGeneration: 0n,
      updateAccessRequests: false,
      lastDispatchedAt: null,
      dirtyAt: now,
      recoverBy: now,
      createdAt: now,
      updatedAt: now,
    }
    const transactionClient = {
      $executeRaw: vi.fn().mockResolvedValue(undefined),
      permissionPropagationWork: {
        findUnique: vi.fn().mockResolvedValue(malformedWork),
      },
    }
    const client = {
      $transaction: vi.fn(
        async (callback: (tx: typeof transactionClient) => unknown) =>
          callback(transactionClient)
      ),
      permissionPropagationFailure: {
        upsert: vi.fn().mockResolvedValue(undefined),
      },
    } as unknown as PrismaClient
    const { globalCtx, executionCtx } = workerContexts(client)

    await expect(
      handlePermissionPropagationWork(
        { workKey: malformedWork.key, taskGeneration: '1' },
        globalCtx,
        executionCtx
      )
    ).rejects.toThrow('work counters are invalid')
  })

  it('rediscovers committed work after enqueue loss and heals synthetic drift', async () => {
    const { catalogCollectionId, scope, sharedUserId } =
      await createCatalogPermissionFixture(
        'Permission propagation reconciliation test'
      )
    const work = await prisma.$transaction(async (tx) => {
      await acquirePermissionPropagationFence(tx)
      await tx.permission.create({
        data: {
          catalogCollectionId,
          userId: sharedUserId,
          permissionLevel: PermissionLevel.WRITE,
        },
      })
      return upsertPermissionPropagationWork(tx, {
        scope,
        updateAccessRequests: false,
      })
    })
    const executionCtx = {
      logger: { error: vi.fn() },
    } as unknown as Context<unknown>
    const runNoWait = vi.fn(
      async (
        _: string,
        input: PermissionPropagationTaskInput
      ): Promise<unknown> => {
        await handlePermissionPropagationWork(
          input,
          { prisma } as HatchetHandlerGlobalContext,
          executionCtx
        )
        return {}
      }
    )
    const globalCtx = {
      prisma,
      hatchet: { runNoWait },
    } as unknown as HatchetHandlerGlobalContext
    const now = new Date()

    await expect(
      reconcilePendingPermissionPropagationWork(globalCtx, executionCtx, now)
    ).resolves.toEqual({
      dispatchedWorkCount: 1,
      failedDispatchCount: 0,
    })
    expect(runNoWait).toHaveBeenCalledWith(
      'permission-propagation',
      {
        workKey: work.key,
        taskGeneration: work.generation.toString(),
      },
      {}
    )
    await expect(
      prisma.derivedPermission.findUnique({
        where: {
          catalogCollectionId_userId: {
            catalogCollectionId,
            userId: sharedUserId,
          },
        },
      })
    ).resolves.toMatchObject({ permissionLevel: PermissionLevel.WRITE })
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: work.key },
      })
    ).resolves.toMatchObject({
      processedGeneration: work.generation,
      dispatchedGeneration: work.generation,
      lastDispatchedAt: now,
    })
  })

  it('persists dispatch and recovery failures without advancing dispatch state', async () => {
    const scope = objectScope()
    const now = new Date()
    const dirtyAt = new Date(
      now.getTime() - PERMISSION_PROPAGATION_RECOVERY_SLO_MS - 1
    )
    const work = await upsertWorkUnderFence(scope, {
      dirtyAt,
      updateAccessRequests: false,
    })
    const loggerError = vi.fn()
    const globalCtx = {
      prisma,
      hatchet: {
        runNoWait: vi.fn().mockRejectedValue(new Error('synthetic dispatch')),
      },
    } as unknown as HatchetHandlerGlobalContext
    const executionCtx = {
      logger: { error: loggerError },
    } as unknown as Context<unknown>

    await expect(
      reconcilePendingPermissionPropagationWork(globalCtx, executionCtx, now)
    ).resolves.toEqual({
      dispatchedWorkCount: 0,
      failedDispatchCount: 1,
    })
    await expect(
      prisma.permissionPropagationFailure.findMany({
        where: { workKey: work.key },
        orderBy: { code: 'asc' },
      })
    ).resolves.toEqual([
      expect.objectContaining({
        generation: work.generation,
        code: 'DISPATCH_FAILED',
      }),
      expect.objectContaining({
        generation: work.generation,
        code: 'RECOVERY_SLO_BREACHED',
      }),
    ])
    await expect(
      prisma.permissionPropagationWork.findUniqueOrThrow({
        where: { key: work.key },
      })
    ).resolves.toMatchObject({
      dispatchedGeneration: 0n,
      lastDispatchedAt: null,
    })
    expect(loggerError).toHaveBeenCalledWith(
      'Permission propagation dispatch failed; inspect durable failure state.'
    )
  })

  it('records an overdue generation before it becomes redispatchable', async () => {
    const scope = objectScope()
    const now = new Date()
    const work = await upsertWorkUnderFence(scope, {
      dirtyAt: new Date(
        now.getTime() - PERMISSION_PROPAGATION_RECOVERY_SLO_MS - 1
      ),
      updateAccessRequests: false,
    })
    await markPermissionPropagationDispatched(prisma, {
      key: work.key,
      generation: work.generation,
      acceptedAt: new Date(now.getTime() - 30_000),
    })
    const runNoWait = vi.fn().mockResolvedValue({})
    const globalCtx = {
      prisma,
      hatchet: { runNoWait },
    } as unknown as HatchetHandlerGlobalContext
    const executionCtx = {
      logger: { error: vi.fn() },
    } as unknown as Context<unknown>

    await expect(
      reconcilePendingPermissionPropagationWork(globalCtx, executionCtx, now)
    ).resolves.toEqual({
      dispatchedWorkCount: 0,
      failedDispatchCount: 0,
    })
    expect(runNoWait).not.toHaveBeenCalled()
    await expect(
      prisma.permissionPropagationFailure.findUnique({
        where: {
          workKey_generation_code: {
            workKey: work.key,
            generation: work.generation,
            code: 'RECOVERY_SLO_BREACHED',
          },
        },
      })
    ).resolves.not.toBeNull()
  })

  it('discovers recent signals and advances durable reconciliation cursors', async () => {
    const signalStart = new Date(Date.now() - 120_000)
    const signalAt = new Date(Date.now() - 90_000)
    const { catalogCollectionId, ownerId, sharedUserId } =
      await createCatalogPermissionFixture(
        'Permission propagation signal discovery test'
      )
    const signalCollectionIds = Array.from({ length: 105 }, () => randomUUID())
    await prisma.catalogCollection.createMany({
      data: [
        {
          id: randomUUID(),
          name: 'Permission propagation cursor fairness 1',
          ownerId,
        },
        {
          id: randomUUID(),
          name: 'Permission propagation cursor fairness 2',
          ownerId,
        },
        ...signalCollectionIds.map((id, index) => ({
          id,
          name: `Permission propagation equal-timestamp signal ${index}`,
          ownerId,
        })),
      ],
    })
    const signalGroup = await prisma.userGroup.create({
      data: {
        name: 'Permission propagation high-fanout signal group',
        ownerId,
        createdAt: signalAt,
        updatedAt: signalAt,
      },
    })
    await prisma.permission.createMany({
      data: signalCollectionIds.slice(0, 20).map((objectId) => ({
        catalogCollectionId: objectId,
        userGroupId: signalGroup.id,
        permissionLevel: PermissionLevel.READ,
        createdAt: signalAt,
        updatedAt: signalAt,
      })),
    })
    const answerCollection = await prisma.answerCollection.create({
      data: {
        name: 'Permission propagation cursor fairness',
        description: 'Synthetic test fixture',
        ownerId,
      },
    })
    await prisma.permissionPropagationReconciliationState.create({
      data: {
        id: 'permission-propagation',
        sampleObjectType: ObjectType.CATALOG_COLLECTION,
        fullSweepObjectType: ObjectType.CATALOG_COLLECTION,
      },
    })
    await prisma.permissionPropagationSignalCursor.createMany({
      data: Object.values(PermissionPropagationSignalSource).map((source) => ({
        source,
        through: signalStart,
      })),
    })
    const initialFullSweepCursor = 'ffffffff-ffff-ffff-ffff-ffffffffffff'
    await prisma.permissionPropagationCursor.create({
      data: {
        kind: PermissionPropagationCursorKind.FULL_SWEEP,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: initialFullSweepCursor,
      },
    })
    // the sample walks each object type from its lowest unswept id, so seeded
    // answer collections would otherwise be picked ahead of this fixture and the
    // rotation could not be observed against a populated database
    await prisma.permissionPropagationCursor.create({
      data: {
        kind: PermissionPropagationCursorKind.SAMPLE,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId:
          answerCollection.id > 1 ? String(answerCollection.id - 1) : null,
      },
    })
    const appendedPermission = await prisma.permission.create({
      data: {
        catalogCollectionId,
        userId: sharedUserId,
        permissionLevel: PermissionLevel.READ,
        createdAt: signalAt,
        updatedAt: signalAt,
      },
    })
    await prisma.auditLogEntry.createMany({
      data: signalCollectionIds.map((objectId) => ({
        type: AuditLogType.PERMISSION_MODIFIED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId,
        sourceUserId: ownerId,
        message: 'Synthetic permission propagation signal',
        createdAt: signalAt,
      })),
    })
    await prisma.auditLogEntry.create({
      data: {
        type: AuditLogType.USER_GROUP_MODIFIED,
        objectType: ObjectType.USER_GROUP,
        objectId: String(signalGroup.id),
        sourceUserId: ownerId,
        message: 'Synthetic high-fanout user-group signal',
        createdAt: signalAt,
      },
    })
    const runNoWait = vi.fn().mockResolvedValue({})
    const globalCtx = {
      prisma,
      hatchet: { runNoWait },
    } as unknown as HatchetHandlerGlobalContext
    const executionCtx = {
      logger: { error: vi.fn() },
    } as unknown as Context<unknown>

    const result = await handlePermissionPropagationReconciliation(
      { mode: 'regular' },
      globalCtx,
      executionCtx
    )
    const createdWork = await prisma.permissionPropagationWork.findMany()
    createdWork.forEach(({ key }) => workKeys.add(key))

    expect(Number(result.discoveredWorkCount)).toBeGreaterThan(0)
    expect(Number(result.dispatchedWorkCount)).toBeGreaterThan(0)
    await expect(
      prisma.permissionPropagationWork.findUnique({
        where: {
          key: permissionPropagationKey({
            objectType: ObjectType.ANSWER_COLLECTION,
            objectId: String(answerCollection.id),
            mode: PermissionPropagationMode.OBJECT,
          }),
        },
      })
    ).resolves.not.toBeNull()
    const directAuditCursor =
      await prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.DIRECT_AUDIT },
      })
    expect(directAuditCursor.through).toEqual(signalAt)
    expect(directAuditCursor.sourceId).not.toBeNull()
    expect(directAuditCursor.relationId).toBe(0)
    const userGroupCursor =
      await prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP },
      })
    expect(userGroupCursor).toMatchObject({
      through: signalAt,
      sourceId: signalGroup.id,
    })
    const userGroupAuditCursor =
      await prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP_AUDIT },
      })
    expect(userGroupCursor.relationMaxId).not.toBeNull()
    expect(userGroupCursor.relationId).toBeLessThan(
      userGroupCursor.relationMaxId!
    )
    expect(userGroupAuditCursor.relationMaxId).toBe(
      userGroupCursor.relationMaxId
    )
    await prisma.userGroup.update({
      where: { id: signalGroup.id },
      data: { updatedAt: new Date(signalAt.getTime() + 1_000) },
    })
    await prisma.permission.create({
      data: {
        catalogCollectionId: signalCollectionIds[20]!,
        userGroupId: signalGroup.id,
        permissionLevel: PermissionLevel.READ,
        createdAt: new Date(signalAt.getTime() + 1_000),
        updatedAt: new Date(signalAt.getTime() + 1_000),
      },
    })
    expect(appendedPermission.id).toBeGreaterThan(
      userGroupCursor.relationMaxId!
    )
    await expect(
      prisma.permissionPropagationCursor.findUniqueOrThrow({
        where: {
          kind_objectType: {
            kind: PermissionPropagationCursorKind.FULL_SWEEP,
            objectType: ObjectType.CATALOG_COLLECTION,
          },
        },
      })
    ).resolves.toMatchObject({ objectId: initialFullSweepCursor })

    let fullSweepResult = await handlePermissionPropagationReconciliation(
      { mode: 'full-sweep' },
      globalCtx,
      executionCtx
    )
    await expect(
      prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP },
      })
    ).resolves.toMatchObject({
      through: signalAt,
      sourceId: signalGroup.id,
      relationId: 0,
      relationMaxId: null,
    })
    await expect(
      prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: {
          source: PermissionPropagationSignalSource.USER_GROUP_AUDIT,
        },
      })
    ).resolves.toMatchObject({
      through: signalAt,
      relationId: 0,
      relationMaxId: null,
    })
    for (let page = 0; page < 6; page += 1) {
      fullSweepResult = await handlePermissionPropagationReconciliation(
        { mode: 'regular' },
        globalCtx,
        executionCtx
      )
    }
    const stateAfterFullSweep =
      await prisma.permissionPropagationReconciliationState.findUniqueOrThrow({
        where: { id: 'permission-propagation' },
      })
    const fullSweepCursorAfter =
      await prisma.permissionPropagationCursor.findUniqueOrThrow({
        where: {
          kind_objectType: {
            kind: PermissionPropagationCursorKind.FULL_SWEEP,
            objectType: ObjectType.CATALOG_COLLECTION,
          },
        },
      })
    const allCreatedWork = await prisma.permissionPropagationWork.findMany()
    allCreatedWork.forEach(({ key }) => workKeys.add(key))

    expect(Number(fullSweepResult.discoveredWorkCount)).toBeGreaterThan(0)
    expect(fullSweepCursorAfter.objectId).not.toBe(initialFullSweepCursor)
    await expect(
      prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.DIRECT_AUDIT },
      })
    ).resolves.toMatchObject({
      sourceId: null,
      relationId: null,
    })
    await expect(
      prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP },
      })
    ).resolves.toMatchObject({
      sourceId: null,
      relationId: null,
    })
    await expect(
      prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: {
          source: PermissionPropagationSignalSource.USER_GROUP_AUDIT,
        },
      })
    ).resolves.toMatchObject({
      sourceId: null,
      relationId: null,
      relationMaxId: null,
    })
    await expect(
      prisma.permissionPropagationWork.findUnique({
        where: {
          key: permissionPropagationKey({
            objectType: ObjectType.CATALOG_COLLECTION,
            objectId: signalCollectionIds.at(-1)!,
            mode: PermissionPropagationMode.OBJECT,
          }),
        },
      })
    ).resolves.not.toBeNull()
    await expect(
      prisma.permissionPropagationWork.findUnique({
        where: {
          key: permissionPropagationKey({
            objectType: ObjectType.CATALOG_COLLECTION,
            objectId: catalogCollectionId,
            mode: PermissionPropagationMode.OBJECT,
          }),
        },
      })
    ).resolves.not.toBeNull()
    expect(stateAfterFullSweep.updatedAt.getTime()).toBeGreaterThanOrEqual(
      stateAfterFullSweep.createdAt.getTime()
    )
  })

  it('releases a group fanout whose frozen ceiling permission is revoked mid-drain', async () => {
    const signalStart = new Date(Date.now() - 120_000)
    const signalAt = new Date(Date.now() - 90_000)
    const { ownerId } = await createCatalogPermissionFixture(
      'Permission propagation revoked ceiling test'
    )
    // more than one signal page, so the fanout spans several reconciliation ticks
    const fanoutCollectionIds = Array.from({ length: 20 }, () => randomUUID())
    await prisma.catalogCollection.createMany({
      data: fanoutCollectionIds.map((id, index) => ({
        id,
        name: `Permission propagation revoked ceiling signal ${index}`,
        ownerId,
      })),
    })
    const signalGroup = await prisma.userGroup.create({
      data: {
        name: 'Permission propagation revoked ceiling group',
        ownerId,
        createdAt: signalAt,
        updatedAt: signalAt,
      },
    })
    await prisma.permission.createMany({
      data: fanoutCollectionIds.map((objectId) => ({
        catalogCollectionId: objectId,
        userGroupId: signalGroup.id,
        permissionLevel: PermissionLevel.READ,
        createdAt: signalAt,
        updatedAt: signalAt,
      })),
    })
    await prisma.permissionPropagationReconciliationState.create({
      data: {
        id: 'permission-propagation',
        sampleObjectType: ObjectType.CATALOG_COLLECTION,
        fullSweepObjectType: ObjectType.CATALOG_COLLECTION,
      },
    })
    await prisma.permissionPropagationSignalCursor.createMany({
      data: Object.values(PermissionPropagationSignalSource).map((source) => ({
        source,
        through: signalStart,
      })),
    })
    const runNoWait = vi.fn().mockResolvedValue({})
    const globalCtx = {
      prisma,
      hatchet: { runNoWait },
    } as unknown as HatchetHandlerGlobalContext
    const executionCtx = {
      logger: { error: vi.fn() },
    } as unknown as Context<unknown>
    const tick = () =>
      handlePermissionPropagationReconciliation(
        { mode: 'regular' },
        globalCtx,
        executionCtx
      )

    // first page freezes relationMaxId at the group's highest permission id
    await tick()
    const frozenCursor =
      await prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP },
      })
    expect(frozenCursor.relationMaxId).not.toBeNull()
    expect(frozenCursor.relationId).toBeGreaterThan(0)
    expect(frozenCursor.relationId).toBeLessThan(frozenCursor.relationMaxId!)

    // revoke exactly the frozen ceiling row before the fanout reaches it
    await prisma.permission.delete({
      where: { id: frozenCursor.relationMaxId! },
    })

    // draining the rest must release the fanout instead of resetting it to zero
    for (let page = 0; page < 4; page += 1) {
      await tick()
    }
    const releasedCursor =
      await prisma.permissionPropagationSignalCursor.findUniqueOrThrow({
        where: { source: PermissionPropagationSignalSource.USER_GROUP },
      })
    const createdWork = await prisma.permissionPropagationWork.findMany()
    createdWork.forEach(({ key }) => workKeys.add(key))

    expect(releasedCursor.relationMaxId).toBeNull()
    await prisma.permission.deleteMany({
      where: { userGroupId: signalGroup.id },
    })
    await prisma.userGroup.delete({ where: { id: signalGroup.id } })
  })
})

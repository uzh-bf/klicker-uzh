import { prisma as sharedPrisma } from '@klicker-uzh/prisma'
import {
  ObjectType,
  PermissionLevel,
  PermissionPropagationMode,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { randomUUID } from 'node:crypto'
import {
  PERMISSION_PROPAGATION_RECOVERY_SLO_MS,
  acquirePermissionPropagationFence,
  markPermissionPropagationDispatched,
  permissionPropagationKey,
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
  })
})

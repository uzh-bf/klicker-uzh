import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { recomputeDerivedPermissions } from '@klicker-uzh/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...actual,
    recomputeDerivedPermissions: vi.fn(),
  }
})

const user = {
  id: 'user-1',
}

function createContext(
  prisma: TRPCContext['prisma'],
  emitter?: TRPCContext['emitter']
): TRPCContext {
  return {
    prisma,
    emitter,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('manage element router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('returns null summary when admin permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const elementFindUnique = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.summary({ id: 17 })).resolves.toEqual({
      elementSummary: null,
    })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        elementId: 17,
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(elementFindUnique).not.toHaveBeenCalled()
  })

  test('returns element summary flags for admin users', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      answerCollection: {
        permissions: [{ id: 41 }],
      },
      elementInstances: [
        {
          ownerId: 'other-user',
          elementStack: {
            microLearning: { permissions: [] },
            practiceQuiz: { permissions: [] },
            groupActivity: { permissions: [] },
          },
          elementBlock: {
            liveQuiz: { permissions: [] },
          },
        },
        {
          ownerId: user.id,
          elementStack: {
            microLearning: { permissions: [{ id: 42 }] },
            practiceQuiz: { permissions: [] },
            groupActivity: { permissions: [] },
          },
          elementBlock: null,
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.summary({ id: 17 })).resolves.toEqual({
      elementSummary: {
        sharedElementActivityUse: true,
        retainsDerivedAccess: true,
        derivedAccessToResources: true,
      },
    })
    expect(elementFindUnique).toHaveBeenCalledWith({
      where: { id: 17 },
      include: expect.objectContaining({
        answerCollection: expect.any(Object),
        elementInstances: expect.any(Object),
      }),
    })
  })

  test('returns user tags ordered by tag order', async () => {
    const userFindUnique = vi.fn().mockResolvedValue({
      tags: [
        { id: 1, name: 'Alpha', order: 0, createdAt: new Date() },
        { id: 2, name: 'Beta', order: 1, createdAt: new Date() },
      ],
    })
    const prisma = {
      user: { findUnique: userFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.tags()).resolves.toEqual({
      tags: [
        { id: 1, name: 'Alpha', order: 0 },
        { id: 2, name: 'Beta', order: 1 },
      ],
    })
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      include: { tags: { orderBy: { order: 'asc' } } },
    })
  })

  test('returns null when editing a tag to an existing name', async () => {
    const tagFindUnique = vi.fn().mockResolvedValue({ id: 5 })
    const tagUpdate = vi.fn()
    const prisma = {
      tag: { findUnique: tagFindUnique, update: tagUpdate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.editTag({ id: 17, name: 'Existing' })
    ).resolves.toEqual({ tag: null })
    expect(tagFindUnique).toHaveBeenCalledWith({
      where: { ownerId_name: { ownerId: user.id, name: 'Existing' } },
    })
    expect(tagUpdate).not.toHaveBeenCalled()
  })

  test('updates a user-owned tag', async () => {
    const tagFindUnique = vi.fn().mockResolvedValue(null)
    const tagUpdate = vi.fn().mockResolvedValue({
      id: 17,
      name: 'Updated',
      order: 2,
    })
    const prisma = {
      tag: { findUnique: tagFindUnique, update: tagUpdate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.editTag({ id: 17, name: 'Updated' })
    ).resolves.toEqual({
      tag: { id: 17, name: 'Updated', order: 2 },
    })
    expect(tagUpdate).toHaveBeenCalledWith({
      where: { id: 17, ownerId: user.id },
      data: { name: 'Updated' },
    })
  })

  test('deletes a user-owned tag and emits invalidation', async () => {
    const emit = vi.fn()
    const tagDelete = vi.fn().mockResolvedValue({
      id: 17,
      name: 'Deleted',
      order: 2,
    })
    const prisma = {
      tag: { delete: tagDelete },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(caller.element.deleteTag({ id: 17 })).resolves.toEqual({
      tag: { id: 17, name: 'Deleted', order: 2 },
    })
    expect(tagDelete).toHaveBeenCalledWith({
      where: { id: 17, ownerId: user.id },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Tag',
      id: 17,
    })
  })

  test('updates tag ordering for the current user', async () => {
    const tagFindMany = vi.fn().mockResolvedValue([
      { id: 1, name: 'Beta', order: 1 },
      { id: 2, name: 'Alpha', order: 1 },
      { id: 3, name: 'Gamma', order: 2 },
    ])
    const tagUpdate = vi
      .fn()
      .mockResolvedValueOnce({ id: 2, name: 'Alpha', order: 0 })
      .mockResolvedValueOnce({ id: 3, name: 'Gamma', order: 1 })
      .mockResolvedValueOnce({ id: 1, name: 'Beta', order: 2 })
    const transaction = vi.fn().mockResolvedValue([])
    const prisma = {
      tag: { findMany: tagFindMany, update: tagUpdate },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.updateTagOrdering({ originIx: 1, targetIx: 2 })
    ).resolves.toEqual({
      tags: [
        { id: 2, name: 'Alpha', order: 1 },
        { id: 3, name: 'Gamma', order: 2 },
        { id: 1, name: 'Beta', order: 1 },
      ],
    })
    expect(tagFindMany).toHaveBeenCalledWith({
      where: { ownerId: user.id },
      orderBy: { order: 'asc' },
    })
    expect(tagUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 2 },
      data: { order: 0 },
    })
    expect(tagUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 3 },
      data: { order: 1 },
    })
    expect(tagUpdate).toHaveBeenNthCalledWith(3, {
      where: { id: 1 },
      data: { order: 2 },
    })
    expect(transaction).toHaveBeenCalledWith([
      expect.any(Promise),
      expect.any(Promise),
      expect.any(Promise),
    ])
  })

  test('returns null deleted element id when admin permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.delete({ id: 17 })).resolves.toEqual({
      deletedElementId: null,
    })
    expect(transaction).not.toHaveBeenCalled()
  })

  test('soft deletes element, recomputes permissions, and removes orphan tags', async () => {
    const emit = vi.fn()
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      id: 17,
      answerCollectionId: 31,
    })
    const elementUpdate = vi
      .fn()
      .mockResolvedValueOnce({
        id: 17,
        answerCollectionId: null,
        tags: [{ id: 5 }, { id: 6 }],
      })
      .mockResolvedValueOnce({ id: 17 })
    const tagFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ _count: { questions: 0 } })
      .mockResolvedValueOnce({ _count: { questions: 2 } })
    const tagDelete = vi.fn().mockResolvedValue({})
    const transactionClient = {
      element: {
        findUnique: elementFindUnique,
        update: elementUpdate,
      },
      tag: {
        findUnique: tagFindUnique,
        delete: tagDelete,
      },
    }
    const transaction = vi.fn(async (callback) => callback(transactionClient))
    const prisma = {
      derivedPermission: { findFirst },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(caller.element.delete({ id: 17 })).resolves.toEqual({
      deletedElementId: 17,
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
    })
    expect(elementFindUnique).toHaveBeenCalledWith({ where: { id: 17 } })
    expect(elementUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 17 },
      data: {
        isDeleted: true,
        answerCollection: { disconnect: true },
        answerCollectionItems: { set: [] },
        directPermissions: { deleteMany: {} },
      },
      include: { tags: true },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { elementId: 17 },
      transactionClient
    )
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { answerCollectionId: 31 },
      transactionClient
    )
    expect(tagDelete).toHaveBeenCalledWith({ where: { id: 5 } })
    expect(tagDelete).not.toHaveBeenCalledWith({ where: { id: 6 } })
    expect(elementUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 17 },
      data: { tags: { set: [] } },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Element',
      id: 17,
    })
  })
})

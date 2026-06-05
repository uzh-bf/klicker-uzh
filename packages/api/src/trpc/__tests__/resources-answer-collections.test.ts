import {
  AuditLogType,
  ObjectType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { SharingType } from '@klicker-uzh/types'
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
  id: 'owner-1',
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

describe('resources answer collection router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('lists answer collections with resource metadata', async () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const updatedAt = new Date('2026-01-02T10:00:00.000Z')
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          permissionLevel: PermissionLevel.OWNER,
          derived: false,
          directPermission: null,
          answerCollection: {
            id: 21,
            name: 'Owned answers',
            description: 'Owned description',
            originalId: null,
            isDeleted: false,
            createdAt,
            updatedAt,
            owner: { shortname: 'owner' },
            _count: {
              entries: 3,
              permissions: 2,
              linkedElements: 0,
              linkedTemplates: 0,
            },
          },
        },
        {
          permissionLevel: PermissionLevel.READ,
          derived: false,
          directPermission: { userGroupId: null },
          answerCollection: {
            id: 22,
            name: 'Shared answers',
            description: 'Shared description',
            originalId: 11,
            isDeleted: false,
            createdAt,
            updatedAt,
            owner: { shortname: 'other-owner' },
            _count: {
              entries: 5,
              permissions: 4,
              linkedElements: 1,
              linkedTemplates: 0,
            },
          },
        },
        {
          permissionLevel: PermissionLevel.READ,
          derived: true,
          directPermission: null,
          answerCollection: {
            id: 23,
            name: 'Deleted dependency',
            description: 'Deleted dependency description',
            originalId: null,
            isDeleted: true,
            createdAt,
            updatedAt,
            owner: { shortname: 'other-owner' },
            _count: {
              entries: 1,
              permissions: 1,
              linkedElements: 0,
              linkedTemplates: 0,
            },
          },
        },
      ],
    })
    const prisma = {
      user: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.resources.answerCollectionsInfo()).resolves.toEqual({
      answerCollections: [
        {
          id: 21,
          name: 'Owned answers',
          description: 'Owned description',
          ownerShortname: 'owner',
          numSharedUsers: 1,
          numOfEntries: 3,
          permissionLevel: PermissionLevel.OWNER,
          isOwner: true,
          isManager: true,
          isEditor: true,
          isImported: false,
          isShared: false,
          isDeletable: true,
          isRemovable: false,
          sharingType: SharingType.OWNED,
          createdAt,
          updatedAt,
        },
        {
          id: 22,
          name: 'Shared answers',
          description: 'Shared description',
          ownerShortname: 'other-owner',
          numSharedUsers: 3,
          numOfEntries: 5,
          permissionLevel: PermissionLevel.READ,
          isOwner: false,
          isManager: false,
          isEditor: false,
          isImported: false,
          isShared: true,
          isDeletable: false,
          isRemovable: false,
          sharingType: SharingType.SHARED,
          createdAt,
          updatedAt,
        },
      ],
    })
    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        include: expect.objectContaining({
          objects: expect.objectContaining({
            where: { answerCollectionId: { not: null } },
          }),
        }),
      })
    )
  })

  test('returns single answer collection detail for users with access', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      id: 21,
      name: 'Answers',
      description: 'Description',
      owner: { shortname: 'owner' },
      permissions: [{ permissionLevel: PermissionLevel.ADMIN }],
      _count: { permissions: 3 },
      entries: [
        {
          id: 2,
          value: 'B',
          _count: { itemUsages: 2, templateUsages: 1 },
        },
        {
          id: 1,
          value: 'A',
          _count: { itemUsages: 0, templateUsages: 0 },
        },
      ],
    })
    const prisma = {
      answerCollection: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.singleAnswerCollection({ id: 21 })
    ).resolves.toEqual({
      answerCollection: {
        id: 21,
        name: 'Answers',
        description: 'Description',
        ownerShortname: 'owner',
        numSharedUsers: 2,
        permissionLevel: PermissionLevel.ADMIN,
        isOwner: false,
        isManager: true,
        isEditor: true,
        isShared: true,
        entries: [
          { id: 2, value: 'B', numSolutionUsages: 3 },
          { id: 1, value: 'A', numSolutionUsages: 0 },
        ],
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 21 },
      include: {
        entries: {
          include: {
            _count: { select: { itemUsages: true, templateUsages: true } },
          },
          orderBy: { value: 'asc' },
        },
        permissions: { where: { userId: user.id } },
        owner: { select: { shortname: true } },
        _count: { select: { permissions: true } },
      },
    })
  })

  test('returns null for single answer collection without access', async () => {
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          description: 'Description',
          owner: { shortname: 'owner' },
          permissions: [],
          _count: { permissions: 1 },
          entries: [],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.singleAnswerCollection({ id: 21 })
    ).resolves.toEqual({ answerCollection: null })
  })

  test('creates an answer collection and recomputes owner permissions', async () => {
    const createdAt = new Date('2026-01-03T10:00:00.000Z')
    const updatedAt = new Date('2026-01-03T10:00:00.000Z')
    const transactionClient = {
      answerCollection: {
        create: vi.fn().mockResolvedValue({
          id: 31,
          name: 'New answers',
          description: 'New description',
          createdAt,
          updatedAt,
          entries: [
            { id: 1, value: 'A' },
            { id: 2, value: 'B' },
          ],
        }),
      },
    }
    const transaction = vi.fn(async (callback) => callback(transactionClient))
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.createAnswerCollection({
        name: 'New answers',
        description: 'New description',
        answers: ['A', 'B'],
      })
    ).resolves.toEqual({
      answerCollection: {
        id: 31,
        name: 'New answers',
        description: 'New description',
        ownerShortname: undefined,
        numSharedUsers: 0,
        numOfEntries: 2,
        permissionLevel: PermissionLevel.OWNER,
        isOwner: true,
        isManager: true,
        isEditor: true,
        isImported: false,
        isShared: false,
        isDeletable: true,
        isRemovable: false,
        sharingType: SharingType.OWNED,
        createdAt,
        updatedAt,
        entries: [
          { id: 1, value: 'A' },
          { id: 2, value: 'B' },
        ],
      },
    })
    expect(transactionClient.answerCollection.create).toHaveBeenCalledWith({
      data: {
        name: 'New answers',
        description: 'New description',
        entries: { create: [{ value: 'A' }, { value: 'B' }] },
        owner: { connect: { id: user.id } },
      },
      include: { entries: true },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { answerCollectionId: 31, userId: user.id },
      transactionClient
    )
  })

  test('duplicates an accessible answer collection', async () => {
    const createdAt = new Date('2026-01-04T10:00:00.000Z')
    const updatedAt = new Date('2026-01-04T10:00:00.000Z')
    const transactionClient = {
      answerCollection: {
        create: vi.fn().mockResolvedValue({
          id: 32,
          name: 'Original answers (Copy)',
          description: 'Original description',
          createdAt,
          updatedAt,
          entries: [
            { id: 3, value: 'A' },
            { id: 4, value: 'B' },
          ],
        }),
      },
    }
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Original answers',
          description: 'Original description',
          entries: [
            { id: 1, value: 'A' },
            { id: 2, value: 'B' },
          ],
        }),
      },
      $transaction: vi.fn(async (callback) => callback(transactionClient)),
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.duplicateAnswerCollection({ id: 21 })
    ).resolves.toMatchObject({
      answerCollection: {
        id: 32,
        name: 'Original answers (Copy)',
        description: 'Original description',
        entries: [
          { id: 3, value: 'A' },
          { id: 4, value: 'B' },
        ],
      },
    })
    expect(prisma?.derivedPermission.findFirst).toHaveBeenCalledWith({
      where: {
        answerCollectionId: 21,
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.READ,
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(transactionClient.answerCollection.create).toHaveBeenCalledWith({
      data: {
        name: 'Original answers (Copy)',
        description: 'Original description',
        entries: { create: [{ value: 'A' }, { value: 'B' }] },
        owner: { connect: { id: user.id } },
      },
      include: { entries: true },
    })
  })

  test('does not duplicate an answer collection without read permission', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      answerCollection: {
        findUnique: vi.fn(),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.duplicateAnswerCollection({ id: 21 })
    ).resolves.toEqual({ answerCollection: null })
    expect(prisma?.answerCollection.findUnique).not.toHaveBeenCalled()
  })

  test('modifies answer collection metadata and emits invalidation', async () => {
    const transactionClient = {
      answerCollection: {
        update: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Updated',
          description: 'Updated description',
          entries: [{ id: 1, value: 'A' }],
        }),
      },
    }
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          _count: { permissions: 3 },
        }),
      },
      $transaction: vi.fn(async (callback) => callback(transactionClient)),
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.resources.modifyAnswerCollection({
        id: 21,
        name: 'Updated',
        description: 'Updated description',
      })
    ).resolves.toEqual({
      answerCollection: {
        id: 21,
        name: 'Updated',
        description: 'Updated description',
        numSharedUsers: 2,
        entries: [{ id: 1, value: 'A' }],
      },
    })
    expect(transactionClient.answerCollection.update).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        name: 'Updated',
        description: 'Updated description',
        version: { increment: 1 },
      },
      include: { entries: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })

  test('does not delete an answer collection entry that is still used', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({ id: 1 }),
      },
      answerCollectionEntry: {
        findUnique: vi.fn().mockResolvedValue({
          id: 1,
          collectionId: 21,
          _count: { itemUsages: 1, templateUsages: 0 },
        }),
        delete: vi.fn(),
      },
      answerCollection: {
        update: vi.fn(),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.deleteAnswerCollectionEntry({
        id: 1,
        collectionId: 21,
      })
    ).resolves.toEqual({ deletedAnswerCollectionEntryId: null })
    expect(prisma?.answerCollectionEntry.delete).not.toHaveBeenCalled()
    expect(prisma?.answerCollection.update).not.toHaveBeenCalled()
  })

  test('removes a shared answer collection and recomputes permissions', async () => {
    const transactionClient = {
      permission: {
        delete: vi.fn(),
      },
      auditLogEntry: {
        create: vi.fn(),
      },
    }
    const transaction = vi.fn(async (callback) => callback(transactionClient))
    const emit = vi.fn()
    const prisma = {
      permission: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          answerCollection: {
            id: 21,
            ownerId: 'other-user',
            isDeleted: false,
            _count: {
              linkedElements: 0,
              linkedTemplates: 0,
              permissions: 2,
            },
          },
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.resources.removeAnswerCollection({ id: 21 })
    ).resolves.toEqual({ removedAnswerCollectionId: 21 })
    expect(prisma?.permission.findUnique).toHaveBeenCalledWith({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: 21,
          userId: user.id,
        },
      },
      include: {
        answerCollection: {
          include: {
            _count: {
              select: {
                linkedElements: {
                  where: { permissions: { some: { userId: user.id } } },
                },
                linkedTemplates: {
                  where: {
                    OR: [
                      {
                        liveQuiz: {
                          permissions: { some: { userId: user.id } },
                        },
                      },
                      {
                        practiceQuiz: {
                          permissions: { some: { userId: user.id } },
                        },
                      },
                      {
                        microLearning: {
                          permissions: { some: { userId: user.id } },
                        },
                      },
                      {
                        groupActivity: {
                          permissions: { some: { userId: user.id } },
                        },
                      },
                    ],
                  },
                },
                permissions: true,
              },
            },
          },
        },
      },
    })
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 60000,
    })
    expect(transactionClient.permission.delete).toHaveBeenCalledWith({
      where: { id: 5 },
    })
    expect(transactionClient.auditLogEntry.create).toHaveBeenCalledWith({
      data: {
        type: AuditLogType.PERMISSION_REMOVED,
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        sourceUserId: user.id,
        message: `User ${user.id} removed own permission on ${ObjectType.ANSWER_COLLECTION} (ID: 21)`,
      },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { answerCollectionId: 21, userId: user.id },
      transactionClient
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })

  test('does not remove an owned answer collection', async () => {
    const prisma = {
      permission: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          answerCollection: {
            id: 21,
            ownerId: user.id,
            isDeleted: false,
            _count: {
              linkedElements: 0,
              linkedTemplates: 0,
              permissions: 1,
            },
          },
        }),
      },
      answerCollection: {
        delete: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.resources.removeAnswerCollection({ id: 21 })
    ).resolves.toEqual({ removedAnswerCollectionId: null })
    expect(prisma?.answerCollection.delete).not.toHaveBeenCalled()
    expect(prisma?.$transaction).not.toHaveBeenCalled()
  })

  test('fully deletes a removed soft-deleted answer collection when no other permissions remain', async () => {
    const emit = vi.fn()
    const prisma = {
      permission: {
        findUnique: vi.fn().mockResolvedValue({
          id: 5,
          answerCollection: {
            id: 21,
            ownerId: 'other-user',
            isDeleted: true,
            _count: {
              linkedElements: 0,
              linkedTemplates: 0,
              permissions: 1,
            },
          },
        }),
      },
      answerCollection: {
        delete: vi.fn(),
      },
      $transaction: vi.fn(),
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.resources.removeAnswerCollection({ id: 21 })
    ).resolves.toEqual({ removedAnswerCollectionId: 21 })
    expect(prisma?.answerCollection.delete).toHaveBeenCalledWith({
      where: { id: 21 },
    })
    expect(prisma?.$transaction).not.toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })
})

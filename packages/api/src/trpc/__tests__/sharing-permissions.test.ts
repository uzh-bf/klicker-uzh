import {
  AuditLogType,
  ObjectType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  recomputeDerivedPermissions,
  updateAccessRequestInstances,
} from '@klicker-uzh/util'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

vi.mock('@klicker-uzh/util', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@klicker-uzh/util')>()

  return {
    ...actual,
    recomputeDerivedPermissions: vi.fn(),
    updateAccessRequestInstances: vi.fn(),
  }
})

const user = {
  id: 'user-1',
}

function createContext(
  prisma: TRPCContext['prisma'],
  options?: { scope?: UserLoginScope }
): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: options?.scope ?? UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('sharing permission router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
    vi.mocked(updateAccessRequestInstances).mockClear()
  })

  test('returns null object permissions when admin permission is missing', async () => {
    const findUnique = vi.fn().mockResolvedValue(null)
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: { findUnique },
      liveQuiz: { findUnique: liveQuizFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.objectPermissions({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ objectPermissions: null })

    expect(findUnique).toHaveBeenCalledWith({
      where: {
        liveQuizId_userId: {
          liveQuizId: 'live-quiz-1',
          userId: user.id,
        },
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('maps owner and direct permissions for a manageable object', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 1 })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      ownerId: user.id,
      owner: {
        id: user.id,
        shortname: 'lecturer',
        email: 'lecturer@example.com',
      },
      directPermissions: [
        {
          id: 5,
          user: {
            id: 'user-2',
            shortname: 'assistant',
            email: 'assistant@example.com',
          },
          userGroup: null,
          permissionLevel: PermissionLevel.READ,
          propagation: false,
        },
      ],
    })
    const prisma = {
      derivedPermission: { findUnique },
      liveQuiz: { findUnique: liveQuizFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.objectPermissions({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      objectPermissions: {
        isOwner: true,
        ownerPermission: {
          permissionId: -1,
          userId: user.id,
          username: 'lecturer',
          userEmail: 'lecturer@example.com',
          userGroupId: undefined,
          userGroupName: undefined,
          permissionLevel: PermissionLevel.OWNER,
          propagation: false,
          isOwn: true,
        },
        permissions: [
          {
            permissionId: 5,
            userId: 'user-2',
            username: 'assistant',
            userEmail: 'assistant@example.com',
            userGroupId: undefined,
            userGroupName: undefined,
            permissionLevel: PermissionLevel.READ,
            propagation: false,
            isOwn: false,
          },
        ],
      },
    })
  })

  test('shares an object with a user and recomputes derived permissions', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 1 })
    const upsert = vi.fn().mockResolvedValue({
      id: 7,
      permissionLevel: PermissionLevel.WRITE,
      propagation: true,
    })
    const deleteMany = vi.fn().mockResolvedValue({ count: 0 })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { upsert },
        accessRequest: { deleteMany },
        auditLogEntry: { create: auditCreate },
      })
    )
    const prisma = {
      derivedPermission: { findUnique },
      user: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'user-2',
          shortname: 'assistant',
          email: 'assistant@example.com',
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.shareObject({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
        shortnameOrEmail: 'assistant',
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      })
    ).resolves.toEqual({
      permission: {
        permissionId: 7,
        userId: 'user-2',
        username: 'assistant',
        userEmail: 'assistant@example.com',
        userGroupId: undefined,
        userGroupName: undefined,
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
        isOwn: false,
      },
    })

    expect(upsert).toHaveBeenCalledWith({
      where: {
        catalogCollectionId_userId: undefined,
        answerCollectionId_userId: undefined,
        elementId_userId: undefined,
        courseId_userId: undefined,
        liveQuizId_userId: {
          liveQuizId: 'live-quiz-1',
          userId: 'user-2',
        },
        practiceQuizId_userId: undefined,
        microLearningId_userId: undefined,
        groupActivityId_userId: undefined,
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
        userId: 'user-2',
        liveQuizId: 'live-quiz-1',
      },
      update: {
        permissionLevel: PermissionLevel.WRITE,
        propagation: true,
      },
    })
    expect(deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-2', liveQuizId: 'live-quiz-1' },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        liveQuizId: 'live-quiz-1',
        userId: 'user-2',
        updateAccessRequests: false,
      },
      expect.anything()
    )
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: 'live-quiz-1',
        sourceUserId: user.id,
        targetUserId: 'user-2',
      }),
    })
  })

  test('changes permission level for an existing direct permission', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 1 })
    const findFirst = vi.fn().mockResolvedValue({
      id: 7,
      userId: 'user-2',
      userGroupId: null,
      permissionLevel: PermissionLevel.READ,
    })
    const update = vi.fn().mockResolvedValue({
      id: 7,
      userId: 'user-2',
      userGroupId: null,
      permissionLevel: PermissionLevel.ADMIN,
    })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { update },
        auditLogEntry: { create: auditCreate },
      })
    )
    const prisma = {
      derivedPermission: { findUnique },
      permission: { findFirst },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.changePermissionLevel({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
        permissionId: 7,
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      })
    ).resolves.toEqual({ changed: true })

    expect(update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: {
        permissionLevel: PermissionLevel.ADMIN,
        propagation: false,
      },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        liveQuizId: 'live-quiz-1',
        userId: 'user-2',
        updateAccessRequests: true,
      },
      expect.anything()
    )
  })

  test('revokes a permission and updates access requests when admin access is removed', async () => {
    const findUnique = vi.fn().mockResolvedValue({ id: 1 })
    const findFirst = vi.fn().mockResolvedValue({
      id: 7,
      userId: 'user-2',
      userGroupId: null,
      user: { id: 'user-2' },
      permissionLevel: PermissionLevel.ADMIN,
    })
    const deletePermission = vi.fn().mockResolvedValue({ id: 7 })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { delete: deletePermission },
        auditLogEntry: { create: auditCreate },
      })
    )
    const prisma = {
      derivedPermission: { findUnique },
      permission: { findFirst },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.revokeObjectAccess({
        objectId: 'live-quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
        permissionId: 7,
      })
    ).resolves.toEqual({ revokedPermissionId: 7 })

    expect(deletePermission).toHaveBeenCalledWith({ where: { id: 7 } })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        liveQuizId: 'live-quiz-1',
        userId: 'user-2',
        updateAccessRequests: false,
      },
      expect.anything()
    )
    expect(updateAccessRequestInstances).toHaveBeenCalledWith(
      { liveQuizId: 'live-quiz-1', userId: 'user-2' },
      expect.anything()
    )
  })

  test('returns user groups for the direct sharing selector', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          managedUserGroups: [
            {
              id: 1,
              name: 'Managed',
              members: [],
              admins: [],
              owner: {
                id: user.id,
                shortname: 'lecturer',
                email: 'lecturer@example.com',
              },
            },
          ],
          adminUserGroups: [],
          userGroups: [],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.userGroups()).resolves.toEqual({
      userGroups: [
        {
          id: 1,
          name: 'Managed',
          members: [],
          admins: [],
          owner: {
            id: user.id,
            shortname: 'lecturer',
            email: 'lecturer@example.com',
            isSelf: true,
          },
          numOfMembers: 1,
          isMember: false,
          isAdmin: false,
          isOwner: true,
        },
      ],
    })
  })
})

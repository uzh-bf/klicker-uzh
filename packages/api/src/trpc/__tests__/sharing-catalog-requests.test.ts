import {
  AuditLogType,
  ObjectType,
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
  id: 'owner-1',
}

function createContext(prisma: TRPCContext['prisma']): TRPCContext {
  return {
    prisma,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

function createPendingRequest() {
  return {
    id: 11,
    userId: 'requester-1',
    objectAdminOrOwnerId: user.id,
    catalogCollectionId: 'catalog-1',
    answerCollectionId: null,
    elementId: null,
    courseId: null,
    liveQuizId: null,
    practiceQuizId: null,
    microLearningId: null,
    groupActivityId: null,
  }
}

describe('sharing catalog request router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('counts pending catalog sharing requests for the current user', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          pendingRequests: [{ id: 1 }, { id: 2 }],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogSharingRequestCount()).resolves.toEqual({
      count: 2,
    })
  })

  test('maps pending catalog sharing requests to narrow DTOs', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          pendingRequests: [
            {
              id: 11,
              userId: 'requester-1',
              user: {
                shortname: 'student',
                email: 'student@example.com',
              },
              catalogCollection: { name: 'Catalog A' },
              answerCollection: null,
              element: null,
            },
            {
              id: 12,
              userId: 'requester-2',
              user: {
                shortname: 'assistant',
                email: 'assistant@example.com',
              },
              catalogCollection: null,
              answerCollection: { name: 'Answers' },
              element: null,
            },
          ],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogSharingRequests()).resolves.toEqual({
      catalogSharingRequests: [
        {
          requestId: 11,
          objectName: 'Catalog A',
          objectType: ObjectType.CATALOG_COLLECTION,
          userId: 'requester-1',
          userShortname: 'student',
          userEmail: 'student@example.com',
        },
        {
          requestId: 12,
          objectName: 'Answers',
          objectType: ObjectType.ANSWER_COLLECTION,
          userId: 'requester-2',
          userShortname: 'assistant',
          userEmail: 'assistant@example.com',
        },
      ],
    })
  })

  test('approves a sharing request and recomputes requester permissions', async () => {
    const pendingRequest = createPendingRequest()
    const upsert = vi.fn().mockResolvedValue({})
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { upsert },
        accessRequest: { deleteMany },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      accessRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.approveObjectSharingRequest({
        requestId: 11,
        userId: 'requester-1',
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
      })
    ).resolves.toEqual({ resolved: true })

    expect(upsert).toHaveBeenCalledWith({
      where: {
        catalogCollectionId_userId: {
          catalogCollectionId: 'catalog-1',
          userId: 'requester-1',
        },
        answerCollectionId_userId: undefined,
        elementId_userId: undefined,
        courseId_userId: undefined,
        liveQuizId_userId: undefined,
        practiceQuizId_userId: undefined,
        microLearningId_userId: undefined,
        groupActivityId_userId: undefined,
      },
      create: {
        permissionLevel: PermissionLevel.WRITE,
        propagation: false,
        userId: 'requester-1',
        catalogCollectionId: 'catalog-1',
      },
      update: {},
    })
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'requester-1',
        catalogCollectionId: 'catalog-1',
      },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.REQUEST_RESOLVED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: 'catalog-1',
        sourceUserId: user.id,
        targetUserId: 'requester-1',
      }),
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        catalogCollectionId: 'catalog-1',
        userId: 'requester-1',
        updateAccessRequests: false,
      },
      expect.anything()
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollection',
      id: 'catalog-1',
    })
  })

  test('declines a sharing request without creating a permission', async () => {
    const pendingRequest = createPendingRequest()
    const upsert = vi.fn()
    const deleteMany = vi.fn().mockResolvedValue({ count: 1 })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { upsert },
        accessRequest: { deleteMany },
        auditLogEntry: { create: auditCreate },
      })
    )
    const prisma = {
      accessRequest: {
        findUnique: vi.fn().mockResolvedValue(pendingRequest),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.declineObjectSharingRequest({
        requestId: 11,
        userId: 'requester-1',
      })
    ).resolves.toEqual({ resolved: true })

    expect(upsert).not.toHaveBeenCalled()
    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'requester-1',
        catalogCollectionId: 'catalog-1',
      },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.REQUEST_RESOLVED,
        sourceUserId: user.id,
        targetUserId: 'requester-1',
      }),
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      {
        catalogCollectionId: 'catalog-1',
        userId: 'requester-1',
        updateAccessRequests: false,
      },
      expect.anything()
    )
  })
})

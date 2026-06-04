import {
  AuditLogType,
  ObjectAccess,
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
  id: 'requester-1',
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

describe('sharing catalog action router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('does not copy unsupported catalog object types', async () => {
    const caller = appRouter.createCaller(
      createContext({} as TRPCContext['prisma'])
    )

    await expect(
      caller.sharing.copyCatalogObjectToAccount({
        objectId: 'quiz-1',
        objectType: ObjectType.LIVE_QUIZ,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({ copied: false })
  })

  test('does not import non-answer-collection catalog objects', async () => {
    const caller = appRouter.createCaller(
      createContext({} as TRPCContext['prisma'])
    )

    await expect(
      caller.sharing.importCatalogObject({
        objectId: '21',
        objectType: ObjectType.ELEMENT,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({ imported: false })
  })

  test('blocks object requests when a restricted catalog collection is not browsable', async () => {
    const prisma = {
      catalogCollection: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ access: ObjectAccess.RESTRICTED }),
      },
      derivedPermission: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.requestCatalogObject({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({ requested: false })
  })

  test('imports a public answer collection through a read permission grant', async () => {
    const permissionUpsert = vi.fn().mockResolvedValue({})
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        permission: { upsert: permissionUpsert },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          access: ObjectAccess.PUBLIC,
          answerCollection: {
            id: 21,
            ownerId: 'owner-1',
            entries: [],
          },
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.importCatalogObject({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({ imported: true })

    expect(permissionUpsert).toHaveBeenCalledWith({
      where: {
        answerCollectionId_userId: {
          answerCollectionId: 21,
          userId: user.id,
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        propagation: false,
        user: { connect: { id: user.id } },
        answerCollection: { connect: { id: 21 } },
      },
      update: {},
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { answerCollectionId: 21, userId: user.id },
      expect.anything()
    )
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.PERMISSION_GRANTED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: '21',
        sourceUserId: user.id,
        targetUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })

  test('copies a public answer collection to the current user account', async () => {
    const answerCollectionCreate = vi.fn().mockResolvedValue({
      id: 22,
      entries: [{ id: 101, value: 'A' }],
    })
    const transaction = vi.fn(async (callback) =>
      callback({
        answerCollection: { create: answerCollectionCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          access: ObjectAccess.PUBLIC,
          answerCollection: {
            id: 21,
            name: 'Answers',
            description: 'Shared answers',
            ownerId: 'owner-1',
            entries: [{ id: 1, value: 'A' }],
          },
        }),
      },
      answerCollection: {
        count: vi.fn().mockResolvedValue(0),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.copyCatalogObjectToAccount({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({ copied: true })

    expect(answerCollectionCreate).toHaveBeenCalledWith({
      data: {
        originalId: 21,
        name: 'Answers',
        description: 'Shared answers',
        owner: { connect: { id: user.id } },
        entries: { create: [{ value: 'A' }] },
      },
      include: { entries: true },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { answerCollectionId: 22, userId: user.id },
      expect.anything()
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })

  test('requests restricted catalog collection access from admins and owners', async () => {
    const accessRequestUpsert = vi.fn().mockResolvedValue({})
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        accessRequest: { upsert: accessRequestUpsert },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'catalog-1',
          name: 'Restricted Catalog',
          access: ObjectAccess.RESTRICTED,
          ownerId: 'owner-1',
          owner: { shortname: 'owner' },
          permissions: [],
          accessRequests: [],
        }),
      },
      derivedPermission: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ userId: 'owner-1' }, { userId: 'admin-1' }]),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.requestCatalogCollection({
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({
      catalogCollection: {
        id: 'catalog-1',
        name: 'Restricted Catalog',
        access: ObjectAccess.RESTRICTED,
        ownerShortname: 'owner',
        isOwner: false,
        isManager: false,
        isEditor: false,
        isRequested: true,
        isShared: false,
      },
    })

    expect(accessRequestUpsert).toHaveBeenCalledTimes(2)
    expect(accessRequestUpsert).toHaveBeenCalledWith({
      where: {
        catalogCollectionId_userId_objectAdminOrOwnerId: {
          catalogCollectionId: 'catalog-1',
          userId: user.id,
          objectAdminOrOwnerId: 'owner-1',
        },
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        catalogCollectionId: 'catalog-1',
        userId: user.id,
        objectAdminOrOwnerId: 'owner-1',
      },
      update: {
        permissionLevel: PermissionLevel.READ,
      },
    })
    expect(auditCreate).toHaveBeenCalledTimes(2)
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollection',
      id: 'catalog-1',
    })
  })

  test('requests restricted answer collection access from admins and owners', async () => {
    const accessRequestUpsert = vi.fn().mockResolvedValue({})
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        accessRequest: { upsert: accessRequestUpsert },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          permissions: [],
          accessRequests: [],
        }),
      },
      derivedPermission: {
        findMany: vi.fn().mockResolvedValue([{ userId: 'owner-1' }]),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.requestCatalogObject({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({ requested: true })

    expect(accessRequestUpsert).toHaveBeenCalledWith({
      where: {
        answerCollectionId_userId_objectAdminOrOwnerId: {
          answerCollectionId: 21,
          userId: user.id,
          objectAdminOrOwnerId: 'owner-1',
        },
        elementId_userId_objectAdminOrOwnerId: undefined,
      },
      create: {
        permissionLevel: PermissionLevel.READ,
        userId: user.id,
        objectAdminOrOwnerId: 'owner-1',
        answerCollectionId: 21,
      },
      update: {
        permissionLevel: PermissionLevel.READ,
      },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.REQUEST_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: '21',
        sourceUserId: user.id,
        targetUserId: 'owner-1',
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })

  test('cancels pending catalog object requests and invalidates request state', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 2 })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        accessRequest: { deleteMany },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      accessRequest: {
        findMany: vi.fn().mockResolvedValue([{ id: 31 }, { id: 32 }]),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.cancelObjectSharingRequest({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
      })
    ).resolves.toEqual({ cancelled: true })

    expect(deleteMany).toHaveBeenCalledWith({
      where: {
        userId: user.id,
        answerCollectionId: 21,
      },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.REQUEST_CANCELLED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: '21',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AccessRequest',
      id: 31,
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AccessRequest',
      id: 32,
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'AnswerCollection',
      id: 21,
    })
  })
})

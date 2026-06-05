import {
  AuditLogType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { MISSING_CATALOG_COLLECTION_ID } from '@klicker-uzh/util'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

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

describe('sharing catalog add/remove router', () => {
  test('lists owned/admin answer collections for catalog addition', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 21, name: 'Answers' },
      { id: 22, name: 'More answers' },
    ])
    const prisma = {
      answerCollection: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogAnswerCollections()).resolves.toEqual({
      catalogAnswerCollections: [
        { id: '21', name: 'Answers' },
        { id: '22', name: 'More answers' },
      ],
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

  test('lists live quiz templates for catalog addition', async () => {
    const findMany = vi
      .fn()
      .mockResolvedValue([{ id: 'live-1', name: 'Template live quiz' }])
    const prisma = {
      liveQuiz: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogLiveQuizTemplates()).resolves.toEqual({
      catalogLiveQuizTemplates: [{ id: 'live-1', name: 'Template live quiz' }],
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: PublicationStatus.TEMPLATE,
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

  test('lists elements for catalog addition', async () => {
    const findMany = vi.fn().mockResolvedValue([
      { id: 33, name: 'Element' },
      { id: 34, name: 'More element' },
    ])
    const prisma = {
      element: { findMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogElements()).resolves.toEqual({
      catalogElements: [
        { id: '33', name: 'Element' },
        { id: '34', name: 'More element' },
      ],
    })
    expect(findMany).toHaveBeenCalledWith({
      where: {
        isDeleted: false,
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
  })

  test('adds an answer collection to the top-level catalog', async () => {
    const assignmentUpsert = vi.fn().mockResolvedValue({
      id: 41,
      access: ObjectAccess.RESTRICTED,
    })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { upsert: assignmentUpsert },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          ownerId: user.id,
          owner: { shortname: 'owner' },
          permissions: [{ permissionLevel: PermissionLevel.OWNER }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.addObjectToCatalog({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        access: ObjectAccess.RESTRICTED,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({
      catalogObject: {
        id: 41,
        objectId: 21,
        objectUuid: null,
        name: 'Answers',
        objectType: ObjectType.ANSWER_COLLECTION,
        templateId: null,
        access: ObjectAccess.RESTRICTED,
        ownerShortname: 'owner',
        isOwner: true,
        isManager: true,
        isRequested: false,
        isShared: false,
      },
    })
    expect(assignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          answerCollectionId_catalogCollectionId: {
            answerCollectionId: 21,
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        }),
        create: expect.objectContaining({
          access: ObjectAccess.RESTRICTED,
          catalogCollection: {
            connect: { id: MISSING_CATALOG_COLLECTION_ID },
          },
          answerCollection: { connect: { id: 21 } },
        }),
        update: { access: ObjectAccess.RESTRICTED },
      })
    )
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: '21',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollectionAssignment',
      id: 41,
    })
  })

  test('adds a live quiz template to the top-level catalog', async () => {
    const assignmentUpsert = vi.fn().mockResolvedValue({
      id: 42,
      access: ObjectAccess.PUBLIC,
    })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { upsert: assignmentUpsert },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'live-1',
          name: 'Template live quiz',
          ownerId: 'other-owner',
          owner: { shortname: 'owner' },
          templateInfo: { id: 'template-1' },
          permissions: [{ permissionLevel: PermissionLevel.ADMIN }],
        }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.addObjectToCatalog({
        objectId: 'live-1',
        objectType: ObjectType.LIVE_QUIZ,
        access: ObjectAccess.PUBLIC,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({
      catalogObject: {
        id: 42,
        objectId: null,
        objectUuid: 'live-1',
        name: 'Template live quiz',
        objectType: ObjectType.LIVE_QUIZ,
        templateId: 'template-1',
        access: ObjectAccess.PUBLIC,
        ownerShortname: 'owner',
        isOwner: false,
        isManager: true,
        isRequested: false,
        isShared: true,
      },
    })
    expect(assignmentUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          liveQuizId_catalogCollectionId: {
            liveQuizId: 'live-1',
            catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          },
        }),
        create: expect.objectContaining({
          access: ObjectAccess.PUBLIC,
          catalogCollection: {
            connect: { id: MISSING_CATALOG_COLLECTION_ID },
          },
          liveQuiz: { connect: { id: 'live-1' } },
        }),
        update: { access: ObjectAccess.PUBLIC },
      })
    )
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_CREATED,
        objectType: ObjectType.LIVE_QUIZ,
        objectId: 'live-1',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollectionAssignment',
      id: 42,
    })
  })

  test('does not add objects to collections without write permission', async () => {
    const answerCollectionFindUnique = vi.fn()
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
      answerCollection: { findUnique: answerCollectionFindUnique },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.addObjectToCatalog({
        objectId: '21',
        objectType: ObjectType.ANSWER_COLLECTION,
        access: ObjectAccess.PUBLIC,
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({ catalogObject: null })
    expect(answerCollectionFindUnique).not.toHaveBeenCalled()
    expect(transaction).not.toHaveBeenCalled()
  })

  test('removes catalog object assignments with collection write permission', async () => {
    const assignment = {
      id: 41,
      catalogCollectionId: 'catalog-1',
      answerCollectionId: null,
      elementId: 33,
      courseId: null,
      liveQuizId: null,
      practiceQuizId: null,
      microLearningId: null,
      groupActivityId: null,
    }
    const assignmentDelete = vi.fn().mockResolvedValue(assignment)
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { delete: assignmentDelete },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue(assignment),
      },
      derivedPermission: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ permissionLevel: PermissionLevel.WRITE }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.removeCatalogObjectAssignment({ assignmentId: 41 })
    ).resolves.toEqual({ removed: true })
    expect(assignmentDelete).toHaveBeenCalledWith({ where: { id: 41 } })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.ELEMENT,
        objectId: '33',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollectionAssignment',
      id: 41,
    })
  })

  test('removes top-level catalog object assignments with object admin permission', async () => {
    const assignment = {
      id: 43,
      catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
      answerCollectionId: 21,
      elementId: null,
      courseId: null,
      liveQuizId: null,
      practiceQuizId: null,
      microLearningId: null,
      groupActivityId: null,
    }
    const assignmentDelete = vi.fn().mockResolvedValue(assignment)
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { delete: assignmentDelete },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue(assignment),
      },
      derivedPermission: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ permissionLevel: PermissionLevel.ADMIN }),
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.removeCatalogObjectAssignment({ assignmentId: 43 })
    ).resolves.toEqual({ removed: true })
    expect(assignmentDelete).toHaveBeenCalledWith({ where: { id: 43 } })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_DELETED,
        objectType: ObjectType.ANSWER_COLLECTION,
        objectId: '21',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollectionAssignment',
      id: 43,
    })
  })

  test('does not remove catalog object assignments without edit permission', async () => {
    const assignmentDelete = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          catalogCollectionId: 'catalog-1',
        }),
        delete: assignmentDelete,
      },
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.removeCatalogObjectAssignment({ assignmentId: 41 })
    ).resolves.toEqual({ removed: false })
    expect(assignmentDelete).not.toHaveBeenCalled()
  })
})

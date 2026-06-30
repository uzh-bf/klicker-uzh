import {
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

describe('sharing catalog browser router', () => {
  test('returns collection metadata when the user can browse the collection', async () => {
    const catalogFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ access: ObjectAccess.RESTRICTED })
      .mockResolvedValueOnce({
        id: 'catalog-1',
        name: 'Shared Catalog',
        access: ObjectAccess.RESTRICTED,
        ownerId: 'other-user',
        owner: { shortname: 'lecturer' },
        permissions: [{ permissionLevel: PermissionLevel.WRITE }],
        accessRequests: [],
      })
    const prisma = {
      catalogCollection: { findUnique: catalogFindUnique },
      derivedPermission: {
        findUnique: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.WRITE,
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.catalogCollectionInfo({
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({
      catalogCollectionInfo: {
        id: 'catalog-1',
        name: 'Shared Catalog',
        access: ObjectAccess.RESTRICTED,
        ownerShortname: 'lecturer',
        isOwner: false,
        isManager: false,
        isEditor: true,
        isRequested: false,
        isShared: true,
      },
    })
  })

  test('filters and maps catalog collections for the top-level browser', async () => {
    const prisma = {
      catalogCollection: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'empty-public',
            name: 'Empty Public',
            access: ObjectAccess.PUBLIC,
            ownerId: 'other-user',
            owner: { shortname: 'other' },
            permissions: [],
            accessRequests: [],
            _count: { objectAssignments: 0 },
          },
          {
            id: 'managed',
            name: 'Managed',
            access: ObjectAccess.RESTRICTED,
            ownerId: user.id,
            owner: { shortname: 'owner' },
            permissions: [{ permissionLevel: PermissionLevel.OWNER }],
            accessRequests: [{ id: 1 }],
            _count: { objectAssignments: 0 },
          },
        ]),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.sharing.catalogCollections()).resolves.toEqual({
      catalogCollections: [
        {
          id: 'managed',
          name: 'Managed',
          access: ObjectAccess.RESTRICTED,
          ownerShortname: 'owner',
          isOwner: true,
          isManager: true,
          isEditor: true,
          isRequested: true,
          isShared: false,
        },
      ],
    })
  })

  test('returns no objects for a restricted collection without browse access', async () => {
    const catalogFindUnique = vi
      .fn()
      .mockResolvedValueOnce({ access: ObjectAccess.RESTRICTED })
    const prisma = {
      catalogCollection: { findUnique: catalogFindUnique },
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.catalogObjects({ catalogCollectionId: 'catalog-1' })
    ).resolves.toEqual({ catalogObjects: [] })
    expect(catalogFindUnique).toHaveBeenCalledTimes(1)
  })

  test('maps catalog objects for answer collections, elements, and templates', async () => {
    const catalogFindUnique = vi.fn().mockResolvedValue({
      objectAssignments: [
        {
          id: 1,
          access: ObjectAccess.PUBLIC,
          answerCollection: {
            id: 21,
            name: 'Answers',
            owner: { shortname: 'lecturer' },
            permissions: [{ permissionLevel: PermissionLevel.OWNER }],
            accessRequests: [],
          },
          element: null,
          liveQuiz: null,
        },
        {
          id: 2,
          access: ObjectAccess.RESTRICTED,
          answerCollection: null,
          element: {
            id: 33,
            name: 'Question',
            owner: { shortname: 'assistant' },
            permissions: [{ permissionLevel: PermissionLevel.READ }],
            accessRequests: [{ id: 8 }],
          },
          liveQuiz: null,
        },
        {
          id: 3,
          access: ObjectAccess.PUBLIC,
          answerCollection: null,
          element: null,
          liveQuiz: {
            id: 'quiz-1',
            name: 'Template',
            status: PublicationStatus.TEMPLATE,
            owner: { shortname: 'lecturer' },
            permissions: [],
            accessRequests: [],
            templateInfo: { id: 'template-1' },
          },
        },
      ],
    })
    const prisma = {
      catalogCollection: {
        findUnique: catalogFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.catalogObjects({ catalogCollectionId: null })
    ).resolves.toEqual({
      catalogObjects: [
        {
          id: 1,
          objectId: 21,
          objectUuid: null,
          name: 'Answers',
          objectType: ObjectType.ANSWER_COLLECTION,
          templateId: null,
          access: ObjectAccess.PUBLIC,
          ownerShortname: 'lecturer',
          isOwner: true,
          isManager: true,
          isRequested: false,
          isShared: false,
        },
        {
          id: 2,
          objectId: 33,
          objectUuid: null,
          name: 'Question',
          objectType: ObjectType.ELEMENT,
          templateId: null,
          access: ObjectAccess.RESTRICTED,
          ownerShortname: 'assistant',
          isOwner: false,
          isManager: false,
          isRequested: true,
          isShared: true,
        },
        {
          id: 3,
          objectId: null,
          objectUuid: 'quiz-1',
          name: 'Template',
          objectType: ObjectType.LIVE_QUIZ,
          templateId: 'template-1',
          access: ObjectAccess.PUBLIC,
          ownerShortname: 'lecturer',
          isOwner: false,
          isManager: false,
          isRequested: false,
          isShared: false,
        },
      ],
    })
    expect(catalogFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MISSING_CATALOG_COLLECTION_ID },
      })
    )
  })

  test('returns public answer collection catalog info with entries', async () => {
    const assignmentFindUnique = vi.fn().mockResolvedValue({
      access: ObjectAccess.PUBLIC,
    })
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          description: 'Reusable answer options',
          entries: [
            { id: 1, value: 'Option A' },
            { id: 2, value: 'Option B' },
          ],
        }),
      },
      catalogCollection: {
        findUnique: vi.fn().mockResolvedValue({ access: ObjectAccess.PUBLIC }),
      },
      catalogCollectionAssignment: {
        findUnique: assignmentFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.answerCollectionCatalogInfo({
        collectionId: 21,
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({
      answerCollectionCatalogInfo: {
        id: 21,
        name: 'Answers',
        description: 'Reusable answer options',
        entries: [
          { id: 1, value: 'Option A' },
          { id: 2, value: 'Option B' },
        ],
      },
    })
    expect(assignmentFindUnique).toHaveBeenCalledWith({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: 21,
          catalogCollectionId: 'catalog-1',
        },
      },
      select: { access: true },
    })
  })

  test('hides entries for restricted answer collection catalog assignments', async () => {
    const assignmentFindUnique = vi.fn().mockResolvedValue({
      access: ObjectAccess.RESTRICTED,
    })
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          description: 'Reusable answer options',
          entries: [{ id: 1, value: 'Option A' }],
        }),
      },
      catalogCollectionAssignment: {
        findUnique: assignmentFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.answerCollectionCatalogInfo({
        collectionId: 21,
        catalogCollectionId: null,
      })
    ).resolves.toEqual({
      answerCollectionCatalogInfo: {
        id: 21,
        name: 'Answers',
        description: 'Reusable answer options',
        entries: [],
      },
    })
    expect(assignmentFindUnique).toHaveBeenCalledWith({
      where: {
        answerCollectionId_catalogCollectionId: {
          answerCollectionId: 21,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
        },
      },
      select: { access: true },
    })
  })

  test('returns null for answer collection info in an unbrowsable catalog collection', async () => {
    const assignmentFindUnique = vi.fn()
    const prisma = {
      answerCollection: {
        findUnique: vi.fn().mockResolvedValue({
          id: 21,
          name: 'Answers',
          description: 'Reusable answer options',
          entries: [{ id: 1, value: 'Option A' }],
        }),
      },
      catalogCollection: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ access: ObjectAccess.RESTRICTED }),
      },
      derivedPermission: {
        findUnique: vi.fn().mockResolvedValue(null),
      },
      catalogCollectionAssignment: {
        findUnique: assignmentFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.answerCollectionCatalogInfo({
        collectionId: 21,
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({ answerCollectionCatalogInfo: null })
    expect(assignmentFindUnique).not.toHaveBeenCalled()
  })
})

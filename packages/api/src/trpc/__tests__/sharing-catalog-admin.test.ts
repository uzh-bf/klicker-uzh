import {
  AuditLogType,
  ObjectAccess,
  ObjectType,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  MISSING_CATALOG_COLLECTION_ID,
  recomputeDerivedPermissions,
} from '@klicker-uzh/util'
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

describe('sharing catalog administration router', () => {
  beforeEach(() => {
    vi.mocked(recomputeDerivedPermissions).mockClear()
  })

  test('creates a catalog collection for the current user', async () => {
    const catalogCollectionCreate = vi.fn().mockResolvedValue({
      id: 'catalog-1',
      name: 'Shared Catalog',
      access: ObjectAccess.PUBLIC,
      owner: { shortname: 'owner' },
    })
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollection: { create: catalogCollectionCreate },
      })
    )
    const prisma = {
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.createCatalogCollection({
        name: 'Shared Catalog',
        access: ObjectAccess.PUBLIC,
      })
    ).resolves.toEqual({
      catalogCollection: {
        id: 'catalog-1',
        name: 'Shared Catalog',
        access: ObjectAccess.PUBLIC,
        ownerShortname: 'owner',
        isOwner: true,
        isManager: true,
        isEditor: true,
        isRequested: false,
        isShared: false,
      },
    })
    expect(catalogCollectionCreate).toHaveBeenCalledWith({
      data: {
        name: 'Shared Catalog',
        access: ObjectAccess.PUBLIC,
        owner: { connect: { id: user.id } },
      },
      include: { owner: { select: { shortname: true } } },
    })
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { catalogCollectionId: 'catalog-1', userId: user.id },
      expect.anything()
    )
  })

  test('does not rename catalog collections without write permission', async () => {
    const catalogCollectionUpdate = vi.fn()
    const prisma = {
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogCollection: { update: catalogCollectionUpdate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.changeCatalogCollectionName({
        catalogCollectionId: 'catalog-1',
        name: 'Renamed',
      })
    ).resolves.toEqual({ changed: false })
    expect(catalogCollectionUpdate).not.toHaveBeenCalled()
  })

  test('renames catalog collections with write permission', async () => {
    const emit = vi.fn()
    const catalogCollectionUpdate = vi
      .fn()
      .mockResolvedValue({ id: 'catalog-1' })
    const prisma = {
      derivedPermission: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ permissionLevel: PermissionLevel.WRITE }),
      },
      catalogCollection: { update: catalogCollectionUpdate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.changeCatalogCollectionName({
        catalogCollectionId: 'catalog-1',
        name: 'Renamed',
      })
    ).resolves.toEqual({ changed: true })
    expect(catalogCollectionUpdate).toHaveBeenCalledWith({
      where: { id: 'catalog-1' },
      data: { name: 'Renamed' },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollection',
      id: 'catalog-1',
    })
  })

  test('changes catalog collection access with admin permission and audit log', async () => {
    const catalogCollectionUpdate = vi
      .fn()
      .mockResolvedValue({ id: 'catalog-1' })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollection: { update: catalogCollectionUpdate },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
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
      caller.sharing.changeCatalogCollectionAccess({
        catalogCollectionId: 'catalog-1',
        access: ObjectAccess.RESTRICTED,
      })
    ).resolves.toEqual({ changed: true })
    expect(catalogCollectionUpdate).toHaveBeenCalledWith({
      where: { id: 'catalog-1' },
      data: { access: ObjectAccess.RESTRICTED },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
        objectType: ObjectType.CATALOG_COLLECTION,
        objectId: 'catalog-1',
        sourceUserId: user.id,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollection',
      id: 'catalog-1',
    })
  })

  test('does not change catalog collection access without admin permission', async () => {
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.changeCatalogCollectionAccess({
        catalogCollectionId: 'catalog-1',
        access: ObjectAccess.RESTRICTED,
      })
    ).resolves.toEqual({ changed: false })
    expect(transaction).not.toHaveBeenCalled()
  })

  test('deletes catalog collections with admin permission', async () => {
    const catalogCollectionDelete = vi
      .fn()
      .mockResolvedValue({ id: 'catalog-1' })
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ permissionLevel: PermissionLevel.ADMIN }),
      },
      catalogCollection: { delete: catalogCollectionDelete },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller({
      ...createContext(prisma),
      emitter: { emit } as unknown as TRPCContext['emitter'],
    })

    await expect(
      caller.sharing.deleteCatalogCollection({
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({ deletedCatalogCollectionId: 'catalog-1' })
    expect(catalogCollectionDelete).toHaveBeenCalledWith({
      where: { id: 'catalog-1' },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'CatalogCollection',
      id: 'catalog-1',
    })
  })

  test('does not delete catalog collections without admin permission', async () => {
    const catalogCollectionDelete = vi.fn()
    const prisma = {
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
      catalogCollection: { delete: catalogCollectionDelete },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.deleteCatalogCollection({
        catalogCollectionId: 'catalog-1',
      })
    ).resolves.toEqual({ deletedCatalogCollectionId: null })
    expect(catalogCollectionDelete).not.toHaveBeenCalled()
  })

  test('does not change catalog object access without edit permission', async () => {
    const assignmentUpdate = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          catalogCollectionId: 'catalog-1',
        }),
        update: assignmentUpdate,
      },
      derivedPermission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.sharing.changeCatalogObjectAccess({
        assignmentId: 41,
        access: ObjectAccess.PUBLIC,
      })
    ).resolves.toEqual({ changed: false })
    expect(assignmentUpdate).not.toHaveBeenCalled()
  })

  test('changes catalog object access inside a collection with collection write permission', async () => {
    const assignmentUpdate = vi.fn().mockResolvedValue({
      id: 41,
      catalogCollectionId: 'catalog-1',
      answerCollectionId: null,
      elementId: 33,
      courseId: null,
      liveQuizId: null,
      practiceQuizId: null,
      microLearningId: null,
      groupActivityId: null,
    })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { update: assignmentUpdate },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          catalogCollectionId: 'catalog-1',
          answerCollectionId: null,
          elementId: 33,
          courseId: null,
          liveQuizId: null,
          practiceQuizId: null,
          microLearningId: null,
          groupActivityId: null,
        }),
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
      caller.sharing.changeCatalogObjectAccess({
        assignmentId: 41,
        access: ObjectAccess.PUBLIC,
      })
    ).resolves.toEqual({ changed: true })
    expect(assignmentUpdate).toHaveBeenCalledWith({
      where: { id: 41 },
      data: { access: ObjectAccess.PUBLIC },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
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

  test('changes top-level catalog object access with object admin permission', async () => {
    const assignmentUpdate = vi.fn().mockResolvedValue({
      id: 41,
      catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
      answerCollectionId: 21,
      elementId: null,
      courseId: null,
      liveQuizId: null,
      practiceQuizId: null,
      microLearningId: null,
      groupActivityId: null,
    })
    const auditCreate = vi.fn().mockResolvedValue({})
    const transaction = vi.fn(async (callback) =>
      callback({
        catalogCollectionAssignment: { update: assignmentUpdate },
        auditLogEntry: { create: auditCreate },
      })
    )
    const emit = vi.fn()
    const prisma = {
      catalogCollectionAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          id: 41,
          catalogCollectionId: MISSING_CATALOG_COLLECTION_ID,
          answerCollectionId: 21,
          elementId: null,
          courseId: null,
          liveQuizId: null,
          practiceQuizId: null,
          microLearningId: null,
          groupActivityId: null,
        }),
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
      caller.sharing.changeCatalogObjectAccess({
        assignmentId: 41,
        access: ObjectAccess.PUBLIC,
      })
    ).resolves.toEqual({ changed: true })
    expect(assignmentUpdate).toHaveBeenCalledWith({
      where: { id: 41 },
      data: { access: ObjectAccess.PUBLIC },
    })
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: AuditLogType.CATALOG_ASSIGNMENT_MODIFIED,
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
})

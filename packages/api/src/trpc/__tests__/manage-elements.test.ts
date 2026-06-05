import {
  ActivityLogType,
  ElementStatus,
  ElementType,
  ObjectType,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType, SortByType } from '@klicker-uzh/types'
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

  test('returns empty element list when user is missing', async () => {
    const userFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      user: { findUnique: userFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.list({
        hasSampleSolution: false,
        hasAnswerFeedbacks: false,
        tagIds: [],
        showUntagged: false,
        sortByType: SortByType.MODIFIED,
        sortByAsc: false,
        showArchived: false,
        numEntries: 10,
        offset: 0,
      })
    ).resolves.toEqual({ numOfElements: 0, elements: [] })
    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: user.id } })
    )
  })

  test('returns filtered element list with sharing flags', async () => {
    const createdAt = new Date('2026-01-01T10:00:00Z')
    const updatedAt = new Date('2026-01-02T10:00:00Z')
    const userFindUnique = vi.fn().mockResolvedValue({
      _count: { objects: 2 },
      objects: [
        {
          permissionLevel: PermissionLevel.OWNER,
          derived: false,
          directPermission: { userGroupId: null },
          element: {
            id: 17,
            version: 2,
            name: 'Owned SC',
            status: ElementStatus.DRAFT,
            type: ElementType.SC,
            content: 'Question content',
            explanation: null,
            basePoints: true,
            pointsMultiplier: 2,
            options: {
              hasSampleSolution: true,
              hasAnswerFeedbacks: true,
              displayMode: 'LIST',
              choices: [{ ix: 0, value: 'A', correct: true }],
            },
            createdAt,
            updatedAt,
            isArchived: false,
            isDeleted: false,
            originalId: null,
            tags: [{ id: 5, name: 'Tag', order: 0 }],
          },
        },
        {
          permissionLevel: PermissionLevel.READ,
          derived: true,
          directPermission: { userGroupId: null },
          element: {
            id: 18,
            version: 1,
            name: 'Dependency',
            status: ElementStatus.READY,
            type: ElementType.CONTENT,
            content: 'Content',
            explanation: null,
            basePoints: false,
            pointsMultiplier: 1,
            options: {},
            createdAt,
            updatedAt,
            isArchived: false,
            isDeleted: false,
            originalId: 'source-element-7',
            tags: [],
          },
        },
      ],
    })
    const prisma = {
      user: { findUnique: userFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.list({
        status: ElementStatus.DRAFT,
        type: ElementType.SC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
        searchString: 'owned',
        showOwned: true,
        showShared: true,
        showDependencies: true,
        tagIds: [5],
        activityId: 'activity-1',
        multiplier: 2,
        showUntagged: false,
        sortByType: SortByType.TITLE,
        sortByAsc: true,
        showArchived: false,
        numEntries: 10,
        offset: 20,
      })
    ).resolves.toMatchObject({
      numOfElements: 2,
      elements: [
        {
          __typename: 'ChoicesElement',
          id: 17,
          name: 'Owned SC',
          permissionLevel: PermissionLevel.OWNER,
          isOwner: true,
          isManager: true,
          isEditor: true,
          isImported: false,
          isShared: false,
          isRemovable: false,
          sharingType: SharingType.OWNED,
          options: {
            __typename: 'ChoiceElementOptions',
            hasSampleSolution: true,
            hasAnswerFeedbacks: true,
          },
          tags: [{ id: 5, name: 'Tag', order: 0 }],
        },
        {
          __typename: 'ContentElement',
          id: 18,
          permissionLevel: PermissionLevel.READ,
          derivedAccess: true,
          isOwner: false,
          isManager: false,
          isEditor: false,
          isImported: false,
          isShared: true,
          isRemovable: false,
          sharingType: SharingType.DEPENDENCY,
        },
      ],
    })
    expect(userFindUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      include: {
        _count: { select: { objects: { where: expect.any(Object) } } },
        objects: expect.objectContaining({
          where: expect.objectContaining({
            NOT: { derived: true, element: { isDeleted: true } },
            permissionLevel: undefined,
            derived: undefined,
            elementId: { not: null },
            element: expect.objectContaining({
              status: ElementStatus.DRAFT,
              type: ElementType.SC,
              isArchived: false,
              tags: undefined,
              OR: [
                {
                  name: {
                    contains: 'owned',
                    mode: 'insensitive',
                  },
                },
                {
                  content: {
                    contains: 'owned',
                    mode: 'insensitive',
                  },
                },
              ],
            }),
          }),
          include: {
            directPermission: true,
            element: {
              include: {
                tags: {
                  where: { ownerId: user.id },
                  orderBy: { order: 'asc' },
                },
              },
            },
          },
          orderBy: [
            { element: { name: 'asc' } },
            { element: { updatedAt: 'desc' } },
          ],
          take: 10,
          skip: 20,
        }),
      },
    })
  })

  test('returns null single element when read permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const elementFindUnique = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.single({ id: 17 })).resolves.toEqual({
      element: null,
    })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        elementId: 17,
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
    expect(elementFindUnique).not.toHaveBeenCalled()
  })

  test('returns single element edit data for readable elements', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      id: 17,
      version: 2,
      name: 'Question',
      status: ElementStatus.READY,
      type: ElementType.SC,
      content: 'Question content',
      explanation: 'Explanation',
      basePoints: true,
      pointsMultiplier: 2,
      options: {
        displayMode: 'LIST',
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        choices: [{ ix: 0, value: 'A', correct: true }],
      },
      tags: [{ id: 5, name: 'Tag', order: 0 }],
      answerCollectionId: null,
      answerCollectionItems: [],
      permissions: [
        {
          permissionLevel: PermissionLevel.WRITE,
          derived: false,
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.element.single({ id: 17 })).resolves.toMatchObject({
      element: {
        __typename: 'ChoicesElement',
        id: 17,
        name: 'Question',
        isEditor: true,
        options: {
          hasSampleSolution: true,
          choices: [{ ix: 0, value: 'A', correct: true }],
        },
        tags: [{ id: 5, name: 'Tag', order: 0 }],
      },
    })
    expect(elementFindUnique).toHaveBeenCalledWith({
      where: { id: 17, permissions: { some: { userId: user.id } } },
      include: {
        permissions: {
          where: { userId: user.id },
        },
        tags: {
          where: { ownerId: user.id },
          orderBy: { order: 'asc' },
        },
        answerCollectionItems: true,
      },
    })
  })

  test('returns null instance update activities when write permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const elementFindUnique = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.instanceUpdateActivities({
        elementId: 17,
        hasSampleSolution: true,
        includeTemplateInstances: true,
      })
    ).resolves.toEqual({ instanceUpdateActivities: null })
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        elementId: 17,
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(elementFindUnique).not.toHaveBeenCalled()
  })

  test('returns instance update activity metadata for writable element instances', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      id: 17,
      type: ElementType.SC,
      elementInstances: [
        {
          elementBlock: {
            liveQuiz: {
              name: 'Live quiz',
              status: PublicationStatus.DRAFT,
              permissions: [{ permissionLevel: PermissionLevel.WRITE }],
            },
          },
          elementStack: null,
        },
        {
          elementBlock: null,
          elementStack: {
            microLearning: null,
            practiceQuiz: {
              name: 'Practice quiz',
              status: PublicationStatus.DRAFT,
            },
            groupActivity: null,
          },
        },
        {
          elementBlock: null,
          elementStack: {
            microLearning: null,
            practiceQuiz: null,
            groupActivity: {
              name: 'Group activity',
              status: PublicationStatus.TEMPLATE,
            },
          },
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.instanceUpdateActivities({
        elementId: 17,
        hasSampleSolution: false,
        includeTemplateInstances: true,
      })
    ).resolves.toEqual({
      instanceUpdateActivities: [
        {
          activityName: 'Live quiz',
          activityType: ActivityType.LIVE_QUIZ,
          status: PublicationStatus.DRAFT,
        },
        {
          activityName: 'Group activity',
          activityType: ActivityType.GROUP_ACTIVITY,
          status: PublicationStatus.TEMPLATE,
        },
      ],
    })
    expect(elementFindUnique).toHaveBeenCalledWith({
      where: { id: 17 },
      include: expect.objectContaining({
        elementInstances: expect.any(Object),
      }),
    })
  })

  test('returns null when editing an element without write permission', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const upsert = vi.fn()
    const prisma = {
      derivedPermission: { findFirst },
      element: { upsert },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.manipulateFlashcard({
        id: 17,
        status: ElementStatus.READY,
        name: 'Flashcard',
        content: 'Question',
        explanation: 'Answer',
        pointsMultiplier: 1,
        tags: [],
      })
    ).resolves.toEqual({ element: null })
    expect(upsert).not.toHaveBeenCalled()
  })

  test('creates a content element and records creation side effects', async () => {
    const emit = vi.fn()
    const createdAt = new Date('2026-06-05T08:00:00Z')
    const updatedAt = new Date('2026-06-05T08:00:00Z')
    const upsert = vi.fn().mockResolvedValue({
      id: 17,
      version: 1,
      name: 'Content',
      status: ElementStatus.READY,
      type: ElementType.CONTENT,
      content: 'Content body',
      explanation: null,
      basePoints: false,
      pointsMultiplier: 1,
      options: {},
      tags: [{ id: 5, name: 'Tag', order: 0 }],
      answerCollectionId: null,
      answerCollectionItems: [],
      createdAt,
      updatedAt,
    })
    const activityLogCreate = vi.fn().mockResolvedValue({})
    const prisma = {
      element: { upsert },
      activityLogEntry: { create: activityLogCreate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.element.manipulateContent({
        status: ElementStatus.READY,
        name: 'Content',
        content: 'Content body',
        pointsMultiplier: 1,
        tags: ['Tag'],
      })
    ).resolves.toMatchObject({
      element: {
        __typename: 'ContentElement',
        id: 17,
        name: 'Content',
        tags: [{ id: 5, name: 'Tag', order: 0 }],
      },
    })
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          type: ElementType.CONTENT,
          owner: { connect: { id: user.id } },
        }),
      })
    )
    expect(recomputeDerivedPermissions).toHaveBeenCalledWith(
      { elementId: 17, userId: user.id },
      prisma
    )
    expect(activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: ActivityLogType.CREATION,
        objectType: ObjectType.ELEMENT,
        elementId: 17,
        userId: user.id,
        createdAt,
        updatedAt,
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Element',
      id: 17,
    })
  })

  test('flags outdated element instances and emits activity invalidation', async () => {
    const emit = vi.fn()
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      id: 17,
      version: 3,
    })
    const elementInstanceFindMany = vi.fn().mockResolvedValue([
      {
        id: 23,
        elementBlock: { liveQuizId: 'live-1' },
        elementStack: null,
      },
    ])
    const elementInstanceUpdate = vi.fn().mockResolvedValue({})
    const liveQuizUpdate = vi.fn().mockResolvedValue({})
    const prisma = {
      derivedPermission: { findFirst },
      element: { findUnique: elementFindUnique },
      elementInstance: {
        findMany: elementInstanceFindMany,
        update: elementInstanceUpdate,
      },
      liveQuiz: { update: liveQuizUpdate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.element.flagOutdatedInstances({ elementId: 17 })
    ).resolves.toEqual({ success: true })
    expect(elementInstanceFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        elementId: 17,
        NOT: {
          elementData: {
            path: ['id'],
            equals: '17-v3',
          },
        },
      }),
      include: expect.any(Object),
    })
    expect(elementInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 23 },
      data: { isVersionOutdated: true },
    })
    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'live-1' },
      data: { areInstancesOutdated: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'live-1',
    })
  })

  test('changes element status, records modification, and emits invalidation', async () => {
    const emit = vi.fn()
    const findFirst = vi.fn().mockResolvedValue({ id: 3 })
    const elementFindUnique = vi.fn().mockResolvedValue({
      id: 17,
      status: ElementStatus.DRAFT,
    })
    const elementUpdate = vi.fn().mockResolvedValue({
      id: 17,
      status: ElementStatus.READY,
    })
    const activityLogCreate = vi.fn().mockResolvedValue({})
    const prisma = {
      derivedPermission: { findFirst },
      element: {
        findUnique: elementFindUnique,
        update: elementUpdate,
      },
      activityLogEntry: { create: activityLogCreate },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { emit } as unknown as TRPCContext['emitter'])
    )

    await expect(
      caller.element.changeStatus({
        elementId: 17,
        status: ElementStatus.READY,
      })
    ).resolves.toEqual({ success: true })
    expect(elementUpdate).toHaveBeenCalledWith({
      where: { id: 17 },
      data: { status: ElementStatus.READY },
    })
    expect(activityLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: ActivityLogType.MODIFICATION,
        objectType: ObjectType.ELEMENT,
        elementId: 17,
        userId: user.id,
        modificationDetails: {
          field: 'status',
          oldValue: ElementStatus.DRAFT,
          newValue: ElementStatus.READY,
        },
      }),
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'Element',
      id: 17,
    })
  })

  test('returns zero for element batch operations without selected work', async () => {
    const elementFindMany = vi.fn()
    const prisma = {
      element: { findMany: elementFindMany },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.applyBatchOperations({
        elementIds: [],
        archive: false,
        unarchive: false,
        updateInstances: false,
        updateTemplateInstances: false,
      })
    ).resolves.toEqual({ updatedCount: 0 })
    await expect(
      caller.element.applyBatchOperations({
        elementIds: [17],
        archive: true,
        unarchive: true,
        updateInstances: false,
        updateTemplateInstances: false,
      })
    ).resolves.toEqual({ updatedCount: 0 })
    await expect(
      caller.element.applyBatchOperations({
        elementIds: [17],
        archive: false,
        unarchive: false,
        updateInstances: true,
        updateTemplateInstances: false,
      })
    ).resolves.toEqual({ updatedCount: 0 })
    expect(elementFindMany).not.toHaveBeenCalled()
  })

  test('applies element batch operations to eligible elements only', async () => {
    const elementFindMany = vi.fn().mockResolvedValue([
      { id: 17, type: ElementType.SC },
      { id: 18, type: ElementType.MC },
    ])
    const elementUpdate = vi.fn(async ({ where }) => ({ id: where.id }))
    const transactionClient = {
      element: { update: elementUpdate },
    }
    const transaction = vi.fn(async (callback) => callback(transactionClient))
    const prisma = {
      element: { findMany: elementFindMany },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.applyBatchOperations({
        elementIds: [17, 18, 19],
        archive: false,
        unarchive: false,
        multiplier: 2,
        updateInstances: false,
        updateTemplateInstances: false,
      })
    ).resolves.toEqual({ updatedCount: 2 })
    expect(elementFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: [17, 18, 19] },
        isDeleted: false,
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [
                PermissionLevel.OWNER,
                PermissionLevel.ADMIN,
                PermissionLevel.WRITE,
              ],
            },
          },
        },
        isArchived: undefined,
        options: { path: ['hasSampleSolution'], equals: true },
        type: undefined,
      },
    })
    expect(transaction).toHaveBeenCalledTimes(2)
    expect(elementUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 17 },
      data: {
        version: { increment: 1 },
        isArchived: undefined,
        status: undefined,
        pointsMultiplier: 2,
        basePoints: undefined,
      },
    })
    expect(elementUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 18 },
      data: {
        version: { increment: 1 },
        isArchived: undefined,
        status: undefined,
        pointsMultiplier: 2,
        basePoints: undefined,
      },
    })
  })

  test('updates element instances during element batch operations when requested', async () => {
    const elementFindMany = vi
      .fn()
      .mockResolvedValue([{ id: 17, type: ElementType.SC }])
    const elementUpdate = vi.fn().mockResolvedValue({ id: 17 })
    const elementFindUnique = vi.fn().mockResolvedValue(null)
    const transactionClient = {
      element: {
        update: elementUpdate,
        findUnique: elementFindUnique,
      },
    }
    const transaction = vi.fn(async (callback) => callback(transactionClient))
    const prisma = {
      element: { findMany: elementFindMany },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.element.applyBatchOperations({
        elementIds: [17],
        archive: false,
        unarchive: false,
        status: ElementStatus.READY,
        updateInstances: true,
        updateTemplateInstances: true,
      })
    ).resolves.toEqual({ updatedCount: 1 })
    expect(elementFindMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: { in: [17] },
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [
                PermissionLevel.OWNER,
                PermissionLevel.ADMIN,
                PermissionLevel.WRITE,
                PermissionLevel.EXECUTE,
                PermissionLevel.READ,
              ],
            },
          },
        },
      }),
    })
    expect(elementUpdate).toHaveBeenCalledWith({
      where: { id: 17 },
      data: {
        version: { increment: 1 },
        isArchived: undefined,
        status: ElementStatus.READY,
        pointsMultiplier: undefined,
        basePoints: undefined,
      },
    })
    expect(elementFindUnique).toHaveBeenCalledWith({
      where: { id: 17, isDeleted: false },
      include: expect.objectContaining({
        elementInstances: expect.any(Object),
        answerCollection: { include: { entries: true } },
        answerCollectionItems: true,
      }),
    })
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

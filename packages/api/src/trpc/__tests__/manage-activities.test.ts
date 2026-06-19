import {
  ElementInstanceType,
  ElementOrderType,
  ElementType,
  Locale,
  PermissionLevel,
  PointCorrectionType,
  PublicationStatus,
  ReviewStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  ActivityType,
  ResponseCorrectness,
  SharingType,
  SortByType,
} from '@klicker-uzh/types'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'user-1',
}

function createContext(
  prisma: TRPCContext['prisma'],
  options?: {
    scope?: UserLoginScope
    emitter?: TRPCContext['emitter']
    hatchet?: TRPCContext['hatchet']
    pubSub?: TRPCContext['pubSub']
    tasks?: TRPCContext['tasks']
    redisExec?: TRPCContext['redisExec']
    redisAssessmentExec?: TRPCContext['redisAssessmentExec']
  }
): TRPCContext {
  return {
    prisma,
    emitter: options?.emitter,
    hatchet: options?.hatchet,
    pubSub: options?.pubSub,
    tasks: options?.tasks,
    redisExec: options?.redisExec,
    redisAssessmentExec: options?.redisAssessmentExec,
    user: {
      sub: user.id,
      role: UserRole.USER,
      scope: options?.scope ?? UserLoginScope.ACCOUNT_OWNER,
      catalystInstitutional: false,
      catalystIndividual: true,
    },
  }
}

describe('manage activity read routers', () => {
  test('returns only courses with activities for the activity overview filters', async () => {
    const findUnique = vi.fn().mockResolvedValue({
      objects: [
        {
          courseId: 'course-empty',
          course: {
            id: 'course-empty',
            name: 'Empty Course',
            _count: {
              liveQuizzes: 0,
              practiceQuizzes: 0,
              microLearnings: 0,
              groupActivities: 0,
            },
          },
        },
        {
          courseId: 'course-active',
          course: {
            id: 'course-active',
            name: 'Active Course',
            _count: {
              liveQuizzes: 1,
              practiceQuizzes: 0,
              microLearnings: 0,
              groupActivities: 0,
            },
          },
        },
      ],
    })
    const prisma = {
      user: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(caller.activity.userActivitiesCourses()).resolves.toEqual({
      userActivitiesCourses: [{ id: 'course-active', name: 'Active Course' }],
    })

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: user.id },
      select: {
        objects: {
          where: { courseId: { not: null } },
          select: {
            courseId: true,
            course: {
              select: {
                id: true,
                name: true,
                _count: {
                  select: {
                    liveQuizzes: true,
                    practiceQuizzes: true,
                    microLearnings: true,
                    groupActivities: true,
                  },
                },
              },
            },
          },
          orderBy: { course: { endDate: 'desc' } },
        },
      },
    })
  })

  test('returns filtered activity overview entries with permission flags', async () => {
    const createdAt = new Date('2026-01-01T00:00:00.000Z')
    const updatedAt = new Date('2026-02-01T00:00:00.000Z')
    const availableFrom = new Date('2026-03-01T00:00:00.000Z')
    const scheduledStartAt = new Date('2026-03-05T00:00:00.000Z')
    const scheduledEndAt = new Date('2026-03-10T00:00:00.000Z')
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 'activity-1',
        type: ActivityType.LIVE_QUIZ,
        typeOrder: 1,
        name: 'Live Quiz',
        displayName: 'Live Quiz',
        description: null,
        status: PublicationStatus.SCHEDULED,
        reviewStatus: ReviewStatus.REVIEWED,
        isDeleted: false,
        areInstancesOutdated: true,
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pointsMultiplier: 2,
        pinCode: '123456',
        templateId: null,
        templateName: null,
        createdAt,
        updatedAt,
        availableFrom,
        scheduledStartAt,
        scheduledEndAt,
        courseId: null,
        courseName: null,
        courseLanguage: Locale.en,
        courseStartDate: null,
        groupDeadlineDate: null,
        numOfParticipantGroups: null,
        numOfStacks: 2,
        numOfElements: 5,
        userId: user.id,
        permissionLevel: PermissionLevel.ADMIN,
        derived: false,
        directPermissionUserGroupId: null,
        ownerId: 'owner-1',
        numActivityPermissions: 3,
        isUserCourseAdmin: false,
      },
      {
        id: 'activity-derived-deleted',
        type: ActivityType.PRACTICE_QUIZ,
        typeOrder: 2,
        name: 'Deleted Derived',
        displayName: 'Deleted Derived',
        description: null,
        status: PublicationStatus.DRAFT,
        reviewStatus: ReviewStatus.INCOMPLETE,
        isDeleted: true,
        areInstancesOutdated: false,
        isGamificationEnabled: false,
        isAssessmentEnabled: false,
        pointsMultiplier: 1,
        pinCode: null,
        templateId: null,
        templateName: null,
        createdAt,
        updatedAt,
        availableFrom: null,
        scheduledStartAt: null,
        scheduledEndAt: null,
        courseId: 'course-1',
        courseName: 'Course 1',
        courseLanguage: Locale.en,
        courseStartDate: null,
        groupDeadlineDate: null,
        numOfParticipantGroups: null,
        numOfStacks: 1,
        numOfElements: 1,
        userId: user.id,
        permissionLevel: PermissionLevel.READ,
        derived: true,
        directPermissionUserGroupId: null,
        ownerId: 'owner-1',
        numActivityPermissions: 1,
        isUserCourseAdmin: false,
      },
    ])
    const count = vi.fn().mockResolvedValue(2)
    const prisma = {
      userActivities: {
        findMany,
        count,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.userActivities({
        statusFilter: [PublicationStatus.DRAFT],
        activityTypeFilter: ActivityType.LIVE_QUIZ,
        courseId: 'course-1',
        withoutCourse: false,
        searchString: 'demo',
        showOwned: false,
        showShared: true,
        showDependencies: false,
        multiplier: 2,
        reviewStatus: ReviewStatus.REVIEWED,
        isGamificationEnabled: true,
        isAssessmentEnabled: true,
        isPinProtected: true,
        sortByType: SortByType.TITLE,
        sortByAsc: true,
        numEntries: 5,
        offset: 10,
      })
    ).resolves.toEqual({
      userActivities: {
        numOfActivities: 2,
        activities: [
          {
            id: 'activity-1',
            templateId: null,
            type: ActivityType.LIVE_QUIZ,
            status: PublicationStatus.SCHEDULED,
            courseId: null,
            courseName: null,
            courseStartDate: null,
            courseLanguage: Locale.en,
            numOfStacks: 2,
            numOfElements: 5,
            reviewStatus: ReviewStatus.REVIEWED,
            automaticPublicationAt: availableFrom,
            scheduledStartAt,
            scheduledEndAt,
            groupDeadlineDate: null,
            numOfParticipantGroups: null,
            name: 'Live Quiz',
            displayName: 'Live Quiz',
            permissionLevel: PermissionLevel.ADMIN,
            derivedAccess: false,
            areInstancesOutdated: true,
            isGamificationEnabled: true,
            isAssessmentEnabled: false,
            pinCode: '123456',
            numSharedUsers: 3,
            isOwner: false,
            isManager: true,
            isEditor: true,
            isExecutor: true,
            isShared: true,
            isRemovable: true,
            isActivityReviewer: true,
            sharingType: SharingType.SHARED,
            updatedAt,
          },
        ],
      },
    })

    const where = {
      userId: user.id,
      permissionLevel: {
        in: [
          PermissionLevel.ADMIN,
          PermissionLevel.WRITE,
          PermissionLevel.EXECUTE,
          PermissionLevel.READ,
        ],
      },
      derived: false,
      status: { in: [PublicationStatus.DRAFT] },
      pointsMultiplier: { equals: 2 },
      reviewStatus: { equals: ReviewStatus.REVIEWED },
      type: { equals: ActivityType.LIVE_QUIZ },
      isGamificationEnabled: { equals: true },
      isAssessmentEnabled: { equals: true },
      pinCode: { not: null },
      courseId: { equals: 'course-1' },
      OR: [
        {
          name: {
            contains: 'demo',
            mode: 'insensitive',
          },
        },
        {
          displayName: {
            contains: 'demo',
            mode: 'insensitive',
          },
        },
      ],
    }

    expect(findMany).toHaveBeenCalledWith({
      where,
      orderBy: [{ name: 'asc' }, { updatedAt: 'desc' }],
      take: 5,
      skip: 10,
    })
    expect(count).toHaveBeenCalledWith({ where })
  })

  test('returns null activity details when read permission is missing', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const findUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      liveQuiz: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.details({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ activityDetails: null })

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(findUnique).not.toHaveBeenCalled()
  })

  test('returns live quiz activity details with point totals and permission flags', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      name: 'Live Quiz',
      displayName: 'Displayed Live Quiz',
      status: PublicationStatus.SCHEDULED,
      reviewStatus: ReviewStatus.INCOMPLETE,
      courseId: null,
      owner: {
        shortname: 'lecturer',
        email: 'lecturer@example.com',
      },
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      pointsMultiplier: 2,
      defaultPoints: 5,
      defaultCorrectPoints: 10,
      maxBonusPoints: 3,
      pinCode: '123456',
      _count: {
        permissions: 1,
      },
      course: null,
      blocks: [
        {
          id: 7,
          timeLimit: 30,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.SC,
              options: {
                basePoints: true,
                pointsMultiplier: 2,
              },
              elementData: {
                id: 'element-1-v1',
                elementId: 1,
                name: 'Question 1',
                type: ElementType.SC,
                content: 'Question text',
                explanation: null,
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                },
              },
              results: { total: 3 },
              anonymousResults: { total: 2 },
              element: {
                isDeleted: false,
                _count: {
                  permissions: 1,
                },
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      liveQuiz: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.details({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      activityDetails: {
        id: 'live-quiz-1',
        name: 'Live Quiz',
        displayName: 'Displayed Live Quiz',
        status: PublicationStatus.SCHEDULED,
        reviewStatus: ReviewStatus.INCOMPLETE,
        isActivityReviewer: true,
        isActivityManager: true,
        courseId: null,
        ownerShortname: 'lecturer',
        ownerEmail: 'lecturer@example.com',
        isGamificationEnabled: true,
        arePointsAwarded: true,
        pointsMultiplier: 2,
        totalBasePoints: 5,
        totalCorrectnessPoints: 20,
        totalBonusPoints: 6,
        totalPoints: 31,
        isAssessmentEnabled: false,
        isPinProtected: true,
        pinCode: '123456',
        stacks: [
          {
            id: 7,
            numOfParticipants: 5,
            timeLimit: 30,
            stackPoints: 31,
            elements: [
              {
                basePoints: 5,
                correctnessPoints: 20,
                bonusPoints: 6,
                totalPoints: 31,
                hasSampleSolution: true,
                isEditor: true,
                isDeleted: false,
                instance: {
                  id: 11,
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementType: ElementType.SC,
                  options: {
                    basePoints: true,
                    pointsMultiplier: 2,
                  },
                  elementData: {
                    id: 'element-1-v1',
                    elementId: 1,
                    name: 'Question 1',
                    type: ElementType.SC,
                    content: 'Question text',
                    explanation: null,
                    basePoints: true,
                    pointsMultiplier: 1,
                    options: {
                      hasSampleSolution: true,
                    },
                  },
                },
              },
            ],
          },
        ],
      },
    })
  })

  test('returns outdated element instance information only for stale versions', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 11,
        elementData: {
          id: 'element-1-v1',
        },
        element: {
          version: 3,
          name: 'New Question 1',
          options: {
            hasSampleSolution: true,
          },
        },
      },
      {
        id: 12,
        elementData: {
          id: 'element-2-v3',
        },
        element: {
          version: 3,
          name: 'Question 2',
          options: {
            hasSampleSolution: false,
          },
        },
      },
    ])
    const prisma = {
      elementInstance: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.outdatedElementInstances({
        instanceIds: [11, 12],
      })
    ).resolves.toEqual({
      outdatedElementInstances: [
        {
          id: 11,
          newTitle: 'New Question 1',
          newSampleSolution: true,
        },
      ],
    })

    expect(findMany).toHaveBeenCalledWith({
      where: {
        id: { in: [11, 12] },
        element: { isDeleted: false },
      },
      include: {
        element: {
          select: {
            id: true,
            version: true,
            name: true,
            options: true,
          },
        },
      },
    })
  })

  test('checks whether the user can access an element with the template element name', async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: 1 })
    const prisma = {
      element: {
        findFirst,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.checkTemplateElementExists({
        name: 'Template question',
      })
    ).resolves.toEqual({ checkTemplateElementExists: true })

    expect(findFirst).toHaveBeenCalledWith({
      where: {
        name: 'Template question',
        permissions: { some: { userId: user.id } },
      },
      select: { id: true },
    })
  })

  test('returns false when no accessible template element name exists', async () => {
    const findFirst = vi.fn().mockResolvedValue(null)
    const prisma = {
      element: {
        findFirst,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.checkTemplateElementExists({
        name: 'Missing question',
      })
    ).resolves.toEqual({ checkTemplateElementExists: false })
  })

  test('returns matching user elements for template replacement', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 1,
        name: 'Matching SC',
        content: 'Matching question',
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: false,
        },
      },
      {
        id: 2,
        name: 'Wrong feedback setting',
        content: 'Wrong question',
        options: {
          hasSampleSolution: true,
          hasAnswerFeedbacks: true,
        },
      },
      {
        id: 3,
        name: 'Wrong sample setting',
        content: 'Wrong sample',
        options: {
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
        },
      },
    ])
    const prisma = {
      element: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.matchingUserElementsTemplate({
        elementType: ElementType.SC,
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
      })
    ).resolves.toEqual({
      matchingUserElementsTemplate: [
        {
          id: 1,
          name: 'Matching SC',
          content: 'Matching question',
        },
      ],
    })

    expect(findMany).toHaveBeenCalledWith({
      where: {
        type: ElementType.SC,
        isDeleted: false,
        permissions: {
          some: {
            userId: user.id,
          },
        },
      },
      select: {
        id: true,
        name: true,
        content: true,
        options: true,
      },
    })
  })

  test('ignores template replacement option filters for unsupported element types', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: 4,
        name: 'Flashcard',
        content: 'Flashcard content',
        options: {},
      },
    ])
    const prisma = {
      element: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.matchingUserElementsTemplate({
        elementType: ElementType.FLASHCARD,
        hasSampleSolution: true,
        hasAnswerFeedbacks: true,
      })
    ).resolves.toEqual({
      matchingUserElementsTemplate: [
        {
          id: 4,
          name: 'Flashcard',
          content: 'Flashcard content',
        },
      ],
    })
  })

  test('returns template preview answer collection entries from accessible templates', async () => {
    const userFindUnique = vi.fn().mockResolvedValue({ objects: [] })
    const templateFindUnique = vi
      .fn()
      .mockResolvedValueOnce({
        liveQuiz: {
          ownerId: 'other-user',
          permissions: [{ id: 7 }],
          catalogAssignments: [],
        },
        practiceQuiz: null,
        microLearning: null,
        groupActivity: null,
      })
      .mockResolvedValueOnce({
        answerCollections: [
          {
            id: 21,
            name: 'Preview answers',
            entries: [
              { id: 3, value: 'A' },
              { id: 4, value: 'B' },
            ],
          },
          {
            id: 22,
            name: 'Other answers',
            entries: [{ id: 5, value: 'C' }],
          },
        ],
      })
    const prisma = {
      user: {
        findUnique: userFindUnique,
      },
      activityTemplate: {
        findUnique: templateFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.templatePreviewAnswerCollectionEntries({
        templateId: 'template-1',
        answerCollectionId: 21,
      })
    ).resolves.toEqual({
      templatePreviewAnswerCollectionEntries: [
        { id: 3, value: 'A' },
        { id: 4, value: 'B' },
      ],
    })

    expect(userFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: user.id },
        include: expect.objectContaining({
          objects: expect.objectContaining({
            where: { answerCollectionId: { not: null } },
          }),
        }),
      })
    )
    expect(templateFindUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'template-1' },
        include: expect.objectContaining({
          liveQuiz: expect.any(Object),
          practiceQuiz: expect.any(Object),
          microLearning: expect.any(Object),
          groupActivity: expect.any(Object),
        }),
      })
    )
    expect(templateFindUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 'template-1' },
      include: {
        answerCollections: {
          include: {
            entries: {
              orderBy: {
                value: 'asc',
              },
            },
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    })
  })

  test('returns template information for writable live quiz templates', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      name: 'Template live quiz',
      templateInfo: {
        id: 'template-1',
        description: 'Template description',
        instructions: 'Template instructions',
      },
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.templateInformation({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({
      templateInformation: {
        templateId: 'template-1',
        name: 'Template live quiz',
        description: 'Template description',
        instructions: 'Template instructions',
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(liveQuizFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'live-quiz-1',
        status: PublicationStatus.TEMPLATE,
      },
      select: {
        name: true,
        templateInfo: {
          select: {
            id: true,
            description: true,
            instructions: true,
          },
        },
      },
    })
  })

  test('returns null template information when write permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.templateInformation({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ templateInformation: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('edits writable live quiz template metadata and activity name', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const templateUpdate = vi.fn().mockResolvedValue({ id: 'template-1' })
    const liveQuizUpdate = vi.fn().mockResolvedValue({ id: 'live-quiz-1' })
    const transaction = vi.fn().mockImplementation(async (callback) =>
      callback({
        activityTemplate: {
          update: templateUpdate,
        },
        liveQuiz: {
          update: liveQuizUpdate,
        },
      })
    )
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.editTemplate({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        templateId: 'template-1',
        name: 'Updated template name',
        description: 'Updated template description',
        instructions: 'Updated template instructions',
      })
    ).resolves.toEqual({ editActivityTemplate: true })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(templateUpdate).toHaveBeenCalledWith({
      where: {
        id: 'template-1',
        liveQuizId: 'live-quiz-1',
      },
      data: {
        description: 'Updated template description',
        instructions: 'Updated template instructions',
      },
    })
    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: {
        id: 'live-quiz-1',
        status: PublicationStatus.TEMPLATE,
      },
      data: {
        name: 'Updated template name',
      },
    })
  })

  test('does not edit template metadata when write permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.editTemplate({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        templateId: 'template-1',
        name: 'Updated template name',
        description: 'Updated template description',
        instructions: 'Updated template instructions',
      })
    ).resolves.toEqual({ editActivityTemplate: false })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(transaction).not.toHaveBeenCalled()
  })

  test('returns false when template edit transaction fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const transaction = vi.fn().mockRejectedValue(new Error('update failed'))
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.editTemplate({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        templateId: 'template-1',
        name: 'Updated template name',
        description: 'Updated template description',
        instructions: 'Updated template instructions',
      })
    ).resolves.toEqual({ editActivityTemplate: false })

    expect(transaction).toHaveBeenCalledTimes(1)
    expect(consoleError).toHaveBeenCalledWith(
      'Error editing activity template:',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  test('returns null for inaccessible activity templates', async () => {
    const templateFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      activityTemplate: {
        findUnique: templateFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.template({ templateId: 'template-1' })
    ).resolves.toEqual({
      activityTemplate: null,
    })

    expect(templateFindUnique).toHaveBeenCalledTimes(1)
    expect(templateFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'template-1' },
        include: expect.objectContaining({
          liveQuiz: expect.any(Object),
          practiceQuiz: expect.any(Object),
          microLearning: expect.any(Object),
          groupActivity: expect.any(Object),
        }),
      })
    )
  })

  test('returns an accessible live quiz activity template with preview element data', async () => {
    const createdAt = new Date('2026-05-01T10:00:00.000Z')
    const elementData = {
      id: 'element-data-1',
      elementId: 17,
      name: 'Template choice',
      type: ElementType.SC,
      content: 'Choose one option',
      explanation: null,
      basePoints: true,
      pointsMultiplier: 1,
      options: {
        hasSampleSolution: true,
        hasAnswerFeedbacks: false,
        displayMode: 'LIST',
        choices: [
          {
            ix: 0,
            correct: true,
            feedback: 'Correct',
            value: 'A',
          },
        ],
      },
    }
    const templateFindUnique = vi
      .fn()
      .mockResolvedValueOnce({
        liveQuiz: {
          ownerId: user.id,
          permissions: [],
          catalogAssignments: [],
        },
        practiceQuiz: null,
        microLearning: null,
        groupActivity: null,
      })
      .mockResolvedValueOnce({
        id: 'template-1',
        description: 'Template description',
        instructions: 'Template instructions',
        liveQuiz: {
          id: 'live-quiz-1',
          status: PublicationStatus.DRAFT,
          isLiveQAEnabled: true,
          isConfusionFeedbackEnabled: false,
          isModerationEnabled: true,
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
          accessMode: 'PUBLIC',
          name: 'Template live quiz',
          displayName: 'Template Live Quiz',
          description: null,
          pointsMultiplier: 2,
          defaultPoints: 10,
          defaultCorrectPoints: 5,
          maxBonusPoints: 45,
          timeToZeroBonus: 20,
          createdAt,
          blocks: [
            {
              id: 3,
              order: 1,
              status: 'SCHEDULED',
              timeLimit: null,
              elements: [
                {
                  id: 11,
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementType: ElementType.SC,
                  elementData,
                },
              ],
            },
          ],
        },
        practiceQuiz: null,
        microLearning: null,
        groupActivity: null,
      })
    const prisma = {
      activityTemplate: {
        findUnique: templateFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.template({ templateId: 'template-1' })
    ).resolves.toEqual({
      activityTemplate: {
        __typename: 'ActivityTemplate',
        id: 'template-1',
        activityType: ActivityType.LIVE_QUIZ,
        description: 'Template description',
        instructions: 'Template instructions',
        liveQuiz: {
          __typename: 'LiveQuiz',
          id: 'live-quiz-1',
          status: PublicationStatus.DRAFT,
          isLiveQAEnabled: true,
          isConfusionFeedbackEnabled: false,
          isModerationEnabled: true,
          isGamificationEnabled: false,
          isAssessmentEnabled: false,
          accessMode: 'PUBLIC',
          name: 'Template live quiz',
          displayName: 'Template Live Quiz',
          description: null,
          pointsMultiplier: 2,
          defaultPoints: 10,
          defaultCorrectPoints: 5,
          maxBonusPoints: 45,
          timeToZeroBonus: 20,
          createdAt,
          blocks: [
            {
              __typename: 'ElementBlock',
              id: 3,
              order: 1,
              status: 'SCHEDULED',
              timeLimit: null,
              elements: [
                {
                  __typename: 'ElementInstance',
                  id: 11,
                  type: ElementInstanceType.LIVE_QUIZ,
                  elementType: ElementType.SC,
                  elementData: {
                    __typename: 'ChoicesElementData',
                    id: 'element-data-1',
                    elementId: 17,
                    name: 'Template choice',
                    type: ElementType.SC,
                    content: 'Choose one option',
                    explanation: null,
                    basePoints: true,
                    pointsMultiplier: 1,
                    options: {
                      __typename: 'ChoiceElementOptions',
                      hasSampleSolution: true,
                      hasAnswerFeedbacks: false,
                      displayMode: 'LIST',
                      choices: [
                        {
                          ix: 0,
                          correct: true,
                          feedback: 'Correct',
                          value: 'A',
                        },
                      ],
                    },
                  },
                },
              ],
            },
          ],
        },
        practiceQuiz: null,
        microLearning: null,
        groupActivity: null,
      },
    })

    expect(templateFindUnique).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: 'template-1' },
        include: expect.objectContaining({
          liveQuiz: expect.any(Object),
          practiceQuiz: expect.any(Object),
          microLearning: expect.any(Object),
          groupActivity: expect.any(Object),
        }),
      })
    )
    expect(templateFindUnique).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: 'template-1' },
        include: expect.objectContaining({
          liveQuiz: expect.objectContaining({
            include: expect.objectContaining({
              blocks: expect.objectContaining({
                orderBy: { order: 'asc' },
              }),
            }),
          }),
        }),
      })
    )
  })

  test('sets standalone live quiz review status for activity admins', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'live-quiz-1' })
    const prisma = {
      liveQuiz: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.setReviewStatus({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        isReviewed: true,
      })
    ).resolves.toEqual({ reviewStatus: ReviewStatus.REVIEWED })

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'live-quiz-1',
        OR: [
          {
            courseId: null,
            permissions: {
              some: {
                userId: user.id,
                permissionLevel: {
                  in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                },
              },
            },
          },
          {
            courseId: { not: null },
            course: {
              permissions: {
                some: {
                  userId: user.id,
                  permissionLevel: {
                    in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                  },
                },
              },
            },
          },
        ],
      },
      data: { reviewStatus: ReviewStatus.REVIEWED },
      select: { id: true },
    })
  })

  test('returns null when setting activity review status fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const update = vi.fn().mockRejectedValue(new Error('not found'))
    const prisma = {
      practiceQuiz: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.setReviewStatus({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
        isReviewed: false,
      })
    ).resolves.toEqual({ reviewStatus: null })

    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'practice-quiz-1',
        course: {
          permissions: {
            some: {
              userId: user.id,
              permissionLevel: {
                in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
              },
            },
          },
        },
      },
      data: { reviewStatus: ReviewStatus.INCOMPLETE },
      select: { id: true },
    })
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  test('returns zero for empty activity batch operations', async () => {
    const findMany = vi.fn()
    const prisma = {
      liveQuiz: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.applyBatchOperations({
        activityIds: [],
        multiplier: 2,
      })
    ).resolves.toEqual({ appliedCount: 0 })

    expect(findMany).not.toHaveBeenCalled()
  })

  test('returns zero when activity batch operation course is inaccessible', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue(null)
    const liveQuizFindMany = vi.fn()
    const prisma = {
      course: {
        findUnique: courseFindUnique,
      },
      liveQuiz: {
        findMany: liveQuizFindMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.applyBatchOperations({
        activityIds: ['live-quiz-1'],
        courseId: 'course-1',
        multiplier: 2,
      })
    ).resolves.toEqual({ appliedCount: 0 })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'course-1',
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
      },
    })
    expect(liveQuizFindMany).not.toHaveBeenCalled()
  })

  test('applies activity batch operations to eligible live quizzes', async () => {
    const liveQuizFindMany = vi.fn().mockResolvedValue([
      {
        id: 'live-quiz-1',
        courseId: null,
        reviewStatus: ReviewStatus.REVIEWED,
        blocks: [
          {
            elements: [
              {
                id: 11,
                elementData: { pointsMultiplier: 4 },
                options: { pointsMultiplier: 1 },
              },
            ],
          },
        ],
      },
    ])
    const practiceQuizFindMany = vi.fn().mockResolvedValue([])
    const microLearningFindMany = vi.fn().mockResolvedValue([])
    const groupActivityFindMany = vi.fn().mockResolvedValue([])
    const liveQuizUpdate = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      pointsMultiplier: 3,
    })
    const elementInstanceUpdate = vi.fn().mockResolvedValue({ id: 11 })
    const transaction = vi.fn(async (callback) =>
      callback({
        liveQuiz: {
          update: liveQuizUpdate,
        },
        elementInstance: {
          update: elementInstanceUpdate,
        },
      })
    )
    const prisma = {
      liveQuiz: {
        findMany: liveQuizFindMany,
      },
      practiceQuiz: {
        findMany: practiceQuizFindMany,
      },
      microLearning: {
        findMany: microLearningFindMany,
      },
      groupActivity: {
        findMany: groupActivityFindMany,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.applyBatchOperations({
        activityIds: ['live-quiz-1'],
        multiplier: 3,
      })
    ).resolves.toEqual({ appliedCount: 1 })

    expect(liveQuizFindMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['live-quiz-1'] },
        permissions: {
          some: {
            userId: user.id,
            permissionLevel: {
              in: [
                PermissionLevel.WRITE,
                PermissionLevel.ADMIN,
                PermissionLevel.OWNER,
              ],
            },
          },
        },
        status: {
          in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
        },
        AND: [
          {
            OR: [
              { isGamificationEnabled: true },
              { isAssessmentEnabled: true },
            ],
          },
          {
            OR: [
              { courseId: null },
              { isAssessmentEnabled: false },
              {
                isAssessmentEnabled: true,
                course: {
                  permissions: {
                    some: {
                      userId: user.id,
                      permissionLevel: {
                        in: [PermissionLevel.OWNER, PermissionLevel.ADMIN],
                      },
                    },
                  },
                },
              },
            ],
          },
        ],
      },
      include: {
        blocks: {
          include: {
            elements: true,
          },
        },
      },
    })
    expect(practiceQuizFindMany).toHaveBeenCalled()
    expect(microLearningFindMany).toHaveBeenCalled()
    expect(groupActivityFindMany).toHaveBeenCalled()
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      data: expect.objectContaining({
        pointsMultiplier: { set: 3 },
        reviewStatus: { set: ReviewStatus.MODIFIED_AFTER_REVIEW },
      }),
    })
    expect(elementInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        options: {
          pointsMultiplier: 12,
        },
      },
    })
  })

  test.each([
    {
      activityType: ActivityType.LIVE_QUIZ,
      modelName: 'liveQuiz',
      permissionKey: 'liveQuizId',
      typename: 'LiveQuiz',
    },
    {
      activityType: ActivityType.PRACTICE_QUIZ,
      modelName: 'practiceQuiz',
      permissionKey: 'practiceQuizId',
      typename: 'PracticeQuiz',
    },
    {
      activityType: ActivityType.MICRO_LEARNING,
      modelName: 'microLearning',
      permissionKey: 'microLearningId',
      typename: 'MicroLearning',
    },
    {
      activityType: ActivityType.GROUP_ACTIVITY,
      modelName: 'groupActivity',
      permissionKey: 'groupActivityId',
      typename: 'GroupActivity',
    },
  ])(
    'changes $activityType activity names through the activity router',
    async ({ activityType, modelName, permissionKey, typename }) => {
      const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
      const findUnique = vi.fn().mockResolvedValue({
        name: 'Old name',
        displayName: 'Old display name',
        reviewStatus: ReviewStatus.REVIEWED,
      })
      const update = vi.fn().mockResolvedValue({ id: 'activity-1' })
      const emit = vi.fn()
      const prisma = {
        derivedPermission: {
          findFirst: permissionFindFirst,
        },
        [modelName]: {
          findUnique,
          update,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        createContext(prisma, {
          emitter: { emit } as unknown as TRPCContext['emitter'],
        })
      )

      await expect(
        caller.activity.changeName({
          activityId: 'activity-1',
          activityType,
          name: 'New name',
          displayName: 'New display name',
        })
      ).resolves.toEqual({ changeActivityName: true })

      expect(permissionFindFirst).toHaveBeenCalledWith({
        where: {
          [permissionKey]: 'activity-1',
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
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        select: { name: true, displayName: true, reviewStatus: true },
      })
      expect(update).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        data: {
          name: 'New name',
          displayName: 'New display name',
          reviewStatus: ReviewStatus.MODIFIED_AFTER_REVIEW,
        },
      })
      expect(emit).toHaveBeenCalledWith('invalidate', {
        typename,
        id: 'activity-1',
      })
    }
  )

  test('returns null when activity name change write permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.changeName({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        name: 'New name',
        displayName: 'New display name',
      })
    ).resolves.toEqual({ changeActivityName: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('skips activity name updates when values are unchanged', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      name: 'Existing name',
      displayName: 'Existing display name',
      reviewStatus: ReviewStatus.REVIEWED,
    })
    const liveQuizUpdate = vi.fn()
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
        update: liveQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        emitter: { emit } as unknown as TRPCContext['emitter'],
      })
    )

    await expect(
      caller.activity.changeName({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        name: 'Existing name',
        displayName: 'Existing display name',
      })
    ).resolves.toEqual({ changeActivityName: true })

    expect(liveQuizUpdate).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  test('returns false when activity name update fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      name: 'Old name',
      displayName: 'Old display name',
      reviewStatus: ReviewStatus.INCOMPLETE,
    })
    const liveQuizUpdate = vi.fn().mockRejectedValue(new Error('update failed'))
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
        update: liveQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.changeName({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        name: 'New name',
        displayName: 'New display name',
      })
    ).resolves.toEqual({ changeActivityName: false })

    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      data: {
        name: 'New name',
        displayName: 'New display name',
        reviewStatus: undefined,
      },
    })
    expect(consoleError).toHaveBeenCalledWith(
      'Error changing live quiz name:',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  test('schedules practice quiz publication through the activity router', async () => {
    const availableFrom = new Date('2099-01-01T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const practiceQuizUpdate = vi.fn().mockResolvedValue({
      id: 'practice-quiz-1',
      status: PublicationStatus.SCHEDULED,
    })
    const schedule = vi.fn().mockResolvedValue({
      metadata: { id: 'publication-task' },
    })
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        update: practiceQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        emitter: { emit } as unknown as TRPCContext['emitter'],
        tasks: {
          publishScheduledPracticeQuiz: { schedule },
        } as unknown as TRPCContext['tasks'],
      })
    )

    await expect(
      caller.activity.publish({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
        availableFrom,
      })
    ).resolves.toEqual({
      publishActivity: {
        id: 'practice-quiz-1',
        status: PublicationStatus.SCHEDULED,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        practiceQuizId: 'practice-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(schedule).toHaveBeenCalledWith(availableFrom, {
      practiceQuizId: 'practice-quiz-1',
    })
    expect(practiceQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'practice-quiz-1', isDeleted: false },
      data: {
        availableFrom,
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
      },
      select: { id: true, status: true },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'PracticeQuiz',
      id: 'practice-quiz-1',
    })
  })

  test('publishes practice quiz immediately and connects stacks to the course', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const practiceQuizUpdate = vi.fn().mockResolvedValue({
      id: 'practice-quiz-1',
      status: PublicationStatus.PUBLISHED,
      courseId: 'course-1',
      stacks: [{ id: 11 }, { id: 12 }],
    })
    const courseUpdate = vi.fn().mockResolvedValue({ id: 'course-1' })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        update: practiceQuizUpdate,
      },
      course: {
        update: courseUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.publish({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
      })
    ).resolves.toEqual({
      publishActivity: {
        id: 'practice-quiz-1',
        status: PublicationStatus.PUBLISHED,
      },
    })

    expect(practiceQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'practice-quiz-1', isDeleted: false },
      data: { status: PublicationStatus.PUBLISHED },
      select: {
        id: true,
        status: true,
        courseId: true,
        stacks: { select: { id: true } },
      },
    })
    expect(courseUpdate).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      data: {
        elementStacks: {
          connect: [{ id: 11 }, { id: 12 }],
        },
      },
    })
  })

  test.each([
    {
      activityType: ActivityType.MICRO_LEARNING,
      modelName: 'microLearning',
      permissionKey: 'microLearningId',
      typename: 'MicroLearning',
      publicationTaskName: 'publishScheduledMicroLearning',
      completionTaskName: 'endExpiredMicroLearning',
      publicationPayload: { microLearningId: 'activity-1' },
      completionPayload: { microLearningId: 'activity-1' },
    },
    {
      activityType: ActivityType.GROUP_ACTIVITY,
      modelName: 'groupActivity',
      permissionKey: 'groupActivityId',
      typename: 'GroupActivity',
      publicationTaskName: 'publishScheduledGroupActivity',
      completionTaskName: 'endExpiredGroupActivity',
      publicationPayload: { groupActivityId: 'activity-1' },
      completionPayload: { groupActivityId: 'activity-1' },
    },
  ])(
    'schedules $activityType publication and completion through the activity router',
    async ({
      activityType,
      modelName,
      permissionKey,
      typename,
      publicationTaskName,
      completionTaskName,
      publicationPayload,
      completionPayload,
    }) => {
      const scheduledStartAt = new Date('2099-01-01T10:00:00.000Z')
      const scheduledEndAt = new Date('2099-01-02T10:00:00.000Z')
      const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
      const findUnique = vi.fn().mockResolvedValue({
        id: 'activity-1',
        scheduledStartAt,
        scheduledEndAt,
      })
      const update = vi.fn().mockResolvedValue({
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
      })
      const publicationSchedule = vi.fn().mockResolvedValue({
        metadata: { id: 'publication-task' },
      })
      const completionSchedule = vi.fn().mockResolvedValue({
        metadata: { id: 'completion-task' },
      })
      const emit = vi.fn()
      const prisma = {
        derivedPermission: {
          findFirst: permissionFindFirst,
        },
        [modelName]: {
          findUnique,
          update,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        createContext(prisma, {
          emitter: { emit } as unknown as TRPCContext['emitter'],
          tasks: {
            [publicationTaskName]: { schedule: publicationSchedule },
            [completionTaskName]: { schedule: completionSchedule },
          } as unknown as TRPCContext['tasks'],
        })
      )

      await expect(
        caller.activity.publish({
          activityId: 'activity-1',
          activityType,
        })
      ).resolves.toEqual({
        publishActivity: {
          id: 'activity-1',
          status: PublicationStatus.SCHEDULED,
        },
      })

      expect(permissionFindFirst).toHaveBeenCalledWith({
        where: {
          [permissionKey]: 'activity-1',
          userId: user.id,
          permissionLevel: {
            in: [
              PermissionLevel.EXECUTE,
              PermissionLevel.WRITE,
              PermissionLevel.ADMIN,
              PermissionLevel.OWNER,
            ],
          },
        },
      })
      expect(findUnique).toHaveBeenCalledWith({
        where: {
          id: 'activity-1',
          isDeleted: false,
          status: PublicationStatus.DRAFT,
        },
        select: {
          id: true,
          scheduledStartAt: true,
          scheduledEndAt: true,
        },
      })
      expect(publicationSchedule).toHaveBeenCalledWith(
        scheduledStartAt,
        publicationPayload
      )
      expect(completionSchedule).toHaveBeenCalledWith(
        scheduledEndAt,
        completionPayload
      )
      expect(update).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        data: {
          status: PublicationStatus.SCHEDULED,
          scheduledPublicationTaskId: 'publication-task',
          scheduledCompletionTaskId: 'completion-task',
        },
        select: { id: true, status: true },
      })
      expect(emit).toHaveBeenCalledWith('invalidate', {
        typename,
        id: 'activity-1',
      })
    }
  )

  test('returns null when activity publish execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const practiceQuizUpdate = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        update: practiceQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.publish({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
      })
    ).resolves.toEqual({ publishActivity: null })

    expect(practiceQuizUpdate).not.toHaveBeenCalled()
  })

  test('schedules live quiz publication through the activity router', async () => {
    const availableFrom = new Date('2099-01-01T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const liveQuizUpdate = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      name: 'Live Quiz',
      status: PublicationStatus.SCHEDULED,
      availableFrom,
    })
    const schedule = vi.fn().mockResolvedValue({
      metadata: { id: 'publication-task' },
    })
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        update: liveQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        emitter: { emit } as unknown as TRPCContext['emitter'],
        tasks: {
          publishScheduledLiveQuiz: { schedule },
        } as unknown as TRPCContext['tasks'],
      })
    )

    await expect(
      caller.activity.scheduleLiveQuiz({
        activityId: 'live-quiz-1',
        availableFrom,
      })
    ).resolves.toEqual({
      scheduleLiveQuiz: {
        id: 'live-quiz-1',
        name: 'Live Quiz',
        status: PublicationStatus.SCHEDULED,
        availableFrom,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(schedule).toHaveBeenCalledWith(availableFrom, {
      liveQuizId: 'live-quiz-1',
    })
    expect(liveQuizUpdate).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1', isDeleted: false },
      data: {
        availableFrom,
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
      },
      select: {
        id: true,
        name: true,
        status: true,
        availableFrom: true,
      },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'live-quiz-1',
    })
  })

  test('returns null when live quiz scheduling execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const liveQuizUpdate = vi.fn()
    const schedule = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        update: liveQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        tasks: {
          publishScheduledLiveQuiz: { schedule },
        } as unknown as TRPCContext['tasks'],
      })
    )

    await expect(
      caller.activity.scheduleLiveQuiz({
        activityId: 'live-quiz-1',
        availableFrom: new Date('2099-01-01T10:00:00.000Z'),
      })
    ).resolves.toEqual({ scheduleLiveQuiz: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(schedule).not.toHaveBeenCalled()
    expect(liveQuizUpdate).not.toHaveBeenCalled()
  })

  test('opens a scheduled group activity through the activity router', async () => {
    const scheduledEndAt = new Date('2099-01-02T10:00:00.000Z')
    const scheduledStartAt = new Date('2026-06-19T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      scheduledEndAt,
      scheduledPublicationTaskId: 'publication-task',
      scheduledCompletionTaskId: null,
    })
    const update = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      status: PublicationStatus.PUBLISHED,
      scheduledStartAt,
    })
    const scheduledDelete = vi.fn().mockResolvedValue(undefined)
    const completionSchedule = vi.fn().mockResolvedValue({
      metadata: { id: 'completion-task' },
    })
    const publish = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique,
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        hatchet: {
          scheduled: {
            delete: scheduledDelete,
          },
        } as unknown as TRPCContext['hatchet'],
        pubSub: { publish } as unknown as TRPCContext['pubSub'],
        tasks: {
          endExpiredGroupActivity: { schedule: completionSchedule },
        } as unknown as TRPCContext['tasks'],
      })
    )

    await expect(
      caller.activity.openGroupActivity({
        activityId: 'group-activity-1',
      })
    ).resolves.toEqual({
      openGroupActivity: {
        id: 'group-activity-1',
        status: PublicationStatus.PUBLISHED,
        scheduledStartAt,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'group-activity-1',
        status: PublicationStatus.SCHEDULED,
      },
    })
    expect(scheduledDelete).toHaveBeenCalledWith('publication-task')
    expect(completionSchedule).toHaveBeenCalledWith(scheduledEndAt, {
      groupActivityId: 'group-activity-1',
    })
    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'group-activity-1',
        status: PublicationStatus.SCHEDULED,
      },
      data: {
        status: PublicationStatus.PUBLISHED,
        scheduledStartAt: expect.any(Date),
        scheduledPublicationTaskId: null,
        scheduledCompletionTaskId: 'completion-task',
      },
    })
    expect(publish).toHaveBeenCalledWith('groupActivityStarted', {
      id: 'group-activity-1',
      status: PublicationStatus.PUBLISHED,
      scheduledStartAt,
    })
  })

  test('returns null when group activity open execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const findUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.openGroupActivity({
        activityId: 'group-activity-1',
      })
    ).resolves.toEqual({ openGroupActivity: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(findUnique).not.toHaveBeenCalled()
  })

  test('returns a live quiz summary through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      _count: {
        feedbacks: 2,
        confusionFeedbacks: 1,
        leaderboard: 3,
        temporaryLeaderboard: 4,
      },
      blocks: [
        {
          elements: [
            { results: { total: 5 }, anonymousResults: { total: 2 } },
            { results: { total: 3 }, anonymousResults: { total: 1 } },
          ],
        },
      ],
      activeBlock: null,
      isAssessmentEnabled: false,
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.liveQuizSummary({
        activityId: 'live-quiz-1',
      })
    ).resolves.toEqual({
      liveQuizSummary: {
        numOfResponses: 11,
        numOfFeedbacks: 2,
        numOfConfusionFeedbacks: 1,
        numOfLeaderboardEntries: 7,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      include: {
        _count: {
          select: {
            feedbacks: true,
            confusionFeedbacks: true,
            leaderboard: true,
            temporaryLeaderboard: true,
          },
        },
        blocks: { include: { elements: true } },
        activeBlock: { include: { elements: true } },
      },
    })
  })

  test('returns a live quiz authoring read through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      name: 'Live Quiz',
      displayName: 'Displayed Live Quiz',
      description: 'Description',
      pointsMultiplier: 2,
      defaultPoints: 10,
      defaultCorrectPoints: 5,
      maxBonusPoints: 20,
      timeToZeroBonus: 30,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      pinCode: '123456',
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: true,
      isModerationEnabled: false,
      course: { id: 'course-1' },
      blocks: [
        {
          id: 1,
          order: 0,
          status: 'SCHEDULED',
          timeLimit: 60,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.SC,
              elementData: {
                id: 'element-1-v1',
                elementId: 1,
                name: 'Question',
                type: ElementType.SC,
                options: { hasSampleSolution: true },
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst: permissionFindFirst },
      liveQuiz: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.authoringLiveQuiz({ activityId: 'live-quiz-1' })
    ).resolves.toEqual({
      liveQuiz: {
        id: 'live-quiz-1',
        name: 'Live Quiz',
        displayName: 'Displayed Live Quiz',
        description: 'Description',
        pointsMultiplier: 2,
        defaultPoints: 10,
        defaultCorrectPoints: 5,
        maxBonusPoints: 20,
        timeToZeroBonus: 30,
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        pinCode: '123456',
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: true,
        isModerationEnabled: false,
        course: { id: 'course-1' },
        blocks: [
          {
            id: 1,
            order: 0,
            status: 'SCHEDULED',
            timeLimit: 60,
            elements: [
              {
                id: 11,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.SC,
                elementData: {
                  id: 'element-1-v1',
                  elementId: 1,
                  name: 'Question',
                  type: ElementType.SC,
                  options: { hasSampleSolution: true },
                },
              },
            ],
          },
        ],
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      include: {
        blocks: {
          include: { elements: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        course: true,
      },
    })
  })

  test('returns practice quiz and microlearning authoring reads through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const practiceFindUnique = vi.fn().mockResolvedValue({
      id: 'practice-quiz-1',
      status: PublicationStatus.DRAFT,
      name: 'Practice Quiz',
      displayName: 'Displayed Practice Quiz',
      description: null,
      pointsMultiplier: 1,
      resetTimeDays: 6,
      availableFrom: null,
      orderType: 'SEQUENTIAL',
      course: { id: 'course-1', displayName: 'Course', color: '#fff' },
      stacks: [
        {
          id: 1,
          type: 'PRACTICE_QUIZ',
          displayName: 'Stack',
          description: null,
          order: 0,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.PRACTICE_QUIZ,
              elementType: ElementType.SC,
              elementData: { id: 'element-1-v1', name: 'Question' },
            },
          ],
        },
      ],
    })
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-01-02T00:00:00.000Z')
    const microFindUnique = vi.fn().mockResolvedValue({
      id: 'microlearning-1',
      status: PublicationStatus.SCHEDULED,
      name: 'Microlearning',
      displayName: 'Displayed Microlearning',
      description: 'Description',
      pointsMultiplier: 2,
      scheduledStartAt: startDate,
      scheduledEndAt: endDate,
      course: { id: 'course-1', displayName: 'Course', color: '#fff' },
      stacks: [],
    })
    const prisma = {
      derivedPermission: { findFirst: permissionFindFirst },
      practiceQuiz: { findUnique: practiceFindUnique },
      microLearning: { findUnique: microFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.authoringPracticeQuiz({ activityId: 'practice-quiz-1' })
    ).resolves.toMatchObject({
      practiceQuiz: {
        id: 'practice-quiz-1',
        numOfStacks: 1,
        stacks: [
          {
            id: 1,
            order: 0,
            elements: [{ id: 11, elementData: { id: 'element-1-v1' } }],
          },
        ],
      },
    })
    await expect(
      caller.activity.authoringMicroLearning({ activityId: 'microlearning-1' })
    ).resolves.toMatchObject({
      microLearning: {
        id: 'microlearning-1',
        scheduledStartAt: startDate,
        scheduledEndAt: endDate,
        stacks: [],
      },
    })
  })

  test('returns null when editing a practice quiz without write permission', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const prisma = {
      derivedPermission: { findFirst: permissionFindFirst },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.editPracticeQuiz({
        id: 'practice-quiz-1',
        name: 'Practice Quiz',
        displayName: 'Displayed Practice Quiz',
        description: null,
        stacks: [],
        courseId: 'course-1',
        multiplier: 1,
        order: ElementOrderType.SEQUENTIAL,
        resetTimeDays: 6,
      })
    ).resolves.toEqual({ editPracticeQuiz: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        practiceQuizId: 'practice-quiz-1',
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
  })

  test('maps missing target course to a not-found error when creating a practice quiz', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      course: { findUnique: courseFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createPracticeQuiz({
        name: 'Practice Quiz',
        displayName: 'Displayed Practice Quiz',
        description: null,
        stacks: [],
        courseId: 'missing-course',
        multiplier: 1,
        order: ElementOrderType.SPACED_REPETITION,
        resetTimeDays: 6,
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Course not found',
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'missing-course' },
      select: { isGamificationEnabled: true, isAssessmentEnabled: true },
    })
  })

  test('returns null when editing a microlearning without write permission', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const prisma = {
      derivedPermission: { findFirst: permissionFindFirst },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.editMicroLearning({
        id: 'microlearning-1',
        name: 'Microlearning',
        displayName: 'Displayed Microlearning',
        description: null,
        stacks: [],
        courseId: 'course-1',
        multiplier: 1,
        startDate: new Date('2026-07-01T10:00:00.000Z'),
        endDate: new Date('2026-07-02T10:00:00.000Z'),
      })
    ).resolves.toEqual({ editMicroLearning: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        microLearningId: 'microlearning-1',
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
  })

  test('maps missing target course to a not-found error when creating a microlearning', async () => {
    const courseFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      course: { findUnique: courseFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.createMicroLearning({
        name: 'Microlearning',
        displayName: 'Displayed Microlearning',
        description: null,
        stacks: [],
        courseId: 'missing-course',
        multiplier: 1,
        startDate: new Date('2026-07-01T10:00:00.000Z'),
        endDate: new Date('2026-07-02T10:00:00.000Z'),
      })
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'Course not found',
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'missing-course' },
      select: { isGamificationEnabled: true, isAssessmentEnabled: true },
    })
  })

  test('returns group activity authoring reads without solution fields', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      name: 'Group Activity',
      displayName: 'Displayed Group Activity',
      description: null,
      pointsMultiplier: 1,
      scheduledStartAt: new Date('2026-01-01T00:00:00.000Z'),
      scheduledEndAt: new Date('2026-01-02T00:00:00.000Z'),
      course: { id: 'course-1', displayName: 'Course' },
      clues: [
        {
          id: 1,
          type: 'STRING',
          name: 'clue',
          displayName: 'Clue',
          value: 'value',
          unit: null,
        },
      ],
      stacks: [
        {
          id: 1,
          type: 'GROUP_ACTIVITY',
          displayName: 'Stack',
          description: null,
          order: 0,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.GROUP_ACTIVITY,
              elementType: ElementType.SC,
              elementData: {
                id: 'element-1-v1',
                elementId: 1,
                name: 'Question',
                type: ElementType.SC,
                options: {
                  hasSampleSolution: true,
                  choices: [
                    { ix: 0, value: 'A', correct: true, feedback: 'Good' },
                  ],
                },
              },
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst: permissionFindFirst },
      groupActivity: { findUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.authoringGroupActivity({
        activityId: 'group-activity-1',
      })
    ).resolves.toEqual({
      groupActivity: {
        id: 'group-activity-1',
        name: 'Group Activity',
        displayName: 'Displayed Group Activity',
        description: null,
        pointsMultiplier: 1,
        scheduledStartAt: new Date('2026-01-01T00:00:00.000Z'),
        scheduledEndAt: new Date('2026-01-02T00:00:00.000Z'),
        course: { id: 'course-1', displayName: 'Course' },
        clues: [
          {
            id: 1,
            type: 'STRING',
            name: 'clue',
            displayName: 'Clue',
            value: 'value',
            unit: null,
          },
        ],
        stacks: [
          {
            id: 1,
            displayName: 'Stack',
            description: null,
            elements: [
              {
                id: 11,
                type: ElementInstanceType.GROUP_ACTIVITY,
                elementType: ElementType.SC,
                elementData: {
                  id: 'element-1-v1',
                  elementId: 1,
                  name: 'Question',
                  type: ElementType.SC,
                  options: {
                    hasSampleSolution: true,
                    choices: [{ ix: 0, value: 'A' }],
                  },
                },
              },
            ],
          },
        ],
      },
    })
  })

  test('returns a microlearning summary through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      stacks: [
        {
          elements: [
            { results: { total: 3 }, anonymousResults: { total: 1 } },
            { results: { total: 2 }, anonymousResults: { total: 0 } },
          ],
        },
        {
          elements: [{ results: { total: 5 }, anonymousResults: { total: 4 } }],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      microLearning: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.microLearningSummary({
        activityId: 'microlearning-1',
      })
    ).resolves.toEqual({
      microLearningSummary: {
        numOfResponses: 10,
        numOfAnonymousResponses: 5,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        microLearningId: 'microlearning-1',
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'microlearning-1' },
      select: {
        stacks: {
          select: {
            elements: {
              select: {
                results: true,
                anonymousResults: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns a practice quiz summary through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      stacks: [
        {
          elements: [
            { results: { total: 7 }, anonymousResults: { total: 2 } },
            { results: { total: 3 }, anonymousResults: { total: 1 } },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.practiceQuizSummary({
        activityId: 'practice-quiz-1',
      })
    ).resolves.toEqual({
      practiceQuizSummary: {
        numOfResponses: 10,
        numOfAnonymousResponses: 3,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        practiceQuizId: 'practice-quiz-1',
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'practice-quiz-1' },
      select: {
        stacks: {
          select: {
            elements: {
              select: {
                results: true,
                anonymousResults: true,
              },
            },
          },
        },
      },
    })
  })

  test('returns a group activity summary through the activity router', async () => {
    const submittedAt = new Date('2026-06-19T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      activityInstances: [
        { decisionsSubmittedAt: null },
        { decisionsSubmittedAt: submittedAt },
        { decisionsSubmittedAt: null },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.groupActivitySummary({
        activityId: 'group-activity-1',
      })
    ).resolves.toEqual({
      groupActivitySummary: {
        numOfStartedInstances: 2,
        numOfSubmissions: 1,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
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
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'group-activity-1' },
      select: {
        activityInstances: {
          select: {
            decisionsSubmittedAt: true,
          },
        },
      },
    })
  })

  test('returns null for group activity summary when read permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const findUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.groupActivitySummary({
        activityId: 'group-activity-1',
      })
    ).resolves.toEqual({ groupActivitySummary: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
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
    expect(findUnique).not.toHaveBeenCalled()
  })

  test('ends a published microlearning through the activity router', async () => {
    const scheduledEndAt = new Date('2026-06-19T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const update = vi.fn().mockResolvedValue({
      id: 'microlearning-1',
      displayName: 'Microlearning',
      status: PublicationStatus.ENDED,
      scheduledStartAt: new Date('2026-06-19T09:00:00.000Z'),
      scheduledEndAt,
      scheduledCompletionTaskId: 'completion-task',
    })
    const scheduledDelete = vi.fn().mockResolvedValue(undefined)
    const publish = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      microLearning: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        hatchet: {
          scheduled: {
            delete: scheduledDelete,
          },
        } as unknown as TRPCContext['hatchet'],
        pubSub: { publish } as unknown as TRPCContext['pubSub'],
      })
    )

    await expect(
      caller.activity.end({
        activityId: 'microlearning-1',
        activityType: ActivityType.MICRO_LEARNING,
      })
    ).resolves.toEqual({
      endActivity: {
        id: 'microlearning-1',
        status: PublicationStatus.ENDED,
        scheduledEndAt,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        microLearningId: 'microlearning-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(update).toHaveBeenCalledWith({
      where: {
        id: 'microlearning-1',
        status: PublicationStatus.PUBLISHED,
        isDeleted: false,
      },
      data: {
        status: PublicationStatus.ENDED,
        scheduledEndAt: expect.any(Date),
      },
    })
    expect(scheduledDelete).toHaveBeenCalledWith('completion-task')
    expect(publish).toHaveBeenCalledWith('microLearningEnded', {
      id: 'microlearning-1',
      displayName: 'Microlearning',
      status: PublicationStatus.ENDED,
      scheduledStartAt: new Date('2026-06-19T09:00:00.000Z'),
      scheduledEndAt,
      scheduledCompletionTaskId: 'completion-task',
    })
  })

  test('ends a published group activity through the activity router', async () => {
    const scheduledEndAt = new Date('2026-06-19T10:00:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      scheduledCompletionTaskId: 'completion-task',
    })
    const update = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      displayName: 'Group Activity',
      description: null,
      status: PublicationStatus.ENDED,
      scheduledStartAt: new Date('2026-06-19T09:00:00.000Z'),
      scheduledEndAt,
    })
    const scheduledDelete = vi.fn().mockResolvedValue(undefined)
    const publish = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique,
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        hatchet: {
          scheduled: {
            delete: scheduledDelete,
          },
        } as unknown as TRPCContext['hatchet'],
        pubSub: { publish } as unknown as TRPCContext['pubSub'],
      })
    )

    await expect(
      caller.activity.end({
        activityId: 'group-activity-1',
        activityType: ActivityType.GROUP_ACTIVITY,
      })
    ).resolves.toEqual({
      endActivity: {
        id: 'group-activity-1',
        status: PublicationStatus.ENDED,
        scheduledEndAt,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'group-activity-1',
        status: PublicationStatus.PUBLISHED,
      },
    })
    expect(scheduledDelete).toHaveBeenCalledWith('completion-task')
    expect(update).toHaveBeenCalledWith({
      where: { id: 'group-activity-1' },
      data: {
        status: PublicationStatus.ENDED,
        scheduledEndAt: expect.any(Date),
        scheduledCompletionTaskId: null,
      },
    })
    expect(publish).toHaveBeenCalledWith('groupActivityEnded', {
      id: 'group-activity-1',
      displayName: 'Group Activity',
      description: null,
      status: PublicationStatus.ENDED,
      scheduledStartAt: new Date('2026-06-19T09:00:00.000Z'),
      scheduledEndAt,
    })
    expect(publish).toHaveBeenCalledWith('singleGroupActivityEnded', {
      id: 'group-activity-1',
      displayName: 'Group Activity',
      description: null,
      status: PublicationStatus.ENDED,
      scheduledStartAt: new Date('2026-06-19T09:00:00.000Z'),
      scheduledEndAt,
    })
  })

  test('returns null when activity end execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const update = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      microLearning: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.end({
        activityId: 'microlearning-1',
        activityType: ActivityType.MICRO_LEARNING,
      })
    ).resolves.toEqual({ endActivity: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        microLearningId: 'microlearning-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(update).not.toHaveBeenCalled()
  })

  test.each([
    {
      activityType: ActivityType.MICRO_LEARNING,
      modelName: 'microLearning',
      permissionKey: 'microLearningId',
      typename: 'MicroLearning',
      completionTaskName: 'endExpiredMicroLearning',
      completionPayload: { microLearningId: 'activity-1' },
      updateWhere: {
        id: 'activity-1',
        scheduledEndAt: { gt: expect.any(Date) },
        isDeleted: false,
      },
    },
    {
      activityType: ActivityType.GROUP_ACTIVITY,
      modelName: 'groupActivity',
      permissionKey: 'groupActivityId',
      typename: 'GroupActivity',
      completionTaskName: 'endExpiredGroupActivity',
      completionPayload: { groupActivityId: 'activity-1' },
      updateWhere: {
        id: 'activity-1',
        status: {
          in: [PublicationStatus.SCHEDULED, PublicationStatus.PUBLISHED],
        },
        scheduledEndAt: { gt: expect.any(Date) },
      },
    },
  ])(
    'extends $activityType and replaces the scheduled completion task',
    async ({
      activityType,
      modelName,
      permissionKey,
      typename,
      completionTaskName,
      completionPayload,
      updateWhere,
    }) => {
      const endDate = new Date('2099-01-02T10:00:00.000Z')
      const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
      const update = vi
        .fn()
        .mockResolvedValueOnce({
          id: 'activity-1',
          scheduledCompletionTaskId: 'old-completion-task',
        })
        .mockResolvedValueOnce({
          id: 'activity-1',
          scheduledEndAt: endDate,
        })
      const scheduledDelete = vi.fn().mockResolvedValue(undefined)
      const completionSchedule = vi.fn().mockResolvedValue({
        metadata: { id: 'new-completion-task' },
      })
      const emit = vi.fn()
      const prisma = {
        derivedPermission: {
          findFirst: permissionFindFirst,
        },
        [modelName]: {
          update,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        createContext(prisma, {
          emitter: { emit } as unknown as TRPCContext['emitter'],
          hatchet: {
            scheduled: {
              delete: scheduledDelete,
            },
          } as unknown as TRPCContext['hatchet'],
          tasks: {
            [completionTaskName]: { schedule: completionSchedule },
          } as unknown as TRPCContext['tasks'],
        })
      )

      await expect(
        caller.activity.extend({
          activityId: 'activity-1',
          activityType,
          endDate,
        })
      ).resolves.toEqual({
        extendActivity: {
          id: 'activity-1',
          scheduledEndAt: endDate,
        },
      })

      expect(permissionFindFirst).toHaveBeenCalledWith({
        where: {
          [permissionKey]: 'activity-1',
          userId: user.id,
          permissionLevel: {
            in: [
              PermissionLevel.EXECUTE,
              PermissionLevel.WRITE,
              PermissionLevel.ADMIN,
              PermissionLevel.OWNER,
            ],
          },
        },
      })
      expect(update).toHaveBeenNthCalledWith(1, {
        where: updateWhere,
        data: { scheduledEndAt: endDate },
        select: { id: true, scheduledCompletionTaskId: true },
      })
      expect(scheduledDelete).toHaveBeenCalledWith('old-completion-task')
      expect(completionSchedule).toHaveBeenCalledWith(
        endDate,
        completionPayload
      )
      expect(update).toHaveBeenNthCalledWith(2, {
        where: { id: 'activity-1' },
        data: { scheduledCompletionTaskId: 'new-completion-task' },
        select: { id: true, scheduledEndAt: true },
      })
      expect(emit).toHaveBeenCalledWith('invalidate', {
        typename,
        id: 'activity-1',
      })
    }
  )

  test('returns null when activity extension execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const microLearningUpdate = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      microLearning: {
        update: microLearningUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.extend({
        activityId: 'microlearning-1',
        activityType: ActivityType.MICRO_LEARNING,
        endDate: new Date('2099-01-02T10:00:00.000Z'),
      })
    ).resolves.toEqual({ extendActivity: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        microLearningId: 'microlearning-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(microLearningUpdate).not.toHaveBeenCalled()
  })

  test('returns null when activity extension end date is in the past', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const completionSchedule = vi.fn()
    const groupActivityUpdate = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        update: groupActivityUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        tasks: {
          endExpiredGroupActivity: { schedule: completionSchedule },
        } as unknown as TRPCContext['tasks'],
      })
    )

    await expect(
      caller.activity.extend({
        activityId: 'group-activity-1',
        activityType: ActivityType.GROUP_ACTIVITY,
        endDate: new Date('2020-01-02T10:00:00.000Z'),
      })
    ).resolves.toEqual({ extendActivity: null })

    expect(groupActivityUpdate).not.toHaveBeenCalled()
    expect(completionSchedule).not.toHaveBeenCalled()
  })

  test.each([
    {
      activityType: ActivityType.LIVE_QUIZ,
      modelName: 'liveQuiz',
      permissionKey: 'liveQuizId',
      typename: 'LiveQuiz',
      findWhere: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
      },
      findSelect: {
        scheduledPublicationTaskId: true,
      },
      findResult: {
        scheduledPublicationTaskId: 'publication-task',
      },
      updateData: {
        availableFrom: null,
        status: PublicationStatus.DRAFT,
        scheduledPublicationTaskId: null,
      },
      deletedTaskIds: ['publication-task'],
    },
    {
      activityType: ActivityType.PRACTICE_QUIZ,
      modelName: 'practiceQuiz',
      permissionKey: 'practiceQuizId',
      typename: 'PracticeQuiz',
      findWhere: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
      },
      findSelect: {
        scheduledPublicationTaskId: true,
      },
      findResult: {
        scheduledPublicationTaskId: 'publication-task',
      },
      updateData: {
        availableFrom: null,
        status: PublicationStatus.DRAFT,
        scheduledPublicationTaskId: null,
      },
      deletedTaskIds: ['publication-task'],
    },
    {
      activityType: ActivityType.MICRO_LEARNING,
      modelName: 'microLearning',
      permissionKey: 'microLearningId',
      typename: 'MicroLearning',
      findWhere: {
        id: 'activity-1',
        isDeleted: false,
        status: PublicationStatus.SCHEDULED,
      },
      findSelect: {
        scheduledPublicationTaskId: true,
        scheduledCompletionTaskId: true,
      },
      findResult: {
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
      },
      updateData: {
        status: PublicationStatus.DRAFT,
        scheduledPublicationTaskId: null,
        scheduledCompletionTaskId: null,
      },
      deletedTaskIds: ['publication-task', 'completion-task'],
    },
    {
      activityType: ActivityType.GROUP_ACTIVITY,
      modelName: 'groupActivity',
      permissionKey: 'groupActivityId',
      typename: 'GroupActivity',
      findWhere: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
      },
      findSelect: {
        scheduledPublicationTaskId: true,
        scheduledCompletionTaskId: true,
      },
      findResult: {
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
      },
      updateData: {
        status: PublicationStatus.DRAFT,
        scheduledPublicationTaskId: null,
        scheduledCompletionTaskId: null,
      },
      deletedTaskIds: ['publication-task', 'completion-task'],
    },
  ])(
    'unpublishes scheduled $activityType activities through the activity router',
    async ({
      activityType,
      modelName,
      permissionKey,
      typename,
      findWhere,
      findSelect,
      findResult,
      updateData,
      deletedTaskIds,
    }) => {
      const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
      const findUnique = vi.fn().mockResolvedValue(findResult)
      const update = vi.fn().mockResolvedValue({
        id: 'activity-1',
        status: PublicationStatus.DRAFT,
      })
      const scheduledDelete = vi.fn().mockResolvedValue(undefined)
      const emit = vi.fn()
      const prisma = {
        derivedPermission: {
          findFirst: permissionFindFirst,
        },
        [modelName]: {
          findUnique,
          update,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        createContext(prisma, {
          emitter: { emit } as unknown as TRPCContext['emitter'],
          hatchet: {
            scheduled: {
              delete: scheduledDelete,
            },
          } as unknown as TRPCContext['hatchet'],
        })
      )

      await expect(
        caller.activity.unpublish({
          activityId: 'activity-1',
          activityType,
        })
      ).resolves.toEqual({
        unpublishActivity: {
          id: 'activity-1',
          status: PublicationStatus.DRAFT,
        },
      })

      expect(permissionFindFirst).toHaveBeenCalledWith({
        where: {
          [permissionKey]: 'activity-1',
          userId: user.id,
          permissionLevel: {
            in: [
              PermissionLevel.EXECUTE,
              PermissionLevel.WRITE,
              PermissionLevel.ADMIN,
              PermissionLevel.OWNER,
            ],
          },
        },
      })
      expect(findUnique).toHaveBeenCalledWith({
        where: findWhere,
        select: findSelect,
      })
      expect(update).toHaveBeenCalledWith({
        where: {
          id: 'activity-1',
          status: PublicationStatus.SCHEDULED,
        },
        data: updateData,
        select: { id: true, status: true },
      })
      expect(scheduledDelete).toHaveBeenCalledTimes(deletedTaskIds.length)
      deletedTaskIds.forEach((taskId, ix) => {
        expect(scheduledDelete).toHaveBeenNthCalledWith(ix + 1, taskId)
      })
      expect(emit).toHaveBeenCalledWith('invalidate', {
        typename,
        id: 'activity-1',
      })
    }
  )

  test('returns null when activity unpublish execute permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const practiceQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        findUnique: practiceQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.unpublish({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
      })
    ).resolves.toEqual({ unpublishActivity: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        practiceQuizId: 'practice-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(practiceQuizFindUnique).not.toHaveBeenCalled()
  })

  test('hard deletes scheduled live quizzes through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      status: PublicationStatus.SCHEDULED,
      isAssessmentEnabled: false,
      blocks: [],
      course: null,
    })
    const deleteLiveQuiz = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      status: PublicationStatus.SCHEDULED,
      scheduledPublicationTaskId: 'publication-task',
    })
    const transaction = vi.fn().mockImplementation(async (callback) =>
      callback({
        liveQuiz: { delete: deleteLiveQuiz },
      })
    )
    const scheduledDelete = vi.fn().mockResolvedValue(undefined)
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        emitter: { emit } as unknown as TRPCContext['emitter'],
        hatchet: {
          scheduled: { delete: scheduledDelete },
        } as unknown as TRPCContext['hatchet'],
      })
    )

    await expect(
      caller.activity.delete({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ deleteActivity: { id: 'live-quiz-1' } })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      include: {
        blocks: { include: { elements: true } },
        course: {
          include: {
            _count: {
              select: {
                permissions: {
                  where: {
                    userId: user.id,
                    permissionLevel: {
                      in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    expect(deleteLiveQuiz).toHaveBeenCalledWith({
      where: {
        id: 'live-quiz-1',
        status: {
          in: [PublicationStatus.DRAFT, PublicationStatus.SCHEDULED],
        },
      },
    })
    expect(scheduledDelete).toHaveBeenCalledWith('publication-task')
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'live-quiz-1',
    })
  })

  test('returns null when deleting a running live quiz', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      status: PublicationStatus.PUBLISHED,
      isAssessmentEnabled: false,
      blocks: [],
      course: null,
    })
    const transaction = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.delete({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
      })
    ).resolves.toEqual({ deleteActivity: null })

    expect(transaction).not.toHaveBeenCalled()
  })

  test('resets ended assessment live quizzes through the activity router', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const findUnique = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      isAssessmentEnabled: true,
      blocks: [],
    })
    const updateLiveQuiz = vi.fn().mockResolvedValue({
      id: 'live-quiz-1',
      status: PublicationStatus.DRAFT,
    })
    const transaction = vi.fn().mockImplementation(async (callback) =>
      callback({
        liveQuiz: { update: updateLiveQuiz },
        elementBlock: { update: vi.fn() },
        elementInstance: { update: vi.fn() },
      })
    )
    const auditPush = vi.fn().mockResolvedValue(undefined)
    const redisKeys = vi.fn().mockResolvedValue([])
    const emit = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      liveQuiz: {
        findUnique,
      },
      $transaction: transaction,
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        emitter: { emit } as unknown as TRPCContext['emitter'],
        hatchet: {
          events: { push: auditPush },
        } as unknown as TRPCContext['hatchet'],
        redisAssessmentExec: {
          keys: redisKeys,
        } as unknown as TRPCContext['redisAssessmentExec'],
      })
    )

    await expect(
      caller.activity.resetAssessmentLiveQuiz({
        activityId: 'live-quiz-1',
      })
    ).resolves.toEqual({
      resetAssessmentLiveQuiz: {
        id: 'live-quiz-1',
        status: PublicationStatus.DRAFT,
      },
    })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'live-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(findUnique).toHaveBeenCalledWith({
      where: {
        id: 'live-quiz-1',
        isAssessmentEnabled: true,
        status: PublicationStatus.ENDED,
        course: {
          permissions: {
            some: {
              userId: user.id,
              permissionLevel: {
                in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
              },
            },
          },
        },
      },
      include: {
        blocks: {
          include: {
            elements: {
              include: { liveQuizResponses: true },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { order: 'asc' },
        },
      },
    })
    expect(updateLiveQuiz).toHaveBeenCalledWith({
      where: { id: 'live-quiz-1' },
      data: {
        status: PublicationStatus.DRAFT,
        startedAt: null,
        finishedAt: null,
        feedbacks: { deleteMany: {} },
        confusionFeedbacks: { deleteMany: {} },
        leaderboard: { deleteMany: {} },
        temporaryLeaderboard: { deleteMany: {} },
      },
      select: { id: true, status: true },
    })
    expect(auditPush).toHaveBeenCalledWith('create-audit-log-entry', {
      info: expect.stringContaining('initiated reset'),
    })
    expect(auditPush).toHaveBeenCalledWith('create-audit-log-entry', {
      info: expect.stringContaining('Successfully reset'),
    })
    expect(redisKeys).toHaveBeenCalledWith('lq:live-quiz-1:*')
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'live-quiz-1',
    })
  })

  test.each([
    {
      activityType: ActivityType.PRACTICE_QUIZ,
      modelName: 'practiceQuiz',
      permissionKey: 'practiceQuizId',
      typename: 'PracticeQuiz',
      findInclude: {
        responses: true,
        stacks: { include: { elements: true } },
      },
      findResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
        responses: [],
        stacks: [],
      },
      deleteResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
      },
      deletedTaskIds: ['publication-task'],
    },
    {
      activityType: ActivityType.MICRO_LEARNING,
      modelName: 'microLearning',
      permissionKey: 'microLearningId',
      typename: 'MicroLearning',
      findInclude: {
        responses: true,
        stacks: { include: { elements: true } },
      },
      findResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
        responses: [],
        stacks: [],
      },
      deleteResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
      },
      deletedTaskIds: ['publication-task', 'completion-task'],
    },
    {
      activityType: ActivityType.GROUP_ACTIVITY,
      modelName: 'groupActivity',
      permissionKey: 'groupActivityId',
      typename: 'GroupActivity',
      findInclude: {
        activityInstances: true,
        stacks: { include: { elements: true } },
      },
      findResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
        activityInstances: [],
        stacks: [],
      },
      deleteResult: {
        id: 'activity-1',
        status: PublicationStatus.SCHEDULED,
        scheduledPublicationTaskId: 'publication-task',
        scheduledCompletionTaskId: 'completion-task',
      },
      deletedTaskIds: ['publication-task', 'completion-task'],
    },
  ])(
    'hard deletes scheduled $activityType activities through the activity router',
    async ({
      activityType,
      modelName,
      permissionKey,
      typename,
      findInclude,
      findResult,
      deleteResult,
      deletedTaskIds,
    }) => {
      const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
      const findUnique = vi.fn().mockResolvedValue(findResult)
      const deleteActivityModel = vi.fn().mockResolvedValue(deleteResult)
      const scheduledDelete = vi.fn().mockResolvedValue(undefined)
      const emit = vi.fn()
      const prisma = {
        derivedPermission: {
          findFirst: permissionFindFirst,
        },
        [modelName]: {
          findUnique,
          delete: deleteActivityModel,
        },
      } as unknown as TRPCContext['prisma']
      const caller = appRouter.createCaller(
        createContext(prisma, {
          emitter: { emit } as unknown as TRPCContext['emitter'],
          hatchet: {
            scheduled: {
              delete: scheduledDelete,
            },
          } as unknown as TRPCContext['hatchet'],
        })
      )

      await expect(
        caller.activity.delete({
          activityId: 'activity-1',
          activityType,
        })
      ).resolves.toEqual({
        deleteActivity: {
          id: 'activity-1',
        },
      })

      expect(permissionFindFirst).toHaveBeenCalledWith({
        where: {
          [permissionKey]: 'activity-1',
          userId: user.id,
          permissionLevel: {
            in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
          },
        },
      })
      expect(findUnique).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
        include: findInclude,
      })
      expect(deleteActivityModel).toHaveBeenCalledWith({
        where: { id: 'activity-1' },
      })
      expect(scheduledDelete).toHaveBeenCalledTimes(deletedTaskIds.length)
      deletedTaskIds.forEach((taskId, ix) => {
        expect(scheduledDelete).toHaveBeenNthCalledWith(ix + 1, taskId)
      })
      expect(emit).toHaveBeenCalledWith('invalidate', {
        typename,
        id: 'activity-1',
      })
    }
  )

  test('returns null when activity delete admin permission is missing', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const practiceQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        findUnique: practiceQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.delete({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
      })
    ).resolves.toEqual({ deleteActivity: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        practiceQuizId: 'practice-quiz-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(practiceQuizFindUnique).not.toHaveBeenCalled()
  })

  test('returns null when activity unpublish target is not scheduled', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const practiceQuizFindUnique = vi.fn().mockResolvedValue(null)
    const practiceQuizUpdate = vi.fn()
    const scheduledDelete = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      practiceQuiz: {
        findUnique: practiceQuizFindUnique,
        update: practiceQuizUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        hatchet: {
          scheduled: {
            delete: scheduledDelete,
          },
        } as unknown as TRPCContext['hatchet'],
      })
    )

    await expect(
      caller.activity.unpublish({
        activityId: 'practice-quiz-1',
        activityType: ActivityType.PRACTICE_QUIZ,
      })
    ).resolves.toEqual({ unpublishActivity: null })

    expect(practiceQuizFindUnique).toHaveBeenCalledWith({
      where: {
        id: 'practice-quiz-1',
        status: PublicationStatus.SCHEDULED,
      },
      select: { scheduledPublicationTaskId: true },
    })
    expect(scheduledDelete).not.toHaveBeenCalled()
    expect(practiceQuizUpdate).not.toHaveBeenCalled()
  })

  test('continues activity unpublish when scheduled task deletion fails', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const microLearningFindUnique = vi.fn().mockResolvedValue({
      scheduledPublicationTaskId: 'publication-task',
      scheduledCompletionTaskId: null,
    })
    const microLearningUpdate = vi.fn().mockResolvedValue({
      id: 'microlearning-1',
      status: PublicationStatus.DRAFT,
    })
    const scheduledDelete = vi
      .fn()
      .mockRejectedValue(new Error('delete failed'))
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      microLearning: {
        findUnique: microLearningFindUnique,
        update: microLearningUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, {
        hatchet: {
          scheduled: {
            delete: scheduledDelete,
          },
        } as unknown as TRPCContext['hatchet'],
      })
    )

    await expect(
      caller.activity.unpublish({
        activityId: 'microlearning-1',
        activityType: ActivityType.MICRO_LEARNING,
      })
    ).resolves.toEqual({
      unpublishActivity: {
        id: 'microlearning-1',
        status: PublicationStatus.DRAFT,
      },
    })

    expect(microLearningUpdate).toHaveBeenCalled()
    expect(consoleError).toHaveBeenCalledWith(
      'Failed to delete scheduled publication task for microlearning microlearning-1:',
      expect.any(Error)
    )
    consoleError.mockRestore()
  })

  test('returns null for group activity grading without execute permission', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const groupActivityFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique: groupActivityFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.groupActivityGrading({ id: 'group-activity-1' })
    ).resolves.toEqual({ groupActivityGrading: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        groupActivityId: 'group-activity-1',
        userId: user.id,
        permissionLevel: {
          in: [
            PermissionLevel.EXECUTE,
            PermissionLevel.WRITE,
            PermissionLevel.ADMIN,
            PermissionLevel.OWNER,
          ],
        },
      },
    })
    expect(groupActivityFindUnique).not.toHaveBeenCalled()
  })

  test('returns group activity grading payload with preview element data', async () => {
    const scheduledStartAt = new Date('2026-05-01T10:00:00.000Z')
    const scheduledEndAt = new Date('2026-05-01T11:00:00.000Z')
    const decisionsSubmittedAt = new Date('2026-05-01T10:15:00.000Z')
    const resultsComputedAt = new Date('2026-05-01T10:30:00.000Z')
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const groupActivityFindUnique = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      name: 'Group Activity',
      displayName: 'Group Activity',
      description: null,
      status: PublicationStatus.ENDED,
      pointsMultiplier: 1,
      scheduledStartAt,
      scheduledEndAt,
      clues: [
        {
          id: 1,
          type: 'NUMBER',
          name: 'clue',
          displayName: 'Clue',
          value: '42',
          unit: null,
        },
      ],
      stacks: [
        {
          id: 3,
          displayName: 'Stack',
          description: null,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.GROUP_ACTIVITY,
              elementType: ElementType.SC,
              options: { pointsMultiplier: 2 },
              elementData: {
                id: 'element-data-1',
                elementId: 17,
                name: 'Choice question',
                type: ElementType.SC,
                content: 'Choose one',
                explanation: null,
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                  hasAnswerFeedbacks: false,
                  displayMode: 'LIST',
                  choices: [{ ix: 0, correct: true, value: 'A' }],
                },
              },
            },
          ],
        },
      ],
      activityInstances: [
        {
          id: 21,
          groupActivityId: 'group-activity-1',
          decisionsSubmittedAt,
          decisions: [
            {
              instanceId: 11,
              type: ElementType.SC,
              choicesResponse: [{ ix: 0, selected: true }],
            },
          ],
          resultsComputedAt,
          results: {
            passed: true,
            points: 50,
            comment: 'Well done',
            grading: [
              {
                instanceId: 11,
                score: 50,
                maxPoints: 50,
                feedback: 'Good',
              },
            ],
          },
          group: { name: 'Group 1' },
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique: groupActivityFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.groupActivityGrading({ id: 'group-activity-1' })
    ).resolves.toMatchObject({
      groupActivityGrading: {
        __typename: 'GroupActivity',
        id: 'group-activity-1',
        clues: [
          {
            __typename: 'GroupActivityClue',
            id: 1,
            displayName: 'Clue',
          },
        ],
        stacks: [
          {
            __typename: 'ElementStack',
            elements: [
              {
                __typename: 'ElementInstance',
                id: 11,
                options: {
                  __typename: 'ElementInstanceOptions',
                  pointsMultiplier: 2,
                },
                elementData: {
                  __typename: 'ChoicesElementData',
                  name: 'Choice question',
                },
              },
            ],
          },
        ],
        activityInstances: [
          {
            __typename: 'GroupActivityInstance',
            id: 21,
            groupName: 'Group 1',
            decisions: [
              {
                __typename: 'GroupActivityDecision',
                choicesResponse: [
                  {
                    __typename: 'ChoicesResponseObject',
                    ix: 0,
                    selected: true,
                  },
                ],
              },
            ],
            results: {
              __typename: 'GroupActivityResults',
              grading: [
                {
                  __typename: 'GroupActivityGrading',
                  score: 50,
                  maxPoints: 50,
                },
              ],
            },
          },
        ],
      },
    })

    expect(groupActivityFindUnique).toHaveBeenCalledWith({
      where: { id: 'group-activity-1' },
      include: {
        clues: true,
        stacks: {
          include: { elements: { orderBy: { order: 'asc' } } },
          orderBy: { order: 'asc' },
        },
        activityInstances: {
          include: { group: true },
          orderBy: { decisionsSubmittedAt: 'asc' },
        },
      },
    })
  })

  test('grades group activity submissions with clamped scores', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const elementInstanceFindMany = vi
      .fn()
      .mockResolvedValue([{ id: 11, options: { pointsMultiplier: 2 } }])
    const groupActivityInstanceUpdate = vi.fn().mockResolvedValue({ id: 21 })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      elementInstance: {
        findMany: elementInstanceFindMany,
      },
      groupActivityInstance: {
        update: groupActivityInstanceUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.gradeGroupActivitySubmission({
        id: 21,
        groupActivityId: 'group-activity-1',
        gradingDecisions: {
          passed: true,
          comment: 'Well done',
          grading: [
            {
              instanceId: 11,
              score: 60,
              feedback: 'Good',
            },
          ],
        },
      })
    ).resolves.toEqual({ gradeGroupActivitySubmission: { id: 21 } })

    expect(elementInstanceFindMany).toHaveBeenCalledWith({
      where: { id: { in: [11] } },
      select: { id: true, options: true },
    })
    expect(groupActivityInstanceUpdate).toHaveBeenCalledWith({
      where: { id: 21 },
      data: {
        results: {
          passed: true,
          points: 60,
          comment: 'Well done',
          grading: [
            {
              instanceId: 11,
              score: 50,
              maxPoints: 50,
              feedback: 'Good',
              correctness: ResponseCorrectness.CORRECT,
            },
          ],
        },
      },
    })
  })

  test('does not finalize group activity grading while solved submissions lack results', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const groupActivityFindUnique = vi.fn().mockResolvedValue({
      id: 'group-activity-1',
      activityInstances: [
        { id: 21, decisions: [{ instanceId: 11 }], results: null },
      ],
    })
    const groupActivityUpdate = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      groupActivity: {
        findUnique: groupActivityFindUnique,
        update: groupActivityUpdate,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.finalizeGroupActivityGrading({ id: 'group-activity-1' })
    ).resolves.toEqual({ finalizeGroupActivityGrading: null })

    expect(groupActivityFindUnique).toHaveBeenCalledWith({
      where: { id: 'group-activity-1' },
      include: { activityInstances: true },
    })
    expect(groupActivityUpdate).not.toHaveBeenCalled()
  })

  test('returns null for assessment course results without admin permission', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue(null)
    const courseFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.assessmentResultsCourse({ courseId: 'course-1' })
    ).resolves.toEqual({ assessmentResultsCourse: null })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        courseId: 'course-1',
        userId: user.id,
        permissionLevel: {
          in: [PermissionLevel.ADMIN, PermissionLevel.OWNER],
        },
      },
    })
    expect(courseFindUnique).not.toHaveBeenCalled()
  })

  test('returns ended live quizzes for point correction scope selection', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const courseFindUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [
        {
          id: 'live-quiz-1',
          name: 'Internal name',
          displayName: 'Display name',
          blocks: [
            {
              elements: [
                { id: 11, elementData: { name: 'Question A' } },
                { id: 12, elementData: { name: 'Question B' } },
              ],
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.endedLiveQuizzesCourse({ courseId: 'course-1' })
    ).resolves.toEqual({
      endedLiveQuizzesCourse: [
        {
          id: 'live-quiz-1',
          name: 'Internal name',
          displayName: 'Display name',
          instances: [
            { id: '11', name: 'Question A' },
            { id: '12', name: 'Question B' },
          ],
        },
      ],
    })

    expect(courseFindUnique).toHaveBeenCalledWith({
      where: { id: 'course-1' },
      include: {
        liveQuizzes: {
          where: { isDeleted: false, status: PublicationStatus.ENDED },
          include: {
            blocks: {
              include: { elements: { orderBy: { order: 'asc' } } },
              orderBy: { order: 'asc' },
            },
          },
          orderBy: { finishedAt: 'desc' },
        },
      },
    })
  })

  test('returns sorted assessment course participants with preferred SSO email', async () => {
    const permissionFindFirst = vi.fn().mockResolvedValue({ id: 1 })
    const courseFindUnique = vi.fn().mockResolvedValue({
      participations: [
        {
          participant: {
            id: 'participant-2',
            email: 'z@example.com',
            username: 'z-user',
            accounts: [],
          },
        },
        {
          participant: {
            id: 'participant-1',
            email: 'a-local@example.com',
            username: 'a-user',
            accounts: [{ ssoEmail: 'a-sso@example.com' }],
          },
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: permissionFindFirst,
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.assessmentCourseParticipants({ courseId: 'course-1' })
    ).resolves.toEqual({
      assessmentCourseParticipants: [
        { id: 'participant-1', email: 'a-sso@example.com', username: 'a-user' },
        { id: 'participant-2', email: 'z@example.com', username: 'z-user' },
      ],
    })
  })

  test('returns student course assessment drilldown results for assessment admins', async () => {
    const finishedAt = new Date('2026-01-01T10:00:00.000Z')
    const permissionFindUnique = vi.fn().mockResolvedValue({ id: 1 })
    const courseFindUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [
        {
          id: 'live-quiz-1',
          displayName: 'Assessment Live Quiz',
          finishedAt,
          pointsMultiplier: 2,
          defaultPoints: 5,
          defaultCorrectPoints: 10,
          maxBonusPoints: 3,
          blocks: [
            {
              elements: [
                {
                  elementType: ElementType.SC,
                  elementData: {
                    options: { hasSampleSolution: true },
                  },
                  options: { basePoints: true, pointsMultiplier: 2 },
                  liveQuizResponses: [],
                },
              ],
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findUnique: permissionFindUnique,
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.studentCourseResults({
        courseId: 'course-1',
        participantId: 'participant-1',
      })
    ).resolves.toEqual({
      studentCourseResults: [
        {
          id: 'live-quiz-1',
          activityId: 'live-quiz-1',
          displayName: 'Assessment Live Quiz',
          finishedAt,
          multiplier: 2,
          basePoints: 0,
          availableBasePoints: 5,
          correctnessPoints: 0,
          availableCorrectnessPoints: 20,
          bonusPoints: 0,
          availableBonusPoints: 6,
          corrections: [],
        },
      ],
    })
  })

  test('maps live quiz student assessment response blocks through preview DTOs', async () => {
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      blocks: [
        {
          id: 21,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.SC,
              options: { basePoints: true, pointsMultiplier: 1 },
              elementData: {
                id: 1,
                elementId: 2,
                name: 'Question A',
                type: ElementType.SC,
                content: 'Question content',
                explanation: null,
                basePoints: true,
                pointsMultiplier: 1,
                options: {
                  hasSampleSolution: true,
                  hasAnswerFeedbacks: false,
                  displayMode: 'LIST',
                  choices: [{ ix: 0, correct: true, value: 'A' }],
                },
              },
              liveQuizResponses: [
                {
                  basePoints: 5,
                  correctnessPoints: 10,
                  bonusPoints: 2,
                  correctness: ResponseCorrectness.CORRECT,
                  response: { choices: [0] },
                  appliedCorrections: [],
                },
              ],
            },
          ],
        },
      ],
    })
    const prisma = {
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.liveQuizStudentAssessmentResponses({
        liveQuizId: 'live-quiz-1',
        participantId: 'participant-1',
      })
    ).resolves.toMatchObject({
      liveQuizStudentAssessmentResponses: [
        {
          blockId: 21,
          instances: [
            {
              basePoints: 5,
              correctnessPoints: 10,
              bonusPoints: 2,
              correctness: ResponseCorrectness.CORRECT,
              submission: { choices: [0] },
              corrections: [],
              instance: {
                id: 11,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.SC,
                elementData: {
                  __typename: 'ChoicesElementData',
                  name: 'Question A',
                  options: {
                    __typename: 'ChoiceElementOptions',
                    choices: [{ ix: 0, correct: true, value: 'A' }],
                  },
                },
              },
            },
          ],
        },
      ],
    })

    expect(liveQuizFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'live-quiz-1',
          isAssessmentEnabled: true,
        }),
      })
    )
  })

  test('returns previous point corrections with display-ready relations', async () => {
    const createdAt = new Date('2026-01-01T10:00:00.000Z')
    const courseFindUnique = vi.fn().mockResolvedValue({
      liveQuizzes: [
        {
          id: 'live-quiz-1',
          name: 'Live Quiz',
          corrections: [
            {
              id: 1,
              type: PointCorrectionType.SINGLE,
              basePoints: true,
              correctnessPoints: null,
              bonusPoints: false,
              reason: 'Lecturer reason',
              studentReason: 'Student reason',
              createdAt,
              correctedBy: { id: user.id, shortname: 'lecturer' },
              participant: {
                id: 'participant-1',
                username: 'participant',
                email: 'fallback@example.com',
                accounts: [{ ssoEmail: 'sso@example.com' }],
              },
              participants: [],
            },
          ],
          blocks: [],
        },
      ],
    })
    const prisma = {
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.previousPointCorrections({ courseId: 'course-1' })
    ).resolves.toEqual({
      previousPointCorrections: [
        {
          id: 1,
          type: PointCorrectionType.SINGLE,
          basePoints: true,
          correctnessPoints: null,
          bonusPoints: false,
          reason: 'Lecturer reason',
          studentReason: 'Student reason',
          createdAt,
          correctedBy: { id: user.id, shortname: 'lecturer' },
          participant: {
            id: 'participant-1',
            username: 'participant',
            email: 'sso@example.com',
          },
          participants: [],
          liveQuiz: { id: 'live-quiz-1', name: 'Live Quiz' },
          instance: null,
        },
      ],
    })
  })

  test('returns null for point correction mutations without adjustments', async () => {
    const elementInstanceFindUnique = vi.fn()
    const prisma = {
      elementInstance: {
        findUnique: elementInstanceFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.activity.correctAssessmentPointsInstance({
        instanceId: 11,
        reason: 'Lecturer reason',
        studentReason: 'Student reason',
        scope: PointCorrectionType.SINGLE,
        participantId: 'participant-1',
        participantIds: [],
      })
    ).resolves.toEqual({ correctAssessmentPointsInstance: null })

    expect(elementInstanceFindUnique).not.toHaveBeenCalled()
  })

  test('requires full-access user scope for review status mutation', async () => {
    const update = vi.fn()
    const prisma = {
      liveQuiz: {
        update,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { scope: UserLoginScope.READ_ONLY })
    )

    await expect(
      caller.activity.setReviewStatus({
        activityId: 'live-quiz-1',
        activityType: ActivityType.LIVE_QUIZ,
        isReviewed: true,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(update).not.toHaveBeenCalled()
  })

  test('requires full-access user scope for activity batch operations', async () => {
    const findMany = vi.fn()
    const prisma = {
      liveQuiz: {
        findMany,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext(prisma, { scope: UserLoginScope.READ_ONLY })
    )

    await expect(
      caller.activity.applyBatchOperations({
        activityIds: ['live-quiz-1'],
        multiplier: 2,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(findMany).not.toHaveBeenCalled()
  })
})

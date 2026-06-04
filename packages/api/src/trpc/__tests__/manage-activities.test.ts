import {
  ElementInstanceType,
  ElementType,
  Locale,
  PermissionLevel,
  PublicationStatus,
  ReviewStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType, SharingType, SortByType } from '@klicker-uzh/types'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

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
})

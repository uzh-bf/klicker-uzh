import {
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
})

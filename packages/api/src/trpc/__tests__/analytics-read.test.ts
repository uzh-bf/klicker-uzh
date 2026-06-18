import {
  Locale,
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { ActivityType, type ElementData } from '@klicker-uzh/types'
import { describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  id: 'user-1',
  role: UserRole.USER,
  locale: Locale.en,
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

const elementData = {
  id: 'element-uuid',
  elementId: 1,
  type: 'SC',
  name: 'Element 1',
  content: 'Question',
  pointsMultiplier: 1,
  options: {},
} as ElementData

function createActivity() {
  return {
    name: 'Practice Quiz Demo',
    course: {
      _count: {
        participations: 50,
      },
    },
    performance: {
      id: 10,
      firstErrorRate: 0.1,
      firstPartialRate: 0.2,
      firstCorrectRate: 0.7,
      lastErrorRate: 0.05,
      lastPartialRate: 0.15,
      lastCorrectRate: 0.8,
      totalErrorRate: 0.08,
      totalPartialRate: 0.12,
      totalCorrectRate: 0.8,
    },
    stacks: [
      {
        elements: [
          {
            elementData,
            feedbacks: [
              { upvote: true, downvote: false },
              { upvote: false, downvote: true },
            ],
            instancePerformance: {
              id: 20,
              responseCount: 12,
              averageTimeSpent: 8,
              firstErrorRate: 0.2,
              firstPartialRate: 0.1,
              firstCorrectRate: 0.7,
              lastErrorRate: 0.1,
              lastPartialRate: 0.1,
              lastCorrectRate: 0.8,
              totalErrorRate: 0.15,
              totalPartialRate: 0.1,
              totalCorrectRate: 0.75,
            },
            _count: {
              detailResponses: 14,
            },
          },
          {
            elementData,
            feedbacks: [],
            instancePerformance: null,
            _count: {
              detailResponses: 3,
            },
          },
        ],
      },
    ],
  }
}

describe('analytics read routers', () => {
  test('returns practice quiz activity analytics when read permission exists', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce({ permissionLevel: PermissionLevel.READ })
      .mockResolvedValueOnce(null)
    const practiceFindUnique = vi.fn().mockResolvedValue(createActivity())
    const microFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      practiceQuiz: {
        findUnique: practiceFindUnique,
      },
      microLearning: {
        findUnique: microFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.activity({ activityId: 'activity-1' })
    ).resolves.toEqual({
      activityAnalytics: {
        activityName: 'Practice Quiz Demo',
        activityType: ActivityType.PRACTICE_QUIZ,
        courseParticipants: 50,
        activityQuizAnalytics: {
          id: 10,
          numberOfAnswers: 14,
          averageTimeSpent: 8,
          firstErrorRate: 0.1,
          firstPartialRate: 0.2,
          firstCorrectRate: 0.7,
          lastErrorRate: 0.05,
          lastPartialRate: 0.15,
          lastCorrectRate: 0.8,
          totalErrorRate: 0.08,
          totalPartialRate: 0.12,
          totalCorrectRate: 0.8,
        },
        instanceQuizAnalytics: [
          {
            id: 20,
            elementName: 'Element 1',
            elementType: 'SC',
            numberOfAnswers: 14,
            uniqueParticipants: 12,
            averageTimeSpent: 8,
            firstErrorRate: 0.2,
            firstPartialRate: 0.1,
            firstCorrectRate: 0.7,
            lastErrorRate: 0.1,
            lastPartialRate: 0.1,
            lastCorrectRate: 0.8,
            totalErrorRate: 0.15,
            totalPartialRate: 0.1,
            totalCorrectRate: 0.75,
            upvoteRate: 1,
            downvoteRate: 0.5,
            feedbackCount: 2,
          },
        ],
      },
    })

    expect(findFirst).toHaveBeenCalledTimes(2)
    expect(findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          practiceQuizId: 'activity-1',
          userId: user.id,
        }),
      })
    )
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          microLearningId: 'activity-1',
          userId: user.id,
        }),
      })
    )
    expect(practiceFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'activity-1',
          permissions: { some: { userId: user.id } },
        },
      })
    )
    expect(microFindUnique).not.toHaveBeenCalled()
  })

  test('falls back to microlearning activity analytics', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ permissionLevel: PermissionLevel.READ })
    const practiceFindUnique = vi.fn()
    const microFindUnique = vi.fn().mockResolvedValue({
      ...createActivity(),
      name: 'Microlearning Demo',
      performance: null,
    })
    const prisma = {
      derivedPermission: {
        findFirst,
      },
      practiceQuiz: {
        findUnique: practiceFindUnique,
      },
      microLearning: {
        findUnique: microFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.activity({ activityId: 'activity-1' })
    ).resolves.toMatchObject({
      activityAnalytics: {
        activityName: 'Microlearning Demo',
        activityType: ActivityType.MICRO_LEARNING,
        activityQuizAnalytics: null,
      },
    })

    expect(practiceFindUnique).not.toHaveBeenCalled()
    expect(microFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'activity-1',
          permissions: { some: { userId: user.id } },
        },
      })
    )
  })

  test('returns null activity analytics without read permission', async () => {
    const practiceFindUnique = vi.fn()
    const microFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      practiceQuiz: {
        findUnique: practiceFindUnique,
      },
      microLearning: {
        findUnique: microFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.activity({ activityId: 'activity-1' })
    ).resolves.toEqual({ activityAnalytics: null })
    expect(practiceFindUnique).not.toHaveBeenCalled()
    expect(microFindUnique).not.toHaveBeenCalled()
  })

  test('returns course activity analytics when read permission exists', async () => {
    const startDate = new Date('2026-01-01T00:00:00.000Z')
    const endDate = new Date('2026-01-15T00:00:00.000Z')
    const findFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.READ,
    })
    const courseFindUnique = vi.fn().mockResolvedValue({
      name: 'Analytics Course',
      startDate,
      endDate,
      participations: [{ id: 1 }, { id: 2 }],
      aggregatedAnalytics: [
        {
          type: 'DAILY',
          timestamp: new Date('2026-01-02T00:00:00.000Z'),
          participantCount: 1,
        },
        {
          type: 'WEEKLY',
          timestamp: new Date('2026-01-08T00:00:00.000Z'),
          participantCount: 2,
        },
      ],
      aggregatedCourseAnalytics: {
        activityMonday: 1,
        activityTuesday: 2,
        activityWednesday: 3,
        activityThursday: 4,
        activityFriday: 5,
        activitySaturday: 6,
        activitySunday: 7,
      },
      participantCourseAnalytics: [
        {
          activeWeeks: 2,
          activeDaysPerWeek: 1.5,
          meanElementsPerDay: 3.5,
          activityLevel: 'HIGH',
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      course: { findUnique: courseFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.courseActivity({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseActivityAnalytics: {
        name: 'Analytics Course',
        courseWeeks: 2,
        totalParticipants: 2,
        dailyActivity: [
          {
            date: new Date('2026-01-02T00:00:00.000Z'),
            activeParticipants: 1,
          },
        ],
        weeklyActivity: [
          {
            date: new Date('2026-01-08T00:00:00.000Z'),
            activeParticipants: 2,
          },
        ],
        activeDays: {
          monday: 1,
          tuesday: 2,
          wednesday: 3,
          thursday: 4,
          friday: 5,
          saturday: 6,
          sunday: 7,
        },
        participantCourseAnalytics: [
          {
            activeWeeks: 2,
            activeDaysPerWeek: 1.5,
            meanElementsPerDay: 3.5,
            activityLevel: 'HIGH',
          },
        ],
      },
    })

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          courseId: 'course-1',
          userId: user.id,
        }),
      })
    )
    expect(courseFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'course-1' } })
    )
  })

  test('returns weekly course activity for comparison courses', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.READ,
    })
    const courseFindUnique = vi.fn().mockResolvedValue({
      participations: [{ id: 1 }, { id: 2 }, { id: 3 }],
      aggregatedAnalytics: [
        {
          timestamp: new Date('2026-01-08T00:00:00.000Z'),
          participantCount: 2,
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      course: { findUnique: courseFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.courseWeeklyActivity({ courseId: 'course-1' })
    ).resolves.toEqual({
      courseWeeklyActivity: {
        totalParticipants: 3,
        weeklyActivity: [
          {
            date: new Date('2026-01-08T00:00:00.000Z'),
            activeParticipants: 2,
          },
        ],
      },
    })
  })

  test('returns course performance analytics with discriminators', async () => {
    const findFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.READ,
    })
    const courseFindUnique = vi.fn().mockResolvedValue({
      name: 'Analytics Course',
      _count: { participations: 4 },
      practiceQuizzes: [
        {
          id: 'pq-1',
          name: 'Practice Quiz Demo',
          progress: {
            practiceQuizId: 'pq-1',
            microLearningId: null,
            startedCount: 3,
            completedCount: 2,
            repeatedCount: 1,
          },
          performance: {
            id: 10,
            firstErrorRate: null,
            firstPartialRate: null,
            firstCorrectRate: null,
            lastErrorRate: 0.1,
            lastPartialRate: 0.2,
            lastCorrectRate: 0.7,
            totalErrorRate: 0.15,
            totalPartialRate: 0.25,
            totalCorrectRate: 0.6,
          },
          participantPerformances: [
            {
              id: 30,
              totalScore: 10,
              completion: 1,
              participant: {
                id: 'participant-1',
                username: 'student1',
                email: null,
              },
            },
          ],
          stacks: [
            {
              elements: [
                {
                  id: 501,
                  elementData,
                  feedbacks: [
                    { upvote: true, downvote: false },
                    { upvote: false, downvote: true },
                  ],
                  instancePerformance: {
                    id: 20,
                    responseCount: 12,
                    averageTimeSpent: 8,
                    firstErrorRate: null,
                    firstPartialRate: null,
                    firstCorrectRate: null,
                    lastErrorRate: 0.1,
                    lastPartialRate: 0.1,
                    lastCorrectRate: 0.8,
                    totalErrorRate: 0.15,
                    totalPartialRate: 0.1,
                    totalCorrectRate: 0.75,
                  },
                },
              ],
            },
          ],
        },
      ],
      microLearnings: [],
      participantPerformances: [
        {
          id: 40,
          firstErrorRate: 0.2,
          firstPerformance: 'MEDIUM',
          lastErrorRate: 0.1,
          lastPerformance: 'HIGH',
          totalErrorRate: 0.15,
          totalPerformance: 'HIGH',
        },
      ],
    })
    const prisma = {
      derivedPermission: { findFirst },
      course: { findUnique: courseFindUnique },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.coursePerformance({ courseId: 'course-1' })
    ).resolves.toMatchObject({
      coursePerformanceAnalytics: {
        name: 'Analytics Course',
        totalParticipants: 4,
        activityProgresses: [
          {
            activityName: 'Practice Quiz Demo',
            activityType: ActivityType.PRACTICE_QUIZ,
            startedCount: 3,
            completedCount: 2,
            repeatedCount: 1,
          },
        ],
        activityPerformances: [
          {
            __typename: 'ActivityPerformance',
            id: 10,
            activityName: 'Practice Quiz Demo',
            activityType: ActivityType.PRACTICE_QUIZ,
            rates: {
              firstErrorRate: 0.15,
              lastErrorRate: 0.1,
              errorRate: 0.15,
              firstPartialRate: 0.25,
              lastPartialRate: 0.2,
              partialRate: 0.25,
              firstCorrectRate: 0.6,
              lastCorrectRate: 0.7,
              correctRate: 0.6,
            },
          },
        ],
        instancePerformances: [
          {
            __typename: 'InstancePerformance',
            id: 20,
            elementName: 'Element 1',
            elementType: 'SC',
            rates: {
              firstErrorRate: 0.15,
              lastErrorRate: 0.1,
              errorRate: 0.15,
              firstPartialRate: 0.1,
              lastPartialRate: 0.1,
              partialRate: 0.1,
              firstCorrectRate: 0.75,
              lastCorrectRate: 0.8,
              correctRate: 0.75,
            },
          },
        ],
        participantActivityPerformances: [
          {
            participantId: 'participant-1',
            participantUsername: 'student1',
            participantEmail: null,
            performances: [
              {
                id: 30,
                totalScore: 10,
                completion: 1,
                activityId: 'pq-1',
              },
            ],
          },
        ],
        participantPerformances: [
          {
            __typename: 'ParticipantPerformance',
            id: 40,
            firstErrorRate: 0.2,
            firstPerformance: 'MEDIUM',
            lastErrorRate: 0.1,
            lastPerformance: 'HIGH',
            totalErrorRate: 0.15,
            totalPerformance: 'HIGH',
          },
        ],
        instanceFeedbacks: [
          {
            __typename: 'InstanceFeedback',
            id: 501,
            activityType: ActivityType.PRACTICE_QUIZ,
            instanceName: 'Element 1',
            instanceType: 'SC',
            upvoteRate: 0.5,
            downvoteRate: 0.5,
            feedbackCount: 2,
          },
        ],
        activityFeedbacks: [
          {
            __typename: 'ActivityFeedback',
            id: 'pq-1',
            activityType: ActivityType.PRACTICE_QUIZ,
            activityName: 'Practice Quiz Demo',
            upvoteRate: 0.5,
            downvoteRate: 0.5,
            feedbackCount: 1,
          },
        ],
      },
    })
  })

  test('returns null course analytics without read permission', async () => {
    const courseFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      course: {
        findUnique: courseFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.analytics.coursePerformance({ courseId: 'course-1' })
    ).resolves.toEqual({ coursePerformanceAnalytics: null })
    expect(courseFindUnique).not.toHaveBeenCalled()
  })
})

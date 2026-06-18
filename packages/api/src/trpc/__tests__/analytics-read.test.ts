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
})

import {
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: true,
}

function createContext(prisma: TRPCContext['prisma']): TRPCContext {
  return { prisma, user }
}

describe('lecturer live quiz view router', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('returns the published lecturer view with pinned feedbacks and recent confusion summary', async () => {
    const feedbackCreatedAt = new Date('2026-06-19T11:55:00.000Z')
    const responseCreatedAt = new Date('2026-06-19T11:56:00.000Z')
    const derivedPermissionFindFirst = vi.fn().mockResolvedValue({
      permissionLevel: PermissionLevel.READ,
    })
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'quiz-1',
      status: PublicationStatus.PUBLISHED,
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: true,
      isModerationEnabled: false,
      isGamificationEnabled: true,
      confusionFeedbacks: [
        {
          speed: 1,
          difficulty: -1,
          createdAt: new Date('2026-06-19T11:55:00.000Z'),
        },
        {
          speed: 3,
          difficulty: 1,
          createdAt: new Date('2026-06-19T11:51:00.000Z'),
        },
        {
          speed: 5,
          difficulty: 5,
          createdAt: new Date('2026-06-19T11:49:00.000Z'),
        },
        {
          speed: 9,
          difficulty: 9,
          createdAt: new Date('2026-06-19T12:01:00.000Z'),
        },
      ],
      feedbacks: [
        {
          id: 1,
          isPublished: true,
          isPinned: true,
          isResolved: false,
          content: 'Pinned question',
          votes: 4,
          resolvedAt: null,
          createdAt: feedbackCreatedAt,
          responses: [
            {
              id: 10,
              content: 'Pinned answer',
              positiveReactions: 2,
              negativeReactions: 1,
              createdAt: responseCreatedAt,
            },
          ],
        },
      ],
    })
    const prisma = {
      derivedPermission: {
        findFirst: derivedPermissionFindFirst,
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.liveQuiz.lecturerView({ id: 'quiz-1' })
    ).resolves.toEqual({
      lecturerViewLiveQuiz: {
        id: 'quiz-1',
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: true,
        isModerationEnabled: false,
        isGamificationEnabled: true,
        confusionSummary: {
          speed: 2,
          difficulty: 0,
          numberOfParticipants: 2,
        },
        feedbacks: [
          {
            id: 1,
            isPublished: true,
            isPinned: true,
            isResolved: false,
            content: 'Pinned question',
            votes: 4,
            resolvedAt: null,
            createdAt: feedbackCreatedAt,
            responses: [
              {
                id: 10,
                content: 'Pinned answer',
                positiveReactions: 2,
                negativeReactions: 1,
                createdAt: responseCreatedAt,
              },
            ],
          },
        ],
      },
    })
    expect(derivedPermissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'quiz-1',
        userId: user.sub,
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
    expect(liveQuizFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quiz-1' },
      })
    )
    expect(
      liveQuizFindUnique.mock.calls[0]?.[0].select.feedbacks.where
    ).toEqual({ isPinned: true })
  })

  test('returns null without live quiz read permission', async () => {
    const liveQuizFindUnique = vi.fn()
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.liveQuiz.lecturerView({ id: 'quiz-1' })
    ).resolves.toEqual({
      lecturerViewLiveQuiz: null,
    })
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('returns null for unpublished live quizzes', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          status: PublicationStatus.DRAFT,
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.liveQuiz.lecturerView({ id: 'quiz-1' })
    ).resolves.toEqual({
      lecturerViewLiveQuiz: null,
    })
  })

  test('returns a zero confusion summary when no confusion feedback is recent', async () => {
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'quiz-1',
          status: PublicationStatus.PUBLISHED,
          isLiveQAEnabled: false,
          isConfusionFeedbackEnabled: true,
          isModerationEnabled: false,
          isGamificationEnabled: false,
          confusionFeedbacks: [
            {
              speed: 3,
              difficulty: 2,
              createdAt: new Date('2026-06-19T11:49:59.000Z'),
            },
          ],
          feedbacks: [],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext(prisma))

    await expect(
      caller.liveQuiz.lecturerView({ id: 'quiz-1' })
    ).resolves.toEqual({
      lecturerViewLiveQuiz: {
        id: 'quiz-1',
        isLiveQAEnabled: false,
        isConfusionFeedbackEnabled: true,
        isModerationEnabled: false,
        isGamificationEnabled: false,
        confusionSummary: {
          speed: 0,
          difficulty: 0,
          numberOfParticipants: 0,
        },
        feedbacks: [],
      },
    })
  })
})

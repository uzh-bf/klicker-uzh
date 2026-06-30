import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
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

function createRedis(results: [Error | null, { participants: string }][]) {
  const pipe = {
    hgetall: vi.fn(() => pipe),
    exec: vi.fn().mockResolvedValue(results),
  }

  return {
    pipeline: vi.fn(() => pipe),
    pipe,
  }
}

function createContext({
  prisma,
  redisExec = createRedis([]),
  redisAssessmentExec = createRedis([]),
}: {
  prisma: TRPCContext['prisma']
  redisExec?: ReturnType<typeof createRedis>
  redisAssessmentExec?: ReturnType<typeof createRedis>
}): TRPCContext {
  return { prisma, redisExec, redisAssessmentExec, user }
}

describe('live quiz cockpit router', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-06-19T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
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
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.liveQuiz.cockpit({ id: 'quiz-1' })).resolves.toEqual({
      cockpitQuiz: null,
    })
    expect(liveQuizFindUnique).not.toHaveBeenCalled()
  })

  test('returns null when no published cockpit quiz exists', async () => {
    const liveQuizFindUnique = vi.fn().mockResolvedValue(null)
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(caller.liveQuiz.cockpit({ id: 'quiz-1' })).resolves.toEqual({
      cockpitQuiz: null,
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quiz-1', status: PublicationStatus.PUBLISHED },
      })
    )
  })

  test('returns the published cockpit quiz with timeline counts and feedback state', async () => {
    const startedAt = new Date('2026-06-19T11:40:00.000Z')
    const expiresAt = new Date('2026-06-19T12:00:30.000Z')
    const feedbackCreatedAt = new Date('2026-06-19T11:58:00.000Z')
    const responseCreatedAt = new Date('2026-06-19T11:59:00.000Z')
    const liveQuizFindUnique = vi.fn().mockResolvedValue({
      id: 'quiz-1',
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: true,
      isModerationEnabled: false,
      isGamificationEnabled: true,
      isAssessmentEnabled: false,
      namespace: 'course',
      name: 'live-quiz',
      displayName: 'Live Quiz',
      pinCode: '123456',
      status: PublicationStatus.PUBLISHED,
      startedAt,
      activeBlock: {
        id: 2,
        elements: [{ id: 21 }, { id: 22 }],
      },
      course: {
        id: 'course-1',
        displayName: 'Course 1',
        language: 'en',
      },
      blocks: [
        {
          id: 1,
          order: 0,
          status: ElementBlockStatus.EXECUTED,
          expiresAt: null,
          timeLimit: 60,
          randomSelection: null,
          execution: 1,
          elements: [
            {
              id: 11,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.SC,
              elementData: {
                elementId: 101,
                name: 'Question A',
                options: { choices: [] },
              },
              results: { total: 7 },
              anonymousResults: { total: 2 },
            },
            {
              id: 12,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.MC,
              elementData: {
                elementId: 102,
                name: 'Question B',
                options: { choices: [] },
              },
              results: { total: 4 },
              anonymousResults: { total: 1 },
            },
          ],
        },
        {
          id: 2,
          order: 1,
          status: ElementBlockStatus.ACTIVE,
          expiresAt,
          timeLimit: 30,
          randomSelection: null,
          execution: 2,
          elements: [
            {
              id: 21,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.FREE_TEXT,
              elementData: {
                elementId: 201,
                name: 'Question C',
                options: { choices: [] },
              },
              results: { total: 12 },
              anonymousResults: { total: 3 },
            },
            {
              id: 22,
              type: ElementInstanceType.LIVE_QUIZ,
              elementType: ElementType.NUMERICAL,
              elementData: {
                elementId: 202,
                name: 'Question D',
                options: { choices: [] },
              },
              results: { total: 9 },
              anonymousResults: { total: 5 },
            },
          ],
        },
      ],
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
      ],
      feedbacks: [
        {
          id: 1,
          isPublished: true,
          isPinned: true,
          isResolved: false,
          content: 'Can you explain?',
          votes: 4,
          resolvedAt: null,
          createdAt: feedbackCreatedAt,
          responses: [
            {
              id: 10,
              content: 'Yes',
              positiveReactions: 2,
              negativeReactions: 1,
              createdAt: responseCreatedAt,
            },
          ],
        },
      ],
    })
    const redisExec = createRedis([
      [null, { participants: '8' }],
      [null, { participants: '6' }],
    ])
    const prisma = {
      derivedPermission: {
        findFirst: vi.fn().mockResolvedValue({
          permissionLevel: PermissionLevel.READ,
        }),
      },
      liveQuiz: {
        findUnique: liveQuizFindUnique,
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma, redisExec }))

    await expect(caller.liveQuiz.cockpit({ id: 'quiz-1' })).resolves.toEqual({
      cockpitQuiz: {
        id: 'quiz-1',
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: true,
        isModerationEnabled: false,
        isGamificationEnabled: true,
        isAssessmentEnabled: false,
        namespace: 'course',
        name: 'live-quiz',
        displayName: 'Live Quiz',
        pinCode: '123456',
        status: PublicationStatus.PUBLISHED,
        startedAt,
        course: {
          id: 'course-1',
          displayName: 'Course 1',
          language: 'en',
        },
        activeBlock: {
          id: 2,
        },
        blocks: [
          {
            id: 1,
            numOfParticipants: 5,
            order: 0,
            status: ElementBlockStatus.EXECUTED,
            expiresAt: null,
            timeLimit: 60,
            randomSelection: null,
            execution: 1,
            elements: [
              {
                id: 11,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.SC,
                elementData: {
                  elementId: 101,
                  name: 'Question A',
                },
              },
              {
                id: 12,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.MC,
                elementData: {
                  elementId: 102,
                  name: 'Question B',
                },
              },
            ],
          },
          {
            id: 2,
            numOfParticipants: 6,
            order: 1,
            status: ElementBlockStatus.ACTIVE,
            expiresAt,
            timeLimit: 30,
            randomSelection: null,
            execution: 2,
            elements: [
              {
                id: 21,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.FREE_TEXT,
                elementData: {
                  elementId: 201,
                  name: 'Question C',
                },
              },
              {
                id: 22,
                type: ElementInstanceType.LIVE_QUIZ,
                elementType: ElementType.NUMERICAL,
                elementData: {
                  elementId: 202,
                  name: 'Question D',
                },
              },
            ],
          },
        ],
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
            content: 'Can you explain?',
            votes: 4,
            resolvedAt: null,
            createdAt: feedbackCreatedAt,
            responses: [
              {
                id: 10,
                content: 'Yes',
                positiveReactions: 2,
                negativeReactions: 1,
                createdAt: responseCreatedAt,
              },
            ],
          },
        ],
      },
    })
    expect(liveQuizFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quiz-1', status: PublicationStatus.PUBLISHED },
      })
    )
    expect(redisExec.pipeline).toHaveBeenCalled()
    expect(redisExec.pipe.hgetall).toHaveBeenCalledWith(
      'lq:quiz-1:i:21:results'
    )
    expect(redisExec.pipe.hgetall).toHaveBeenCalledWith(
      'lq:quiz-1:i:22:results'
    )
  })
})

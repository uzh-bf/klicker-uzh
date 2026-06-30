import { UserRole } from '@klicker-uzh/prisma/client'
import { describe, expect, test, vi } from 'vitest'
import { realtimeEvents } from '../../realtime/events.js'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

function createContext({
  emitter,
  prisma,
  pubSub,
  role = UserRole.PARTICIPANT,
  sub = 'participant-1',
}: {
  emitter?: TRPCContext['emitter']
  prisma?: TRPCContext['prisma']
  pubSub?: TRPCContext['pubSub']
  role?: UserRole
  sub?: string
} = {}): TRPCContext {
  return {
    emitter,
    prisma,
    pubSub,
    user: { sub, role },
  }
}

const createdAt = new Date('2026-06-19T10:00:00.000Z')
const resolvedAt = new Date('2026-06-19T11:00:00.000Z')

const publicFeedback = {
  id: 1,
  liveQuizId: 'quiz-1',
  isPublished: true,
  isPinned: false,
  isResolved: false,
  content: 'Can you repeat that?',
  votes: 3,
  resolvedAt: null,
  createdAt,
  responses: [
    {
      id: 11,
      content: 'Sure.',
      positiveReactions: 2,
      negativeReactions: 0,
      createdAt: resolvedAt,
    },
  ],
}

function expectedFeedback(feedback = publicFeedback) {
  return {
    id: feedback.id,
    isPublished: feedback.isPublished,
    isPinned: feedback.isPinned,
    isResolved: feedback.isResolved,
    content: feedback.content,
    votes: feedback.votes,
    resolvedAt: feedback.resolvedAt,
    createdAt: feedback.createdAt,
    responses: feedback.responses.map((response) => ({
      id: response.id,
      content: response.content,
      positiveReactions: response.positiveReactions,
      negativeReactions: response.negativeReactions,
      createdAt: response.createdAt,
    })),
  }
}

describe('participant live quiz feedback routers', () => {
  test('returns only published feedbacks when moderation is enabled', async () => {
    const unpublishedFeedback = {
      ...publicFeedback,
      id: 2,
      isPublished: false,
      content: 'Hidden question',
      responses: [],
    }
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          isModerationEnabled: true,
          feedbacks: [publicFeedback, unpublishedFeedback],
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.liveQuizFeedbacks({ quizId: 'quiz-1' })
    ).resolves.toEqual({ feedbacks: [expectedFeedback()] })

    expect(prisma?.liveQuiz.findUnique).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      include: {
        feedbacks: {
          include: { responses: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
  })

  test('creates a participant feedback and publishes realtime invalidation events', async () => {
    const publish = vi.fn()
    const emit = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          isLiveQAEnabled: true,
          isModerationEnabled: false,
        }),
      },
      feedback: {
        create: vi.fn().mockResolvedValue({ ...publicFeedback, responses: [] }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
        pubSub: { publish },
      })
    )

    await expect(
      caller.participant.createLiveQuizFeedback({
        quizId: 'quiz-1',
        content: 'Can you repeat that?',
      })
    ).resolves.toEqual({
      feedback: expectedFeedback({ ...publicFeedback, responses: [] }),
    })

    expect(prisma?.feedback.create).toHaveBeenCalledWith({
      data: {
        isPublished: true,
        content: 'Can you repeat that?',
        liveQuiz: { connect: { id: 'quiz-1' } },
        participant: { connect: { id: 'participant-1' } },
      },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackCreated,
      expect.objectContaining({ id: 1, liveQuizId: 'quiz-1' })
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackAdded,
      expect.objectContaining({ id: 1, liveQuizId: 'quiz-1' })
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'quiz-1',
    })
  })

  test('does not create feedback when live QA is disabled', async () => {
    const create = vi.fn()
    const prisma = {
      liveQuiz: {
        findUnique: vi.fn().mockResolvedValue({
          isLiveQAEnabled: false,
          isModerationEnabled: false,
        }),
      },
      feedback: { create },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.createLiveQuizFeedback({
        quizId: 'quiz-1',
        content: 'Ignored',
      })
    ).resolves.toEqual({ feedback: null })

    expect(create).not.toHaveBeenCalled()
  })

  test('updates feedback and response vote counters', async () => {
    const prisma = {
      feedback: {
        update: vi.fn().mockResolvedValue({
          ...publicFeedback,
          votes: 4,
          responses: [],
        }),
      },
      feedbackResponse: {
        update: vi.fn().mockResolvedValue({
          id: 11,
          content: 'Sure.',
          positiveReactions: 3,
          negativeReactions: 1,
          createdAt: resolvedAt,
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(createContext({ prisma }))

    await expect(
      caller.participant.upvoteLiveQuizFeedback({
        feedbackId: 1,
        increment: 1,
      })
    ).resolves.toEqual({
      feedback: expectedFeedback({
        ...publicFeedback,
        votes: 4,
        responses: [],
      }),
    })
    await expect(
      caller.participant.voteLiveQuizFeedbackResponse({
        id: 11,
        incrementUpvote: 1,
        incrementDownvote: 1,
      })
    ).resolves.toEqual({
      response: {
        id: 11,
        content: 'Sure.',
        positiveReactions: 3,
        negativeReactions: 1,
        createdAt: resolvedAt,
      },
    })

    expect(prisma?.feedback.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { votes: { increment: 1 } },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(prisma?.feedbackResponse.update).toHaveBeenCalledWith({
      where: { id: 11 },
      data: {
        positiveReactions: { increment: 1 },
        negativeReactions: { increment: 1 },
      },
    })
  })

  test('adds a confusion timestep and invalidates the live quiz', async () => {
    const emit = vi.fn()
    const prisma = {
      confusionTimestep: {
        create: vi.fn().mockResolvedValue({
          difficulty: -1,
          speed: 2,
          createdAt,
        }),
      },
    } as unknown as TRPCContext['prisma']
    const caller = appRouter.createCaller(
      createContext({
        emitter: { emit } as unknown as TRPCContext['emitter'],
        prisma,
      })
    )

    await expect(
      caller.participant.addLiveQuizConfusionTimestep({
        quizId: 'quiz-1',
        difficulty: -1,
        speed: 2,
      })
    ).resolves.toEqual({
      confusionTimestep: {
        difficulty: -1,
        speed: 2,
        createdAt,
      },
    })

    expect(prisma?.confusionTimestep.create).toHaveBeenCalledWith({
      data: {
        difficulty: -1,
        speed: 2,
        liveQuiz: { connect: { id: 'quiz-1' } },
        createdAt: expect.any(Date),
      },
    })
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'quiz-1',
    })
  })
})

import {
  PermissionLevel,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { realtimeEvents } from '../../realtime/events.js'
import type { TRPCContext } from '../context.js'
import { appRouter } from '../root.js'

const user = {
  sub: 'user-1',
  role: UserRole.USER,
  scope: UserLoginScope.ACCOUNT_OWNER,
  catalystInstitutional: false,
  catalystIndividual: true,
}

const createdAt = new Date('2026-06-19T10:00:00.000Z')
const resolvedAt = new Date('2026-06-19T12:00:00.000Z')

type TestFeedbackResponse = {
  id: number
  content: string
  positiveReactions: number
  negativeReactions: number
  createdAt: Date
}

type TestFeedback = {
  id: number
  liveQuizId: string
  isPublished: boolean
  isPinned: boolean
  isResolved: boolean
  content: string
  votes: number
  resolvedAt: Date | null
  createdAt: Date
  responses?: TestFeedbackResponse[]
}

const baseFeedback: TestFeedback = {
  id: 1,
  liveQuizId: 'quiz-1',
  isPublished: false,
  isPinned: true,
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

function expectedFeedback(feedback = baseFeedback) {
  return {
    id: feedback.id,
    isPublished: feedback.isPublished,
    isPinned: feedback.isPinned,
    isResolved: feedback.isResolved,
    content: feedback.content,
    votes: feedback.votes,
    resolvedAt: feedback.resolvedAt,
    createdAt: feedback.createdAt,
    responses:
      feedback.responses?.map((response) => ({
        id: response.id,
        content: response.content,
        positiveReactions: response.positiveReactions,
        negativeReactions: response.negativeReactions,
        createdAt: response.createdAt,
      })) ?? [],
  }
}

function createContext({
  permissionLevel = PermissionLevel.EXECUTE,
  prisma,
}: {
  permissionLevel?: PermissionLevel | null
  prisma: Record<string, unknown>
}) {
  const publish = vi.fn()
  const emitter = new EventEmitter()
  const emit = vi.spyOn(emitter, 'emit')
  const permissionFindFirst = vi
    .fn()
    .mockResolvedValue(permissionLevel ? { permissionLevel } : null)
  const context = {
    emitter,
    prisma: {
      derivedPermission: { findFirst: permissionFindFirst },
      ...prisma,
    } as unknown as TRPCContext['prisma'],
    pubSub: { publish },
    user,
  } satisfies TRPCContext

  return {
    context,
    emit,
    permissionFindFirst,
    publish,
    prisma: context.prisma,
  }
}

describe('live quiz feedback management router', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(resolvedAt)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  test('requires execute permission before mutating feedback', async () => {
    const feedbackFindUnique = vi.fn()
    const { context, permissionFindFirst } = createContext({
      permissionLevel: null,
      prisma: {
        feedback: { findUnique: feedbackFindUnique },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.publishFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
        isPublished: true,
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })

    expect(permissionFindFirst).toHaveBeenCalledWith({
      where: {
        liveQuizId: 'quiz-1',
        userId: 'user-1',
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
    expect(feedbackFindUnique).not.toHaveBeenCalled()
  })

  test('changes settings and auto-publishes feedback when moderation is disabled', async () => {
    const { context, emit, prisma, publish } = createContext({
      prisma: {
        liveQuiz: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'quiz-1',
            isModerationEnabled: true,
            feedbacks: [baseFeedback],
          }),
          update: vi.fn().mockResolvedValue({
            id: 'quiz-1',
            isLiveQAEnabled: true,
            isConfusionFeedbackEnabled: false,
            isModerationEnabled: false,
          }),
        },
        feedback: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.changeSettings({
        id: 'quiz-1',
        isModerationEnabled: false,
      })
    ).resolves.toEqual({
      liveQuiz: {
        id: 'quiz-1',
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: false,
        isModerationEnabled: false,
      },
    })

    expect(prisma?.liveQuiz.findUnique).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      include: {
        feedbacks: {
          where: { isPublished: false },
          include: { responses: { orderBy: { createdAt: 'desc' } } },
        },
      },
    })
    expect(prisma?.feedback.updateMany).toHaveBeenCalledWith({
      where: { liveQuizId: 'quiz-1', isPublished: false },
      data: { isPublished: true },
    })
    expect(prisma?.liveQuiz.update).toHaveBeenCalledWith({
      where: { id: 'quiz-1' },
      data: {
        isLiveQAEnabled: undefined,
        isConfusionFeedbackEnabled: undefined,
        isModerationEnabled: false,
      },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackAdded,
      baseFeedback
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.liveQuizSettingsChanged,
      {
        liveQuizId: 'quiz-1',
        isLiveQAEnabled: true,
        isConfusionFeedbackEnabled: false,
      }
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'quiz-1',
    })
  })

  test('publishes feedback visibility changes through realtime events', async () => {
    const updatedFeedback = { ...baseFeedback, isPublished: true }
    const { context, emit, prisma, publish } = createContext({
      prisma: {
        feedback: {
          findUnique: vi.fn().mockResolvedValue(baseFeedback),
          update: vi.fn().mockResolvedValue(updatedFeedback),
        },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.publishFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
        isPublished: true,
      })
    ).resolves.toEqual({ feedback: expectedFeedback(updatedFeedback) })

    expect(prisma?.feedback.findUnique).toHaveBeenCalledWith({
      where: { id: 1, liveQuizId: 'quiz-1' },
    })
    expect(prisma?.feedback.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { isPublished: true },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackAdded,
      updatedFeedback
    )
    expect(emit).toHaveBeenCalledWith('invalidate', {
      typename: 'LiveQuiz',
      id: 'quiz-1',
    })
  })

  test('pins and resolves feedback with the same update events as GraphQL', async () => {
    const pinnedFeedback = { ...baseFeedback, isPinned: false }
    const resolvedFeedback = {
      ...baseFeedback,
      isResolved: true,
      resolvedAt,
    }
    const { context, prisma, publish } = createContext({
      prisma: {
        feedback: {
          findUnique: vi.fn().mockResolvedValue(baseFeedback),
          update: vi
            .fn()
            .mockResolvedValueOnce(pinnedFeedback)
            .mockResolvedValueOnce(resolvedFeedback),
        },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.pinFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
        isPinned: false,
      })
    ).resolves.toEqual({ feedback: expectedFeedback(pinnedFeedback) })
    await expect(
      caller.liveQuiz.resolveFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
        isResolved: true,
      })
    ).resolves.toEqual({ feedback: expectedFeedback(resolvedFeedback) })

    expect(prisma?.feedback.update).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { isPinned: false },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(prisma?.feedback.update).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      data: { isResolved: true, resolvedAt },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackUpdated,
      pinnedFeedback
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackPinned,
      pinnedFeedback
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackUpdated,
      resolvedFeedback
    )
  })

  test('responds to unpublished feedback by publishing, resolving, and unpinning it', async () => {
    const updatedFeedback = {
      ...baseFeedback,
      isPublished: true,
      isPinned: false,
      isResolved: true,
      resolvedAt,
    }
    const { context, prisma, publish } = createContext({
      prisma: {
        feedback: {
          findUnique: vi.fn().mockResolvedValue(baseFeedback),
          update: vi.fn().mockResolvedValue(updatedFeedback),
        },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.respondToFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
        responseContent: 'Sure.',
      })
    ).resolves.toEqual({ feedback: expectedFeedback(updatedFeedback) })

    expect(prisma?.feedback.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        isPublished: true,
        isResolved: true,
        isPinned: false,
        resolvedAt,
        responses: { create: { content: 'Sure.' } },
      },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackAdded,
      updatedFeedback
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackUpdated,
      updatedFeedback
    )
  })

  test('deletes feedback and feedback responses with realtime updates', async () => {
    const deletedFeedback = { ...baseFeedback, responses: undefined }
    const feedbackAfterResponseDeletion = {
      ...baseFeedback,
      responses: [],
    }
    const { context, prisma, publish } = createContext({
      prisma: {
        feedback: {
          findUnique: vi
            .fn()
            .mockResolvedValueOnce(baseFeedback)
            .mockResolvedValueOnce(feedbackAfterResponseDeletion),
          delete: vi.fn().mockResolvedValue(deletedFeedback),
        },
        feedbackResponse: {
          findUnique: vi.fn().mockResolvedValue({
            id: 11,
            feedbackId: 1,
          }),
          delete: vi.fn().mockResolvedValue({
            id: 11,
            feedbackId: 1,
          }),
        },
      },
    })
    const caller = appRouter.createCaller(context)

    await expect(
      caller.liveQuiz.deleteFeedback({
        id: 1,
        liveQuizId: 'quiz-1',
      })
    ).resolves.toEqual({
      feedback: expectedFeedback({ ...baseFeedback, responses: undefined }),
    })
    await expect(
      caller.liveQuiz.deleteFeedbackResponse({
        id: 11,
        liveQuizId: 'quiz-1',
      })
    ).resolves.toEqual({
      feedback: expectedFeedback(feedbackAfterResponseDeletion),
    })

    expect(prisma?.feedback.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    })
    expect(prisma?.feedbackResponse.findUnique).toHaveBeenCalledWith({
      where: { id: 11, feedback: { liveQuizId: 'quiz-1' } },
    })
    expect(prisma?.feedbackResponse.delete).toHaveBeenCalledWith({
      where: { id: 11 },
    })
    expect(prisma?.feedback.findUnique).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
    })
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackRemoved,
      deletedFeedback
    )
    expect(publish).toHaveBeenCalledWith(
      realtimeEvents.feedbackUpdated,
      feedbackAfterResponseDeletion
    )
  })
})

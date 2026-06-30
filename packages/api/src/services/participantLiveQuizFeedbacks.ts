import { UserRole, type PrismaClient } from '@klicker-uzh/prisma/client'
import {
  publishFeedbackAdded,
  publishFeedbackCreated,
} from '../realtime/events.js'
import type { TRPCContext } from '../trpc/context.js'

type FeedbackResponseSource = {
  id: number
  content: string
  positiveReactions: number
  negativeReactions: number
  createdAt?: Date | null
}

type FeedbackSource = {
  id: number
  isPublished: boolean
  isPinned: boolean
  isResolved: boolean
  content: string
  votes: number
  resolvedAt?: Date | null
  createdAt: Date
  liveQuizId?: string | null
  responses?: FeedbackResponseSource[] | null
}

function toFeedback(feedback: FeedbackSource) {
  return {
    id: feedback.id,
    isPublished: feedback.isPublished,
    isPinned: feedback.isPinned,
    isResolved: feedback.isResolved,
    content: feedback.content,
    votes: feedback.votes,
    resolvedAt: feedback.resolvedAt ?? null,
    createdAt: feedback.createdAt,
    responses:
      feedback.responses?.map((response) => ({
        id: response.id,
        content: response.content,
        positiveReactions: response.positiveReactions,
        negativeReactions: response.negativeReactions,
        createdAt: response.createdAt ?? null,
      })) ?? [],
  }
}

function emitLiveQuizInvalidation(
  emitter: TRPCContext['emitter'],
  liveQuizId: string
) {
  emitter?.emit?.('invalidate', { typename: 'LiveQuiz', id: liveQuizId })
}

export async function getLiveQuizFeedbacks({
  prisma,
  quizId,
}: {
  prisma: PrismaClient
  quizId: string
}) {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      feedbacks: {
        include: { responses: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  const feedbacks =
    quiz?.isModerationEnabled === true
      ? quiz.feedbacks.filter((feedback) => feedback.isPublished)
      : (quiz?.feedbacks ?? [])

  return { feedbacks: feedbacks.map(toFeedback) }
}

export async function createLiveQuizFeedback({
  content,
  emitter,
  prisma,
  pubSub,
  quizId,
  user,
}: {
  content: string
  emitter: TRPCContext['emitter']
  prisma: PrismaClient
  pubSub: TRPCContext['pubSub']
  quizId: string
  user: TRPCContext['user']
}) {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: quizId },
  })

  if (!quiz || !quiz.isLiveQAEnabled) return { feedback: null }

  const feedback = await prisma.feedback.create({
    data: {
      isPublished: !quiz.isModerationEnabled,
      content,
      liveQuiz: { connect: { id: quizId } },
      participant:
        user?.sub && user.role === UserRole.PARTICIPANT
          ? { connect: { id: user.sub } }
          : undefined,
    },
    include: { responses: { orderBy: { createdAt: 'desc' } } },
  })

  publishFeedbackCreated(pubSub, feedback)
  emitLiveQuizInvalidation(emitter, quizId)

  if (!quiz.isModerationEnabled) {
    publishFeedbackAdded(pubSub, feedback)
  }

  return { feedback: toFeedback(feedback) }
}

export async function upvoteLiveQuizFeedback({
  feedbackId,
  increment,
  prisma,
}: {
  feedbackId: number
  increment: number
  prisma: PrismaClient
}) {
  const feedback = await prisma.feedback.update({
    where: { id: feedbackId },
    data: { votes: { increment } },
    include: { responses: { orderBy: { createdAt: 'desc' } } },
  })

  return { feedback: toFeedback(feedback) }
}

export async function voteLiveQuizFeedbackResponse({
  id,
  incrementDownvote,
  incrementUpvote,
  prisma,
}: {
  id: number
  incrementDownvote: number
  incrementUpvote: number
  prisma: PrismaClient
}) {
  const response = await prisma.feedbackResponse.update({
    where: { id },
    data: {
      positiveReactions: { increment: incrementUpvote },
      negativeReactions: { increment: incrementDownvote },
    },
  })

  return {
    response: {
      id: response.id,
      content: response.content,
      positiveReactions: response.positiveReactions,
      negativeReactions: response.negativeReactions,
      createdAt: response.createdAt ?? null,
    },
  }
}

export async function addLiveQuizConfusionTimestep({
  difficulty,
  emitter,
  prisma,
  quizId,
  speed,
}: {
  difficulty: number
  emitter: TRPCContext['emitter']
  prisma: PrismaClient
  quizId: string
  speed: number
}) {
  const confusionTimestep = await prisma.confusionTimestep.create({
    data: {
      difficulty,
      speed,
      liveQuiz: { connect: { id: quizId } },
      createdAt: new Date(),
    },
  })

  emitLiveQuizInvalidation(emitter, quizId)

  return {
    confusionTimestep: {
      difficulty: confusionTimestep.difficulty,
      speed: confusionTimestep.speed,
      createdAt: confusionTimestep.createdAt,
    },
  }
}

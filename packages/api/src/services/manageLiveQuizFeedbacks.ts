import { type PrismaClient } from '@klicker-uzh/prisma/client'
import {
  publishFeedbackAdded,
  publishFeedbackPinned,
  publishFeedbackRemoved,
  publishFeedbackUpdated,
  publishLiveQuizSettingsChanged,
} from '../realtime/events.js'
import type { TRPCContext } from '../trpc/context.js'
import { toFeedback } from './manageLiveQuizLecturerView.js'

type ManageLiveQuizFeedbackContext = {
  emitter: TRPCContext['emitter']
  prisma: PrismaClient
  pubSub: TRPCContext['pubSub']
}

const feedbackResponsesInclude = {
  responses: { orderBy: { createdAt: 'desc' as const } },
}

function emitLiveQuizInvalidation(
  emitter: TRPCContext['emitter'],
  liveQuizId: string
) {
  emitter?.emit('invalidate', { typename: 'LiveQuiz', id: liveQuizId })
}

function toLiveQuizSettings(liveQuiz: {
  id: string
  isLiveQAEnabled: boolean
  isConfusionFeedbackEnabled: boolean
  isModerationEnabled: boolean
}) {
  return {
    id: liveQuiz.id,
    isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
    isModerationEnabled: liveQuiz.isModerationEnabled,
  }
}

export async function changeManageLiveQuizSettings({
  emitter,
  id,
  isConfusionFeedbackEnabled,
  isLiveQAEnabled,
  isModerationEnabled,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: string
  isLiveQAEnabled?: boolean
  isConfusionFeedbackEnabled?: boolean
  isModerationEnabled?: boolean
}) {
  if (isModerationEnabled === false) {
    const currentQuiz = await prisma.liveQuiz.findUnique({
      where: { id },
      include: {
        feedbacks: {
          where: { isPublished: false },
          include: feedbackResponsesInclude,
        },
      },
    })

    if (currentQuiz?.isModerationEnabled && currentQuiz.feedbacks.length > 0) {
      await prisma.feedback.updateMany({
        where: { liveQuizId: id, isPublished: false },
        data: { isPublished: true },
      })

      currentQuiz.feedbacks.forEach((feedback) => {
        publishFeedbackAdded(pubSub, feedback)
      })
    }
  }

  const liveQuiz = await prisma.liveQuiz.update({
    where: { id },
    data: {
      isLiveQAEnabled,
      isConfusionFeedbackEnabled,
      isModerationEnabled,
    },
  })

  publishLiveQuizSettingsChanged(pubSub, {
    liveQuizId: liveQuiz.id,
    isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
  })
  emitLiveQuizInvalidation(emitter, id)

  return { liveQuiz: toLiveQuizSettings(liveQuiz) }
}

export async function publishManageLiveQuizFeedback({
  emitter,
  id,
  isPublished,
  liveQuizId,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: number
  isPublished: boolean
  liveQuizId: string
}) {
  const feedback = await prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return { feedback: null }

  const updatedFeedback = await prisma.feedback.update({
    where: { id },
    data: { isPublished },
    include: feedbackResponsesInclude,
  })

  if (isPublished) {
    publishFeedbackAdded(pubSub, updatedFeedback)
  } else {
    publishFeedbackRemoved(pubSub, updatedFeedback)
  }

  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(updatedFeedback) }
}

export async function pinManageLiveQuizFeedback({
  emitter,
  id,
  isPinned,
  liveQuizId,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: number
  isPinned: boolean
  liveQuizId: string
}) {
  const feedback = await prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return { feedback: null }

  const updatedFeedback = await prisma.feedback.update({
    where: { id },
    data: { isPinned },
    include: feedbackResponsesInclude,
  })

  publishFeedbackUpdated(pubSub, updatedFeedback)
  publishFeedbackPinned(pubSub, updatedFeedback)
  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(updatedFeedback) }
}

export async function resolveManageLiveQuizFeedback({
  emitter,
  id,
  isResolved,
  liveQuizId,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: number
  isResolved: boolean
  liveQuizId: string
}) {
  const feedback = await prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return { feedback: null }

  const updatedFeedback = await prisma.feedback.update({
    where: { id },
    data: {
      isResolved,
      resolvedAt: isResolved ? new Date() : null,
    },
    include: feedbackResponsesInclude,
  })

  publishFeedbackUpdated(pubSub, updatedFeedback)
  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(updatedFeedback) }
}

export async function respondToManageLiveQuizFeedback({
  emitter,
  id,
  liveQuizId,
  prisma,
  pubSub,
  responseContent,
}: ManageLiveQuizFeedbackContext & {
  id: number
  liveQuizId: string
  responseContent: string
}) {
  const feedback = await prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return { feedback: null }

  const feedbackPublished = feedback.isPublished
  const updatedFeedback = await prisma.feedback.update({
    where: { id },
    data: {
      isPublished: true,
      isResolved: true,
      isPinned: false,
      resolvedAt: new Date(),
      responses: { create: { content: responseContent } },
    },
    include: feedbackResponsesInclude,
  })

  if (!feedbackPublished) {
    publishFeedbackAdded(pubSub, updatedFeedback)
  }
  publishFeedbackUpdated(pubSub, updatedFeedback)
  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(updatedFeedback) }
}

export async function deleteManageLiveQuizFeedback({
  emitter,
  id,
  liveQuizId,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: number
  liveQuizId: string
}) {
  const feedback = await prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return { feedback: null }

  const deletedFeedback = await prisma.feedback.delete({
    where: { id },
  })

  publishFeedbackRemoved(pubSub, deletedFeedback)
  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(deletedFeedback) }
}

export async function deleteManageLiveQuizFeedbackResponse({
  emitter,
  id,
  liveQuizId,
  prisma,
  pubSub,
}: ManageLiveQuizFeedbackContext & {
  id: number
  liveQuizId: string
}) {
  const feedbackResponse = await prisma.feedbackResponse.findUnique({
    where: { id, feedback: { liveQuizId } },
  })

  if (!feedbackResponse) return { feedback: null }

  const deletedFeedbackResponse = await prisma.feedbackResponse.delete({
    where: { id },
  })

  const updatedFeedback = await prisma.feedback.findUnique({
    where: { id: deletedFeedbackResponse.feedbackId },
    include: feedbackResponsesInclude,
  })

  if (!updatedFeedback) return { feedback: null }

  publishFeedbackUpdated(pubSub, updatedFeedback)
  emitLiveQuizInvalidation(emitter, liveQuizId)

  return { feedback: toFeedback(updatedFeedback) }
}

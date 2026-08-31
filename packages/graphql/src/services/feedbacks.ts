import * as DB from '@klicker-uzh/prisma/client'
import type { Context, ContextWithUser } from '../lib/context.js'

const activeLiveQuizCourseFilter = {
  OR: [
    { courseId: null },
    { course: { isDeleted: false, isDeletionPending: false } },
  ],
}

export async function getFeedbacks(
  { quizId }: { quizId: string },
  ctx: Context
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId, ...activeLiveQuizCourseFilter },
    include: {
      feedbacks: {
        include: { responses: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (quiz?.isModerationEnabled) {
    return quiz.feedbacks.filter((feedback) => feedback.isPublished)
  }

  return quiz?.feedbacks ?? []
}

export async function upvoteFeedback(
  { feedbackId, increment }: { feedbackId: number; increment: number },
  ctx: Context
) {
  return ctx.prisma.feedback.update({
    where: {
      id: feedbackId,
      liveQuiz: activeLiveQuizCourseFilter,
    },
    data: {
      votes: { increment: increment },
    },
  })
}

export async function voteFeedbackResponse(
  {
    id,
    incrementUpvote,
    incrementDownvote,
  }: { id: number; incrementUpvote: number; incrementDownvote: number },
  ctx: Context
) {
  return ctx.prisma.feedbackResponse.update({
    where: {
      id: id,
      feedback: { liveQuiz: activeLiveQuizCourseFilter },
    },
    data: {
      positiveReactions: { increment: incrementUpvote },
      negativeReactions: { increment: incrementDownvote },
    },
  })
}

export async function createFeedback(
  { quizId, content }: { quizId: string; content: string },
  ctx: Context
) {
  const isLoggedInParticipant =
    ctx.user?.sub && ctx.user.role === DB.UserRole.PARTICIPANT

  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: {
      id: quizId,
      ...activeLiveQuizCourseFilter,
    },
  })

  if (!quiz || !quiz.isLiveQAEnabled) return null

  const newFeedback = await ctx.prisma.feedback.create({
    data: {
      isPublished: !quiz.isModerationEnabled,
      content,
      liveQuiz: {
        connect: { id: quizId, ...activeLiveQuizCourseFilter },
      },
      participant: isLoggedInParticipant
        ? {
            connect: { id: ctx.user?.sub },
          }
        : undefined,
    },
  })

  ctx.pubSub.publish('feedbackCreated', newFeedback)
  ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id: quizId })

  if (!quiz.isModerationEnabled) {
    ctx.pubSub.publish('feedbackAdded', newFeedback)
  }

  return newFeedback
}

// add response to an existing feedback
export async function respondToFeedback(
  {
    id,
    responseContent,
    liveQuizId,
  }: { id: number; responseContent: string; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return null

  const feedbackPublished = feedback.isPublished
  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isPublished: true,
      isResolved: true,
      isPinned: false,
      resolvedAt: new Date(),
      responses: { create: { content: responseContent } },
    },
    include: { responses: true },
  })

  if (!feedbackPublished) {
    ctx.pubSub.publish('feedbackAdded', updatedFeedback)
    ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  } else {
    ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  }

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: updatedFeedback.liveQuizId,
  })

  return updatedFeedback
}

// add confusion timestep to live quiz
export async function addConfusionTimestep(
  {
    quizId,
    difficulty,
    speed,
  }: {
    quizId: string
    difficulty: number
    speed: number
  },
  ctx: Context
) {
  const confusionTS = await ctx.prisma.confusionTimestep.create({
    data: {
      difficulty,
      speed,
      liveQuiz: {
        connect: { id: quizId, ...activeLiveQuizCourseFilter },
      },
      createdAt: new Date(),
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: quizId,
  })

  return confusionTS
}

// publish / unpublish a feedback to be visible to students
export async function publishFeedback(
  {
    id,
    isPublished,
    liveQuizId,
  }: { id: number; isPublished: boolean; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: { isPublished: isPublished },
    include: { responses: true },
  })

  if (isPublished) {
    ctx.pubSub.publish('feedbackAdded', updatedFeedback)
  } else {
    ctx.pubSub.publish('feedbackRemoved', updatedFeedback)
  }

  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: updatedFeedback.liveQuizId,
  })

  return updatedFeedback
}

// pin / unpin a feedback on the lecturers running live quiz screen
export async function pinFeedback(
  {
    id,
    isPinned,
    liveQuizId,
  }: { id: number; isPinned: boolean; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: { isPinned: isPinned },
    include: { responses: true },
  })

  ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  ctx.pubSub.publish('feedbackPinned', updatedFeedback)
  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: updatedFeedback.liveQuizId,
  })

  return updatedFeedback
}

// resolve / unresolve a feedback
export async function resolveFeedback(
  {
    id,
    isResolved,
    liveQuizId,
  }: { id: number; isResolved: boolean; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: isResolved,
      resolvedAt: isResolved ? new Date() : null,
    },
    include: { responses: true },
  })

  ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: updatedFeedback.liveQuizId,
  })

  return updatedFeedback
}

// deletes a feedback (and all its responses through cascade)
export async function deleteFeedback(
  { id, liveQuizId }: { id: number; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id, liveQuizId },
  })

  if (!feedback) return null

  const deletedFeedback = await ctx.prisma.feedback.delete({
    where: { id },
  })

  ctx.pubSub.publish('feedbackRemoved', deletedFeedback)
  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: deletedFeedback.liveQuizId,
  })

  return deletedFeedback
}

// deletes a feedback response
export async function deleteFeedbackResponse(
  { id, liveQuizId }: { id: number; liveQuizId: string },
  ctx: ContextWithUser
) {
  const feedbackResponse = await ctx.prisma.feedbackResponse.findUnique({
    where: { id, feedback: { liveQuizId } },
  })

  if (!feedbackResponse) {
    return null
  }

  const deletedFeedbackResponse = await ctx.prisma.feedbackResponse.delete({
    where: { id },
  })

  const updatedFeedback = await ctx.prisma.feedback.findUnique({
    where: { id: deletedFeedbackResponse.feedbackId },
    include: { responses: true },
  })

  if (!updatedFeedback) {
    return null
  }

  ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  ctx.emitter.emit('invalidate', {
    typename: 'LiveQuiz',
    id: updatedFeedback.liveQuizId,
  })

  return updatedFeedback
}

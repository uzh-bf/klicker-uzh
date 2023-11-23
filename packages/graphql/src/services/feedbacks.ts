import { UserRole } from '@klicker-uzh/prisma'
import { Context, ContextWithUser } from '../lib/context.js'

export async function getFeedbacks({ id }: { id: string }, ctx: Context) {
  const sessionWithFeedbacks = await ctx.prisma.liveSession.findUnique({
    where: { id },
    include: {
      feedbacks: {
        include: { responses: { orderBy: { createdAt: 'desc' } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (sessionWithFeedbacks?.isModerationEnabled) {
    return sessionWithFeedbacks.feedbacks.filter(
      (feedback) => feedback.isPublished
    )
  }

  return sessionWithFeedbacks?.feedbacks ?? []
}

export async function upvoteFeedback(
  { feedbackId, increment }: { feedbackId: number; increment: number },
  ctx: Context
) {
  return ctx.prisma.feedback.update({
    where: {
      id: feedbackId,
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
    },
    data: {
      positiveReactions: { increment: incrementUpvote },
      negativeReactions: { increment: incrementDownvote },
    },
  })
}

export async function createFeedback(
  { sessionId, content }: { sessionId: string; content: string },
  ctx: Context
) {
  const isLoggedInParticipant =
    ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT

  const session = await ctx.prisma.liveSession.findUnique({
    where: {
      id: sessionId,
    },
  })

  if (!session || !session.isLiveQAEnabled) return null

  const newFeedback = await ctx.prisma.feedback.create({
    data: {
      isPublished: !session.isModerationEnabled,
      content,
      session: {
        connect: { id: sessionId },
      },
      participant: isLoggedInParticipant
        ? {
            connect: { id: ctx.user?.sub },
          }
        : undefined,
    },
  })

  ctx.pubSub.publish('feedbackCreated', newFeedback)

  ctx.emitter.emit('invalidate', { typename: 'Session', id: sessionId })

  if (!session.isModerationEnabled) {
    ctx.pubSub.publish('feedbackAdded', newFeedback)
  }

  return newFeedback
}

// add response to an existing feedback
export async function respondToFeedback(
  { id, responseContent }: { id: number; responseContent: string },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!feedback || feedback.session.ownerId !== ctx.user.sub) return null

  const feedbackPublished = feedback.isPublished
  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isPublished: true,
      isResolved: true,
      isPinned: false,
      resolvedAt: new Date(),
      responses: {
        create: {
          content: responseContent,
        },
      },
    },
    include: {
      responses: true,
    },
  })

  if (!feedbackPublished) {
    ctx.pubSub.publish('feedbackAdded', updatedFeedback)
    ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  } else {
    ctx.pubSub.publish('feedbackUpdated', updatedFeedback)
  }

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: updatedFeedback.sessionId,
  })

  return updatedFeedback
}

// add confusion timestep to session
interface AddConfusionTimestepArgs {
  sessionId: string
  difficulty: number
  speed: number
}

export async function addConfusionTimestep(
  { sessionId, difficulty, speed }: AddConfusionTimestepArgs,
  ctx: Context
) {
  const confusionTS = await ctx.prisma.confusionTimestep.create({
    data: {
      difficulty,
      speed,
      session: {
        connect: { id: sessionId },
      },
      createdAt: new Date(),
    },
  })

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: sessionId,
  })

  return confusionTS
}

// publish / unpublish a feedback to be visible to students
export async function publishFeedback(
  { id, isPublished }: { id: number; isPublished: boolean },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!feedback || feedback.session.ownerId !== ctx.user.sub) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: {
      id,
    },
    data: {
      isPublished: isPublished,
    },
    include: {
      responses: true,
    },
  })

  if (isPublished) {
    ctx.pubSub.publish('feedbackAdded', updatedFeedback)
  } else {
    ctx.pubSub.publish('feedbackRemoved', updatedFeedback)
  }

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: updatedFeedback.sessionId,
  })

  return updatedFeedback
}

// pin / unpin a feedback on the lecturers running session screen
export async function pinFeedback(
  { id, isPinned }: { id: number; isPinned: boolean },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!feedback || feedback.session.ownerId !== ctx.user.sub) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: {
      id,
    },
    data: {
      isPinned: isPinned,
    },
    include: {
      responses: true,
    },
  })

  ctx.pubSub.publish('feedbackUpdated', updatedFeedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: updatedFeedback.sessionId,
  })

  return updatedFeedback
}

// resolve / unresolve a feedback
export async function resolveFeedback(
  { id, isResolved }: { id: number; isResolved: boolean },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!feedback || feedback.session.ownerId !== ctx.user.sub) return null

  const updatedFeedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: isResolved,
      resolvedAt: isResolved ? new Date() : null,
    },
    include: {
      responses: true,
    },
  })

  ctx.pubSub.publish('feedbackUpdated', updatedFeedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: updatedFeedback.sessionId,
  })

  return updatedFeedback
}

// deletes a feedback (and all its responses through cascade)
export async function deleteFeedback(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.findUnique({
    where: { id },
    include: {
      session: true,
    },
  })

  if (!feedback || feedback.session.ownerId !== ctx.user.sub) return null

  const deletedFeedback = await ctx.prisma.feedback.delete({
    where: { id },
  })

  ctx.pubSub.publish('feedbackRemoved', deletedFeedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: deletedFeedback.sessionId,
  })

  return deletedFeedback
}

// deletes a feedback response
export async function deleteFeedbackResponse(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const feedbackResponse = await ctx.prisma.feedbackResponse.findUnique({
    where: { id },
    include: {
      feedback: {
        include: {
          session: true,
        },
      },
    },
  })

  if (
    !feedbackResponse ||
    feedbackResponse.feedback.session.ownerId !== ctx.user.sub
  )
    return null

  const deletedFeedbackResponse = await ctx.prisma.feedbackResponse.delete({
    where: { id },
    include: {
      feedback: {
        include: {
          responses: true,
        },
      },
    },
  })

  ctx.pubSub.publish('feedbackUpdated', deletedFeedbackResponse.feedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: deletedFeedbackResponse.feedback.sessionId,
  })

  return deletedFeedbackResponse.feedback
}

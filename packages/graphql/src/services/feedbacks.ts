import { UserRole } from '@klicker-uzh/prisma'
import { Context, ContextWithOptionalUser } from '../lib/context'

export async function getFeedbacks({ id }: { id: string }, ctx: Context) {
  const sessionWithFeedbacks = await ctx.prisma.session.findUnique({
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

  const session = await ctx.prisma.session.findUnique({
    where: {
      id: sessionId,
    },
  })

  if (!session || !session.isAudienceInteractionActive) return null

  const newFeedback = await ctx.prisma.feedback.create({
    data: {
      isPublished: !session.isModerationEnabled,
      content,
      session: {
        connect: { id: sessionId },
      },
      participant: isLoggedInParticipant
        ? {
            connect: { id: ctx.user!.sub },
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
  ctx: Context
) {
  const feedback = await ctx.prisma.feedback.update({
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

  ctx.pubSub.publish('feedbackUpdated', feedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedback.sessionId,
  })

  return feedback
}

// add confusion timestep to session
interface AddConfusionTimestepArgs {
  sessionId: string
  difficulty: -2 | -1 | 0 | 1 | 2
  speed: -2 | -1 | 0 | 1 | 2
}

export async function addConfusionTimestep(
  { sessionId, difficulty, speed }: AddConfusionTimestepArgs,
  ctx: ContextWithOptionalUser
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
  ctx: Context
) {
  const feedback = await ctx.prisma.feedback.update({
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
    ctx.pubSub.publish('feedbackAdded', feedback)
  } else {
    ctx.pubSub.publish('feedbackRemoved', feedback)
  }

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedback.sessionId,
  })

  return feedback
}

// pin / unpin a feedback on the lecturers running session screen
export async function pinFeedback(
  { id, isPinned }: { id: number; isPinned: boolean },
  ctx: Context
) {
  const feedback = await ctx.prisma.feedback.update({
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

  ctx.pubSub.publish('feedbackUpdated', feedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedback.sessionId,
  })

  return feedback
}

// resolve / unresolve a feedback
export async function resolveFeedback(
  { id, isResolved }: { id: number; isResolved: boolean },
  ctx: Context
) {
  const feedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: isResolved,
      resolvedAt: isResolved ? new Date() : null,
    },
    include: {
      responses: true,
    },
  })

  ctx.pubSub.publish('feedbackUpdated', feedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedback.sessionId,
  })

  return feedback
}

// deletes a feedback (and all its responses through cascade)
export async function deleteFeedback({ id }: { id: number }, ctx: Context) {
  const feedback = await ctx.prisma.feedback.delete({
    where: { id },
  })

  ctx.pubSub.publish('feedbackRemoved', { id, sessionId: feedback.sessionId })

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedback.sessionId,
  })

  return feedback
}

// deletes a feedback response
export async function deleteFeedbackResponse(
  { id }: { id: number },
  ctx: Context
) {
  const feedbackResponse = await ctx.prisma.feedbackResponse.delete({
    where: { id },
    include: {
      feedback: {
        include: {
          responses: true,
        },
      },
    },
  })

  ctx.pubSub.publish('feedbackUpdated', feedbackResponse.feedback)

  ctx.emitter.emit('invalidate', {
    typename: 'Session',
    id: feedbackResponse.feedback.sessionId,
  })

  return feedbackResponse.feedback
}

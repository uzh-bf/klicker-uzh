import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

export async function getFeedbacks(
  { id }: { id: string },
  ctx: ContextWithUser
) {
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
  ctx: ContextWithOptionalUser
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
  ctx: ContextWithOptionalUser
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
  ctx: ContextWithOptionalUser
) {
  // TODO: without accounting for the role, the user token would count as logged in
  // but no participant would match the id of the admin user...
  const isLoggedInParticipant = ctx.user?.sub && ctx.user.role === 'PARTICIPANT'

  if (isLoggedInParticipant) {
    return ctx.prisma.feedback.create({
      data: {
        content,
        session: {
          connect: { id: sessionId },
        },
        participant: {
          connect: { id: ctx.user!.sub },
        },
      },
    })
  }

  return ctx.prisma.feedback.create({
    data: {
      content,
      session: {
        connect: { id: sessionId },
      },
    },
  })
}

// add response to an existing feedback
export async function respondToFeedback(
  { id, responseContent }: { id: number; responseContent: string },
  ctx: ContextWithUser
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
  return ctx.prisma.confusionTimestep.create({
    data: {
      difficulty,
      speed,
      session: {
        connect: { id: sessionId },
      },
      createdAt: new Date(),
    },
  })
}

// publish / unpublish a feedback to be visible to students
export async function publishFeedback(
  { id, isPublished }: { id: number; isPublished: boolean },
  ctx: ContextWithUser
) {
  return ctx.prisma.feedback.update({
    where: {
      id,
    },
    data: {
      isPublished: isPublished,
    },
  })
}

// pin / unpin a feedback on the lecturers running session screen
export async function pinFeedback(
  { id, isPinned }: { id: number; isPinned: boolean },
  ctx: ContextWithUser
) {
  return ctx.prisma.feedback.update({
    where: {
      id,
    },
    data: {
      isPinned: isPinned,
    },
  })
}

// resolve / unresolve a feedback
export async function resolveFeedback(
  { id, isResolved }: { id: number; isResolved: boolean },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: isResolved,
      resolvedAt: isResolved ? new Date() : null,
    },
  })
  return feedback
}

// deletes a feedback (and all its responses through cascade)
export async function deleteFeedback(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const feedback = await ctx.prisma.feedback.delete({
    where: { id },
  })
  return feedback
}

// deletes a feedback response
export async function deleteFeedbackResponse(
  { id }: { id: number },
  ctx: ContextWithUser
) {
  const feedbackResponse = await ctx.prisma.feedbackResponse.delete({
    where: { id },
  })
  return feedbackResponse
}

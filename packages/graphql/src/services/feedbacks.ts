import { ContextWithOptionalUser, ContextWithUser } from '../lib/context'

export async function getFeedbacks(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const feedbacks = await ctx.prisma.session
    .findUnique({
      where: { id },
    })
    .feedbacks({
      where: { isPublished: true },
      include: { responses: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    })

  return feedbacks
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
  {
    sessionId,
    content,
    isPublished,
  }: { sessionId: string; content: string; isPublished: boolean },
  ctx: ContextWithOptionalUser
) {
  if (ctx.user?.sub) {
    return ctx.prisma.feedback.create({
      data: {
        content,
        isPublished: isPublished,
        session: {
          connect: { id: sessionId },
        },
        participant: {
          connect: { id: ctx.user.sub },
        },
      },
    })
  } else {
    return ctx.prisma.feedback.create({
      data: {
        content,
        isPublished: isPublished,
        session: {
          connect: { id: sessionId },
        },
      },
    })
  }
}

// add response to an existing feedback
export async function respondToFeedback(
  { id, responseContent }: { id: number; responseContent: string },
  ctx: ContextWithOptionalUser
) {
  const feedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: true,
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

// change value of isResolved property of feedback
export async function resolveFeedback(
  { id, newValue }: { id: number; newValue: boolean },
  ctx: ContextWithOptionalUser
) {
  const feedback = await ctx.prisma.feedback.update({
    where: { id },
    data: {
      isResolved: newValue,
      resolvedAt: new Date(),
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
  if (ctx.user?.sub) {
    return ctx.prisma.confusionTimestep.create({
      data: {
        difficulty,
        speed,
        session: {
          connect: { id: sessionId },
        },
        participant: {
          connect: { id: ctx.user.sub },
        },
        createdAt: new Date(),
      },
    })
  } else {
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
}

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

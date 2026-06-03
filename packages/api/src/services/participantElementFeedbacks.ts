import type { ElementFeedback, PrismaClient } from '@klicker-uzh/prisma/client'

type ElementFeedbackSource = Pick<
  ElementFeedback,
  'downvote' | 'elementInstanceId' | 'feedback' | 'id' | 'upvote'
>

function toElementFeedback(feedback: ElementFeedbackSource) {
  return {
    id: feedback.id,
    elementInstanceId: feedback.elementInstanceId,
    upvote: feedback.upvote,
    downvote: feedback.downvote,
    feedback: feedback.feedback,
  }
}

const elementFeedbackSelect = {
  id: true,
  elementInstanceId: true,
  upvote: true,
  downvote: true,
  feedback: true,
}

export async function getStackElementFeedbacks({
  instanceIds,
  participantId,
  prisma,
}: {
  instanceIds: number[]
  participantId: string
  prisma: PrismaClient
}) {
  const elementFeedbacks = await prisma.elementFeedback.findMany({
    where: {
      elementInstanceId: {
        in: instanceIds,
      },
      participantId,
    },
    select: elementFeedbackSelect,
  })

  return elementFeedbacks.map(toElementFeedback)
}

export async function rateElement({
  elementId,
  elementInstanceId,
  participantId,
  prisma,
  rating,
}: {
  elementId: number
  elementInstanceId: number
  participantId: string
  prisma: PrismaClient
  rating: number
}) {
  if (rating !== 1 && rating !== -1) {
    return null
  }

  const elementFeedback = await prisma.$transaction(async (tx) => {
    const prevFeedback = await tx.elementFeedback.findUnique({
      where: {
        participantId_elementInstanceId: {
          participantId,
          elementInstanceId,
        },
      },
      select: {
        upvote: true,
        downvote: true,
      },
    })

    const nextFeedback = prevFeedback
      ? await tx.elementFeedback.update({
          where: {
            participantId_elementInstanceId: {
              participantId,
              elementInstanceId,
            },
          },
          data: {
            upvote: rating === 1,
            downvote: rating === -1,
          },
          select: elementFeedbackSelect,
        })
      : await tx.elementFeedback.create({
          data: {
            upvote: rating === 1,
            downvote: rating === -1,
            elementInstance: { connect: { id: elementInstanceId } },
            element: { connect: { id: elementId } },
            participant: { connect: { id: participantId } },
          },
          select: elementFeedbackSelect,
        })

    await tx.instanceStatistics.update({
      where: { elementInstanceId },
      data: {
        upvoteCount: {
          increment:
            Number(rating === 1) -
            (prevFeedback ? Number(prevFeedback.upvote) : 0),
        },
        downvoteCount: {
          increment:
            Number(rating === -1) -
            (prevFeedback ? Number(prevFeedback.downvote) : 0),
        },
      },
    })

    return nextFeedback
  })

  return toElementFeedback(elementFeedback)
}

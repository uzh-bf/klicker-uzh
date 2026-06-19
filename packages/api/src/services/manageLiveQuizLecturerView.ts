import {
  PublicationStatus,
  type ConfusionTimestep,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'

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
  responses?: FeedbackResponseSource[] | null
}

function aggregateFeedbacks(
  feedbacks: Pick<ConfusionTimestep, 'createdAt' | 'difficulty' | 'speed'>[]
) {
  const recentFeedbacks = feedbacks.filter((feedback) => {
    const diff = dayjs().diff(dayjs(feedback.createdAt))
    return diff > 0 && diff < 1000 * 60 * 10
  })

  if (recentFeedbacks.length === 0) {
    return { speed: 0, difficulty: 0, numberOfParticipants: 0 }
  }

  const summedFeedbacks = recentFeedbacks.reduce(
    (previousValue, feedback) => ({
      speed: previousValue.speed + feedback.speed,
      difficulty: previousValue.difficulty + feedback.difficulty,
      numberOfParticipants: previousValue.numberOfParticipants + 1,
    }),
    { speed: 0, difficulty: 0, numberOfParticipants: 0 }
  )

  return {
    ...summedFeedbacks,
    speed: summedFeedbacks.speed / summedFeedbacks.numberOfParticipants,
    difficulty:
      summedFeedbacks.difficulty / summedFeedbacks.numberOfParticipants,
  }
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

export async function getLecturerViewLiveQuiz({
  id,
  prisma,
}: {
  id: string
  prisma: PrismaClient
}) {
  const liveQuiz = await prisma.liveQuiz.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      isLiveQAEnabled: true,
      isConfusionFeedbackEnabled: true,
      isModerationEnabled: true,
      isGamificationEnabled: true,
      confusionFeedbacks: {
        select: {
          speed: true,
          difficulty: true,
          createdAt: true,
        },
      },
      feedbacks: {
        where: { isPinned: true },
        select: {
          id: true,
          isPublished: true,
          isPinned: true,
          isResolved: true,
          content: true,
          votes: true,
          resolvedAt: true,
          createdAt: true,
          responses: {
            select: {
              id: true,
              content: true,
              positiveReactions: true,
              negativeReactions: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
  })

  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    return null
  }

  return {
    id: liveQuiz.id,
    isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
    isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
    isModerationEnabled: liveQuiz.isModerationEnabled,
    isGamificationEnabled: liveQuiz.isGamificationEnabled,
    confusionSummary: aggregateFeedbacks(liveQuiz.confusionFeedbacks),
    feedbacks: liveQuiz.feedbacks.map(toFeedback),
  }
}

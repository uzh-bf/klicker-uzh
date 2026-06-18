import type * as DB from '@klicker-uzh/prisma/client'
import type {
  ActivityQuizAnalytics,
  ElementData,
  InstanceQuizAnalytics,
} from '@klicker-uzh/types'
import { ActivityType } from '@klicker-uzh/types'

type ActivityPerformanceSource = Pick<
  DB.ActivityPerformance,
  | 'firstCorrectRate'
  | 'firstErrorRate'
  | 'firstPartialRate'
  | 'id'
  | 'lastCorrectRate'
  | 'lastErrorRate'
  | 'lastPartialRate'
  | 'totalCorrectRate'
  | 'totalErrorRate'
  | 'totalPartialRate'
>

type InstancePerformanceSource = Pick<
  DB.InstancePerformance,
  | 'averageTimeSpent'
  | 'firstCorrectRate'
  | 'firstErrorRate'
  | 'firstPartialRate'
  | 'id'
  | 'lastCorrectRate'
  | 'lastErrorRate'
  | 'lastPartialRate'
  | 'responseCount'
  | 'totalCorrectRate'
  | 'totalErrorRate'
  | 'totalPartialRate'
>

type ActivityAnalyticsElementSource = {
  elementData: ElementData
  feedbacks: Pick<DB.ElementFeedback, 'downvote' | 'upvote'>[]
  instancePerformance: InstancePerformanceSource | null
  _count: {
    detailResponses: number
  }
}

type ActivityAnalyticsSource = {
  name: string
  course: {
    _count: {
      participations: number
    }
  }
  performance: ActivityPerformanceSource | null
  stacks: {
    elements: ActivityAnalyticsElementSource[]
  }[]
}

function toActivityQuizAnalytics(
  performance: ActivityPerformanceSource,
  {
    averageTimeSpent,
    numberOfAnswers,
  }: {
    averageTimeSpent: number
    numberOfAnswers: number
  }
): ActivityQuizAnalytics {
  return {
    id: performance.id,
    numberOfAnswers,
    averageTimeSpent,
    firstErrorRate: performance.firstErrorRate,
    firstPartialRate: performance.firstPartialRate,
    firstCorrectRate: performance.firstCorrectRate,
    lastErrorRate: performance.lastErrorRate,
    lastPartialRate: performance.lastPartialRate,
    lastCorrectRate: performance.lastCorrectRate,
    totalErrorRate: performance.totalErrorRate,
    totalPartialRate: performance.totalPartialRate,
    totalCorrectRate: performance.totalCorrectRate,
  }
}

function toInstanceQuizAnalytics({
  element,
  performance,
  upvoteRate,
  downvoteRate,
  feedbackCount,
  numberOfAnswers,
}: {
  element: ActivityAnalyticsElementSource
  performance: InstancePerformanceSource
  upvoteRate: number
  downvoteRate: number
  feedbackCount: number
  numberOfAnswers: number
}): InstanceQuizAnalytics {
  return {
    id: performance.id,
    elementName: element.elementData.name,
    elementType: element.elementData.type,
    numberOfAnswers,
    uniqueParticipants: performance.responseCount,
    averageTimeSpent: performance.averageTimeSpent,
    firstErrorRate: performance.firstErrorRate,
    firstPartialRate: performance.firstPartialRate,
    firstCorrectRate: performance.firstCorrectRate,
    lastErrorRate: performance.lastErrorRate,
    lastPartialRate: performance.lastPartialRate,
    lastCorrectRate: performance.lastCorrectRate,
    totalErrorRate: performance.totalErrorRate,
    totalPartialRate: performance.totalPartialRate,
    totalCorrectRate: performance.totalCorrectRate,
    upvoteRate,
    downvoteRate,
    feedbackCount,
  }
}

export function toActivityAnalytics(
  activity: ActivityAnalyticsSource | null,
  activityType: ActivityType.PRACTICE_QUIZ | ActivityType.MICRO_LEARNING
) {
  if (!activity) return null

  const analytics = activity.stacks.reduce<{
    instanceQuizAnalytics: InstanceQuizAnalytics[]
    numberOfAnswersActivity: number
    totalAverageInstanceTimes: number
  }>(
    (acc, stack) => {
      const instanceAnalytics = stack.elements.flatMap((element) => {
        const performance = element.instancePerformance
        if (!performance) return []

        const numberOfAnswers = element._count.detailResponses
        const { upvoteRate, downvoteRate, totalVotes } =
          element.feedbacks.reduce<{
            upvoteRate: number
            downvoteRate: number
            totalVotes: number
          }>(
            (votes, feedback) => {
              if (feedback.upvote) {
                votes.upvoteRate =
                  (votes.upvoteRate * votes.totalVotes + 1) /
                  (votes.totalVotes + 1)
                votes.totalVotes++
              } else if (feedback.downvote) {
                votes.downvoteRate =
                  (votes.downvoteRate * votes.totalVotes + 1) /
                  (votes.totalVotes + 1)
                votes.totalVotes++
              }

              return votes
            },
            {
              upvoteRate: 0,
              downvoteRate: 0,
              totalVotes: 0,
            }
          )

        acc.numberOfAnswersActivity += numberOfAnswers
        acc.totalAverageInstanceTimes += performance.averageTimeSpent

        return toInstanceQuizAnalytics({
          element,
          performance,
          upvoteRate,
          downvoteRate,
          feedbackCount: totalVotes,
          numberOfAnswers,
        })
      })

      acc.instanceQuizAnalytics.push(...instanceAnalytics)
      return acc
    },
    {
      instanceQuizAnalytics: [],
      numberOfAnswersActivity: 0,
      totalAverageInstanceTimes: 0,
    }
  )

  return {
    activityName: activity.name,
    activityType,
    courseParticipants: activity.course._count.participations,
    activityQuizAnalytics: activity.performance
      ? toActivityQuizAnalytics(activity.performance, {
          numberOfAnswers: analytics.numberOfAnswersActivity,
          averageTimeSpent: analytics.totalAverageInstanceTimes,
        })
      : null,
    instanceQuizAnalytics: analytics.instanceQuizAnalytics,
  }
}

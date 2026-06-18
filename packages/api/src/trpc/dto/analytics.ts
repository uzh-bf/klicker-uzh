import type * as DB from '@klicker-uzh/prisma/client'
import type {
  ActivityFeedback,
  ActivityPerformance,
  ActivityQuizAnalytics,
  ElementData,
  InstanceFeedback,
  InstancePerformance,
  InstanceQuizAnalytics,
  ParticipantActivityPerformance,
  ParticipantPerformance,
} from '@klicker-uzh/types'
import { ActivityType } from '@klicker-uzh/types'
import dayjs from 'dayjs'

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

type ParticipantActivityTimestamp = {
  date: Date
  activeParticipants: number
}

type WeekdayActivityAnalytics = {
  monday: number
  tuesday: number
  wednesday: number
  thursday: number
  friday: number
  saturday: number
  sunday: number
}

type ParticipantCourseActivity = Pick<
  DB.ParticipantCourseAnalytics,
  'activeDaysPerWeek' | 'activeWeeks' | 'activityLevel' | 'meanElementsPerDay'
>

type CourseActivityAnalyticsSource = Pick<
  DB.Course,
  'endDate' | 'name' | 'startDate'
> & {
  participations: unknown[]
  aggregatedAnalytics: Pick<
    DB.AggregatedAnalytics,
    'participantCount' | 'timestamp' | 'type'
  >[]
  aggregatedCourseAnalytics: Pick<
    DB.AggregatedCourseAnalytics,
    | 'activityFriday'
    | 'activityMonday'
    | 'activitySaturday'
    | 'activitySunday'
    | 'activityThursday'
    | 'activityTuesday'
    | 'activityWednesday'
  > | null
  participantCourseAnalytics: ParticipantCourseActivity[]
}

type CourseWeeklyActivitySource = {
  participations: unknown[]
  aggregatedAnalytics: Pick<
    DB.AggregatedAnalytics,
    'participantCount' | 'timestamp'
  >[]
}

type ActivityProgressAnalytics = {
  activityName: string
  activityType: ActivityType
  startedCount: number
  completedCount: number
  repeatedCount: number | null
}

type ActivityPerformanceAnalytics = ActivityPerformance & {
  __typename: 'ActivityPerformance'
}

type InstancePerformanceAnalytics = InstancePerformance & {
  __typename: 'InstancePerformance'
}

type ParticipantPerformanceAnalytics = ParticipantPerformance & {
  __typename: 'ParticipantPerformance'
}

type ActivityFeedbackAnalytics = ActivityFeedback & {
  __typename: 'ActivityFeedback'
}

type InstanceFeedbackAnalytics = InstanceFeedback & {
  __typename: 'InstanceFeedback'
}

type CoursePerformanceElementSource = {
  id: number
  elementData: ElementData
  feedbacks: Pick<DB.ElementFeedback, 'downvote' | 'upvote'>[]
  instancePerformance: InstancePerformanceSource | null
}

type CoursePerformanceActivitySource = Pick<DB.PracticeQuiz, 'id' | 'name'> & {
  progress: Pick<
    DB.ActivityProgress,
    | 'completedCount'
    | 'microLearningId'
    | 'practiceQuizId'
    | 'repeatedCount'
    | 'startedCount'
  > | null
  performance: ActivityPerformanceSource | null
  participantPerformances: (Pick<
    DB.ParticipantActivityPerformance,
    'completion' | 'id' | 'totalScore'
  > & {
    participant: Pick<DB.Participant, 'email' | 'id' | 'username'>
  })[]
  stacks: {
    elements: CoursePerformanceElementSource[]
  }[]
}

type CoursePerformanceAnalyticsSource = Pick<DB.Course, 'name'> & {
  _count: {
    participations: number
  }
  practiceQuizzes: CoursePerformanceActivitySource[]
  microLearnings: CoursePerformanceActivitySource[]
  participantPerformances: Pick<
    DB.ParticipantPerformance,
    | 'firstErrorRate'
    | 'firstPerformance'
    | 'id'
    | 'lastErrorRate'
    | 'lastPerformance'
    | 'totalErrorRate'
    | 'totalPerformance'
  >[]
}

function toParticipantActivityTimestamp(
  analytics: Pick<DB.AggregatedAnalytics, 'participantCount' | 'timestamp'>
): ParticipantActivityTimestamp {
  return {
    date: analytics.timestamp,
    activeParticipants: analytics.participantCount,
  }
}

function getCourseWeeks(course: Pick<DB.Course, 'endDate' | 'startDate'>) {
  return Math.ceil(
    dayjs(
      course.endDate && dayjs(course.endDate).isBefore(dayjs())
        ? course.endDate
        : dayjs()
    ).diff(dayjs(course.startDate), 'week', true)
  )
}

export function toCourseActivityAnalytics(
  course: CourseActivityAnalyticsSource | null
) {
  if (!course) return null

  return {
    name: course.name,
    courseWeeks: getCourseWeeks(course),
    totalParticipants: course.participations.length,
    dailyActivity: course.aggregatedAnalytics
      .filter((analytics) => analytics.type === 'DAILY')
      .map(toParticipantActivityTimestamp),
    weeklyActivity: course.aggregatedAnalytics
      .filter((analytics) => analytics.type === 'WEEKLY')
      .map(toParticipantActivityTimestamp),
    activeDays: {
      monday: course.aggregatedCourseAnalytics?.activityMonday ?? 0,
      tuesday: course.aggregatedCourseAnalytics?.activityTuesday ?? 0,
      wednesday: course.aggregatedCourseAnalytics?.activityWednesday ?? 0,
      thursday: course.aggregatedCourseAnalytics?.activityThursday ?? 0,
      friday: course.aggregatedCourseAnalytics?.activityFriday ?? 0,
      saturday: course.aggregatedCourseAnalytics?.activitySaturday ?? 0,
      sunday: course.aggregatedCourseAnalytics?.activitySunday ?? 0,
    } satisfies WeekdayActivityAnalytics,
    participantCourseAnalytics: course.participantCourseAnalytics.map(
      (analytics) => ({
        activeWeeks: analytics.activeWeeks,
        activeDaysPerWeek: analytics.activeDaysPerWeek,
        meanElementsPerDay: analytics.meanElementsPerDay,
        activityLevel: analytics.activityLevel,
      })
    ),
  }
}

export function toCourseWeeklyActivity(
  course: CourseWeeklyActivitySource | null
) {
  if (!course) return null

  return {
    totalParticipants: course.participations.length,
    weeklyActivity: course.aggregatedAnalytics.map(
      toParticipantActivityTimestamp
    ),
  }
}

function toPerformanceRates(
  performance: ActivityPerformanceSource | InstancePerformanceSource
) {
  return {
    firstErrorRate: performance.firstErrorRate ?? performance.totalErrorRate,
    lastErrorRate: performance.lastErrorRate ?? performance.totalErrorRate,
    errorRate: performance.totalErrorRate,
    firstPartialRate:
      performance.firstPartialRate ?? performance.totalPartialRate,
    lastPartialRate:
      performance.lastPartialRate ?? performance.totalPartialRate,
    partialRate: performance.totalPartialRate,
    firstCorrectRate:
      performance.firstCorrectRate ?? performance.totalCorrectRate,
    lastCorrectRate:
      performance.lastCorrectRate ?? performance.totalCorrectRate,
    correctRate: performance.totalCorrectRate,
  }
}

function aggregateInstanceFeedbacks({
  stacks,
  activityType,
}: {
  stacks: { elements: CoursePerformanceElementSource[] }[]
  activityType: ActivityType
}): InstanceFeedbackAnalytics[] {
  return stacks
    .flatMap((stack) =>
      stack.elements.flatMap((element) =>
        element.feedbacks.reduce<{
          id: number
          instanceName: string
          instanceType: DB.ElementType
          upvotes: number
          downvotes: number
          totalVotes: number
        }>(
          (acc, feedback) => {
            if (feedback.upvote) {
              acc.upvotes++
              acc.totalVotes++
            }
            if (feedback.downvote) {
              acc.downvotes++
              acc.totalVotes++
            }

            return acc
          },
          {
            id: element.id,
            instanceName: element.elementData.name,
            instanceType: element.elementData.type,
            upvotes: 0,
            downvotes: 0,
            totalVotes: 0,
          }
        )
      )
    )
    .flatMap((instanceFeedback) => {
      if (instanceFeedback.totalVotes === 0) return []

      return {
        __typename: 'InstanceFeedback' as const,
        id: instanceFeedback.id,
        activityType,
        instanceName: instanceFeedback.instanceName,
        instanceType: instanceFeedback.instanceType,
        upvoteRate: instanceFeedback.upvotes / instanceFeedback.totalVotes,
        downvoteRate: instanceFeedback.downvotes / instanceFeedback.totalVotes,
        feedbackCount: instanceFeedback.totalVotes,
      }
    })
}

function aggregateActivityFeedback({
  instanceFeedbacks,
  activityType,
  activityId,
  activityName,
}: {
  instanceFeedbacks: InstanceFeedbackAnalytics[]
  activityType: ActivityType
  activityId: string
  activityName: string
}): ActivityFeedbackAnalytics | undefined {
  if (instanceFeedbacks.length === 0) return undefined

  return instanceFeedbacks.reduce<ActivityFeedbackAnalytics>(
    (acc, instanceFeedback) => {
      if (
        instanceFeedback.upvoteRate === 0 &&
        instanceFeedback.downvoteRate === 0
      ) {
        return acc
      }

      acc.upvoteRate =
        (acc.upvoteRate * acc.feedbackCount + instanceFeedback.upvoteRate) /
        (acc.feedbackCount + 1)
      acc.downvoteRate =
        (acc.downvoteRate * acc.feedbackCount + instanceFeedback.downvoteRate) /
        (acc.feedbackCount + 1)
      acc.feedbackCount++

      return acc
    },
    {
      __typename: 'ActivityFeedback',
      id: activityId,
      activityType,
      activityName,
      upvoteRate: 0,
      downvoteRate: 0,
      feedbackCount: 0,
    }
  )
}

function computeActivityInstanceFeedbacks({
  course,
}: {
  course: Pick<
    CoursePerformanceAnalyticsSource,
    'microLearnings' | 'practiceQuizzes'
  >
}) {
  const instanceFeedbacks: InstanceFeedbackAnalytics[] = []
  const activityFeedbacks: ActivityFeedbackAnalytics[] = []

  course.practiceQuizzes.forEach((quiz) => {
    const quizInstanceFeedbacks = aggregateInstanceFeedbacks({
      stacks: quiz.stacks,
      activityType: ActivityType.PRACTICE_QUIZ,
    })
    instanceFeedbacks.push(...quizInstanceFeedbacks)

    const activityFeedback = aggregateActivityFeedback({
      instanceFeedbacks: quizInstanceFeedbacks,
      activityType: ActivityType.PRACTICE_QUIZ,
      activityId: quiz.id,
      activityName: quiz.name,
    })
    if (activityFeedback) activityFeedbacks.push(activityFeedback)
  })

  course.microLearnings.forEach((micro) => {
    const microInstanceFeedbacks = aggregateInstanceFeedbacks({
      stacks: micro.stacks,
      activityType: ActivityType.MICRO_LEARNING,
    })
    instanceFeedbacks.push(...microInstanceFeedbacks)

    const activityFeedback = aggregateActivityFeedback({
      instanceFeedbacks: microInstanceFeedbacks,
      activityType: ActivityType.MICRO_LEARNING,
      activityId: micro.id,
      activityName: micro.name,
    })
    if (activityFeedback) activityFeedbacks.push(activityFeedback)
  })

  instanceFeedbacks.sort((a, b) => b.feedbackCount - a.feedbackCount)
  activityFeedbacks.sort((a, b) => b.feedbackCount - a.feedbackCount)

  return { instanceFeedbacks, activityFeedbacks }
}

function computeActivityInstancePerformance({
  course,
}: {
  course: Pick<
    CoursePerformanceAnalyticsSource,
    'microLearnings' | 'practiceQuizzes'
  >
}) {
  const activityInstanceAnalytics = [
    ...course.practiceQuizzes,
    ...course.microLearnings,
  ].reduce<{
    activityProgresses: ActivityProgressAnalytics[]
    activityPerformances: ActivityPerformanceAnalytics[]
    instancePerformances: InstancePerformanceAnalytics[]
  }>(
    (acc, activity) => {
      const progress = activity.progress
      const performance = activity.performance

      if (!progress) return acc

      const activityType =
        progress.practiceQuizId !== null
          ? ActivityType.PRACTICE_QUIZ
          : ActivityType.MICRO_LEARNING

      acc.activityProgresses.push({
        activityName: activity.name,
        activityType,
        startedCount: progress.startedCount,
        completedCount: progress.completedCount,
        repeatedCount: progress.repeatedCount,
      })

      if (!performance) return acc

      acc.activityPerformances.push({
        __typename: 'ActivityPerformance',
        id: performance.id,
        activityName: activity.name,
        activityType,
        rates: toPerformanceRates(performance),
      })

      const instancePerformances = activity.stacks.flatMap((stack) =>
        stack.elements.flatMap((element) => {
          const iPerformance = element.instancePerformance
          if (!iPerformance) return []

          return {
            __typename: 'InstancePerformance' as const,
            id: iPerformance.id,
            elementName: element.elementData.name,
            elementType: element.elementData.type,
            rates: toPerformanceRates(iPerformance),
          }
        })
      )
      acc.instancePerformances.push(...instancePerformances)

      return acc
    },
    {
      activityProgresses: [],
      activityPerformances: [],
      instancePerformances: [],
    }
  )

  const participantActivityObject = [
    ...course.practiceQuizzes,
    ...course.microLearnings,
  ].reduce<
    Record<
      string,
      {
        participantUsername: string
        participantEmail: string | null
        activityPerformances: ParticipantActivityPerformance[]
      }
    >
  >((acc, activity) => {
    activity.participantPerformances.forEach((performance) => {
      const performanceEntry = {
        id: performance.id,
        totalScore: performance.totalScore,
        completion: performance.completion,
        activityId: activity.id,
      }

      if (!acc[performance.participant.id]) {
        acc[performance.participant.id] = {
          participantUsername: performance.participant.username,
          participantEmail: performance.participant.email,
          activityPerformances: [performanceEntry],
        }
      } else {
        acc[performance.participant.id]!.activityPerformances.push(
          performanceEntry
        )
      }
    })

    return acc
  }, {})

  const participantActivityPerformances = Object.entries(
    participantActivityObject
  ).map(([participantId, entry]) => ({
    participantId,
    participantUsername: entry.participantUsername,
    participantEmail: entry.participantEmail,
    performances: entry.activityPerformances,
  }))

  return { ...activityInstanceAnalytics, participantActivityPerformances }
}

export function toCoursePerformanceAnalytics(
  course: CoursePerformanceAnalyticsSource | null
) {
  if (!course) return null

  if (
    course.practiceQuizzes.length === 0 &&
    course.microLearnings.length === 0
  ) {
    return {
      name: course.name,
      totalParticipants: course._count.participations,
      activityProgresses: [],
      activityPerformances: [],
      participantActivityPerformances: [],
      instancePerformances: [],
      participantPerformances: course.participantPerformances.map(
        (performance): ParticipantPerformanceAnalytics => ({
          __typename: 'ParticipantPerformance',
          id: performance.id,
          firstErrorRate: performance.firstErrorRate,
          firstPerformance: performance.firstPerformance,
          lastErrorRate: performance.lastErrorRate,
          lastPerformance: performance.lastPerformance,
          totalErrorRate: performance.totalErrorRate,
          totalPerformance: performance.totalPerformance,
        })
      ),
      instanceFeedbacks: [],
      activityFeedbacks: [],
    }
  }

  const {
    activityProgresses,
    activityPerformances,
    participantActivityPerformances,
    instancePerformances,
  } = computeActivityInstancePerformance({ course })
  const { instanceFeedbacks, activityFeedbacks } =
    computeActivityInstanceFeedbacks({ course })

  return {
    name: course.name,
    totalParticipants: course._count.participations,
    activityProgresses,
    activityPerformances,
    participantActivityPerformances,
    instancePerformances,
    participantPerformances: course.participantPerformances.map(
      (performance): ParticipantPerformanceAnalytics => ({
        __typename: 'ParticipantPerformance',
        id: performance.id,
        firstErrorRate: performance.firstErrorRate,
        firstPerformance: performance.firstPerformance,
        lastErrorRate: performance.lastErrorRate,
        lastPerformance: performance.lastPerformance,
        totalErrorRate: performance.totalErrorRate,
        totalPerformance: performance.totalPerformance,
      })
    ),
    instanceFeedbacks,
    activityFeedbacks,
  }
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

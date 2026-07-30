import { ContextWithUser } from '@/lib/context.js'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ActivityFeedback,
  ActivityPerformance,
  ActivityType,
  InstanceFeedback,
  InstancePerformance,
  InstanceQuizAnalytics,
  ParticipantActivityPerformance,
} from '@klicker-uzh/types'
import { isActivityEligibleForLearningAnalytics } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import {
  LEARNING_ANALYTICS_DISCLOSURE_VERSION,
  isLearningAnalyticsRolloutEnabled,
  learningAnalyticsParticipationWhere,
} from '../lib/learningAnalytics.js'

type LearningAnalyticsFeedback = Pick<
  DB.ElementFeedback,
  'id' | 'upvote' | 'downvote' | 'participantId' | 'createdAt'
>

const learningAnalyticsFeedbackSelect = {
  id: true,
  upvote: true,
  downvote: true,
  participantId: true,
  createdAt: true,
} satisfies DB.Prisma.ElementFeedbackSelect

async function filterEligibleLearningAnalyticsActivity<
  T extends { participantId: string; createdAt: Date },
>(records: T[], courseId: string, ctx: ContextWithUser): Promise<T[]> {
  if (records.length === 0) {
    return []
  }

  const participations = await ctx.prisma.participation.findMany({
    where: {
      ...learningAnalyticsParticipationWhere(courseId),
      participantId: {
        in: [...new Set(records.map((record) => record.participantId))],
      },
    },
  })
  const participationByParticipantId = new Map(
    participations.map((participation) => [
      participation.participantId,
      participation,
    ])
  )

  return records.filter((record) => {
    const participation = participationByParticipantId.get(record.participantId)
    return (
      participation !== undefined &&
      isActivityEligibleForLearningAnalytics({
        isCourseEnabled: true,
        participationStatus: participation.learningAnalyticsStatus,
        acknowledgedDisclosureVersion:
          participation.learningAnalyticsDisclosureVersion,
        currentDisclosureVersion: LEARNING_ANALYTICS_DISCLOSURE_VERSION,
        includedFrom: participation.learningAnalyticsIncludedFrom,
        activityAt: record.createdAt,
      })
    )
  })
}

async function filterCourseFeedbacksForLearningAnalytics<
  T extends {
    practiceQuizzes: {
      stacks: {
        elements: {
          elementData: { type: DB.ElementType }
          feedbacks: LearningAnalyticsFeedback[]
        }[]
      }[]
    }[]
    microLearnings: {
      stacks: {
        elements: {
          elementData: { type: DB.ElementType }
          feedbacks: LearningAnalyticsFeedback[]
        }[]
      }[]
    }[]
  },
>(course: T, courseId: string, ctx: ContextWithUser): Promise<T> {
  const elements = [
    ...course.practiceQuizzes,
    ...course.microLearnings,
  ].flatMap((activity) => activity.stacks.flatMap((stack) => stack.elements))
  const eligibleFeedbacks = await filterEligibleLearningAnalyticsActivity(
    elements.flatMap((element) =>
      element.elementData.type === DB.ElementType.FREE_TEXT
        ? []
        : element.feedbacks
    ),
    courseId,
    ctx
  )
  const eligibleFeedbackIds = new Set(
    eligibleFeedbacks.map((feedback) => feedback.id)
  )
  elements.forEach((element) => {
    element.feedbacks =
      element.elementData.type === DB.ElementType.FREE_TEXT
        ? []
        : element.feedbacks.filter((feedback) =>
            eligibleFeedbackIds.has(feedback.id)
          )
  })
  return course
}

export async function getCourseActivityAnalytics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  if (!isLearningAnalyticsRolloutEnabled()) {
    return null
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, isLearningAnalyticsEnabled: true },
    include: {
      participations: {
        where: learningAnalyticsParticipationWhere(courseId),
      },
      aggregatedAnalytics: {
        orderBy: { timestamp: 'asc' },
      },
      aggregatedCourseAnalytics: true,
      participantCourseAnalytics: {
        where: {
          participant: {
            participations: {
              some: learningAnalyticsParticipationWhere(courseId),
            },
          },
        },
      },
    },
  })

  if (!course) {
    return null
  }

  // map daily and weekly student activity into the format required by the frontend
  const dailyActivity = course.aggregatedAnalytics
    .filter((analytics) => analytics.type === 'DAILY')
    .map((analytics) => ({
      date: analytics.timestamp,
      activeParticipants: analytics.participantCount,
    }))
  const weeklyActivity = course.aggregatedAnalytics
    .filter((analytics) => analytics.type === 'WEEKLY')
    .map((analytics) => ({
      date: analytics.timestamp,
      activeParticipants: analytics.participantCount,
    }))

  // compute the duration of the course in weeks (until current date, if course is still running)
  const courseWeeks = Math.ceil(
    dayjs(
      course.endDate && dayjs(course.endDate).isBefore(dayjs())
        ? course.endDate
        : dayjs()
    ).diff(dayjs(course.startDate), 'week', true)
  )

  return {
    name: course.name,
    courseWeeks,
    totalParticipants: course.participations.length,
    dailyActivity,
    weeklyActivity,
    activeDays: {
      monday: course.aggregatedCourseAnalytics?.activityMonday ?? 0,
      tuesday: course.aggregatedCourseAnalytics?.activityTuesday ?? 0,
      wednesday: course.aggregatedCourseAnalytics?.activityWednesday ?? 0,
      thursday: course.aggregatedCourseAnalytics?.activityThursday ?? 0,
      friday: course.aggregatedCourseAnalytics?.activityFriday ?? 0,
      saturday: course.aggregatedCourseAnalytics?.activitySaturday ?? 0,
      sunday: course.aggregatedCourseAnalytics?.activitySunday ?? 0,
    },
    participantCourseAnalytics: course.participantCourseAnalytics,
  }
}

export async function getCourseWeeklyActivity(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  if (!isLearningAnalyticsRolloutEnabled()) {
    return null
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, isLearningAnalyticsEnabled: true },
    include: {
      participations: {
        where: learningAnalyticsParticipationWhere(courseId),
      },
      aggregatedAnalytics: {
        where: { type: 'WEEKLY' },
        orderBy: { timestamp: 'asc' },
      },
    },
  })

  if (!course) {
    return null
  }

  const weeklyActivity = course.aggregatedAnalytics.map((analytics) => ({
    date: analytics.timestamp,
    activeParticipants: analytics.participantCount,
  }))

  return { totalParticipants: course.participations.length, weeklyActivity }
}

// this function compute the upvote and downvote rates based on the element responses linked to instances in the course
function aggregateInstanceFeedbacks({
  stacks,
  activityType,
}: {
  stacks: (DB.ElementStack & {
    elements: (DB.ElementInstance & {
      feedbacks: LearningAnalyticsFeedback[]
    })[]
  })[]
  activityType: ActivityType
}): InstanceFeedback[] {
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
      // entries without votes are not returned / illustrated
      if (instanceFeedback.totalVotes === 0) {
        return []
      }

      return {
        ...instanceFeedback,
        activityType,
        upvoteRate: instanceFeedback.upvotes / instanceFeedback.totalVotes,
        downvoteRate: instanceFeedback.downvotes / instanceFeedback.totalVotes,
        feedbackCount: instanceFeedback.totalVotes,
      }
    })
}

// based on the instance feedbacks, an unweighted average of the entire activity can be computed
function aggregateActivityFeedbacks({
  instanceFeedbacks,
  activityType,
  activityId,
  activityName,
}: {
  instanceFeedbacks: InstanceFeedback[]
  activityType: ActivityType
  activityId: string
  activityName: string
}) {
  // if no instance feedbacks were provided, do not return statistics for this activity
  if (instanceFeedbacks.length === 0) {
    return undefined
  }

  return instanceFeedbacks.reduce<ActivityFeedback>(
    (acc, instanceFeedback) => {
      // if no votes were submitted for the instance, skip it
      if (
        instanceFeedback.upvoteRate === 0 &&
        instanceFeedback.downvoteRate === 0
      ) {
        return acc
      }

      // combine the upvotes and downvote rates over all instances
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
  course: DB.Course & {
    practiceQuizzes: (DB.PracticeQuiz & {
      stacks: (DB.ElementStack & {
        elements: (DB.ElementInstance & {
          feedbacks: LearningAnalyticsFeedback[]
        })[]
      })[]
    })[]
    microLearnings: (DB.MicroLearning & {
      stacks: (DB.ElementStack & {
        elements: (DB.ElementInstance & {
          feedbacks: LearningAnalyticsFeedback[]
        })[]
      })[]
    })[]
  }
}) {
  // compute instance and activity feedbacks aggregated over instance or activity
  // this computation only considers instances where a non-zero number of votes were submitted
  const instanceFeedbacks: InstanceFeedback[] = []
  const activityFeedbacks: ActivityFeedback[] = []
  course.practiceQuizzes.forEach((quiz) => {
    // aggregate instance element feedbacks
    const quizInstanceFeedbacks = aggregateInstanceFeedbacks({
      stacks: quiz.stacks,
      activityType: ActivityType.PRACTICE_QUIZ,
    })
    instanceFeedbacks.push(...quizInstanceFeedbacks)

    // aggregate activity vote rates
    const activityFeedback = aggregateActivityFeedbacks({
      instanceFeedbacks: quizInstanceFeedbacks,
      activityType: ActivityType.PRACTICE_QUIZ,
      activityId: quiz.id,
      activityName: quiz.name,
    })

    if (activityFeedback) {
      activityFeedbacks.push(activityFeedback)
    }
  })
  course.microLearnings.forEach((micro) => {
    // aggregate instance element feedbacks
    const microInstanceFeedbacks = aggregateInstanceFeedbacks({
      stacks: micro.stacks,
      activityType: ActivityType.MICRO_LEARNING,
    })
    instanceFeedbacks.push(...microInstanceFeedbacks)

    // aggregate activity vote rates
    const activityFeedback = aggregateActivityFeedbacks({
      instanceFeedbacks: microInstanceFeedbacks,
      activityType: ActivityType.MICRO_LEARNING,
      activityId: micro.id,
      activityName: micro.name,
    })

    if (activityFeedback) {
      activityFeedbacks.push(activityFeedback)
    }
  })

  // sort instance feedbacks and activity feedbacks by decreasing feedbackCount
  instanceFeedbacks.sort((a, b) => b.feedbackCount - a.feedbackCount)
  activityFeedbacks.sort((a, b) => b.feedbackCount - a.feedbackCount)

  return {
    instanceFeedbacks,
    activityFeedbacks,
  }
}

function computeActivityInstancePerformance({
  course,
}: {
  course: DB.Course & {
    practiceQuizzes: (DB.PracticeQuiz & {
      stacks: (DB.ElementStack & {
        elements: (DB.ElementInstance & {
          instancePerformance: DB.InstancePerformance | null
          feedbacks: LearningAnalyticsFeedback[]
        })[]
      })[]
      progress: DB.ActivityProgress | null
      performance: DB.ActivityPerformance | null
      participantPerformances: (DB.ParticipantActivityPerformance & {
        participant: DB.Participant
      })[]
    })[]
    microLearnings: (DB.MicroLearning & {
      stacks: (DB.ElementStack & {
        elements: (DB.ElementInstance & {
          instancePerformance: DB.InstancePerformance | null
          feedbacks: LearningAnalyticsFeedback[]
        })[]
      })[]
      progress: DB.ActivityProgress | null
      performance: DB.ActivityPerformance | null
      participantPerformances: (DB.ParticipantActivityPerformance & {
        participant: DB.Participant
      })[]
    })[]
  }
}) {
  const activityInstanceAnalytics = [
    ...course.practiceQuizzes,
    ...course.microLearnings,
  ].reduce<{
    activityProgresses: {
      activityName: string
      activityType: ActivityType
      startedCount: number
      completedCount: number
      repeatedCount: number | null
    }[]
    activityPerformances: ActivityPerformance[]
    instancePerformances: InstancePerformance[]
  }>(
    (acc, activity) => {
      const progress = activity.progress
      const performance = activity.performance

      if (!progress) {
        return acc
      }

      const activityType =
        progress.practiceQuizId !== null
          ? ActivityType.PRACTICE_QUIZ
          : ActivityType.MICRO_LEARNING

      // update the activity progress entries
      acc.activityProgresses.push({
        activityName: activity.name,
        activityType,
        startedCount: progress.startedCount,
        completedCount: progress.completedCount,
        repeatedCount: progress.repeatedCount,
      })

      if (!performance) {
        return acc
      }

      // add the activity performance metrics to the error rates
      acc.activityPerformances.push({
        id: performance.id,
        participantCount: performance.participantCount,
        activityName: activity.name,
        activityType,
        rates: {
          firstErrorRate:
            performance.firstErrorRate ?? performance.totalErrorRate,
          lastErrorRate:
            performance.lastErrorRate ?? performance.totalErrorRate,
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
        },
      })

      // extract the desired values from the instance performance entries
      const instancePerformances = activity.stacks.flatMap((stack) =>
        stack.elements.flatMap((element) => {
          if (element.elementData.type === DB.ElementType.FREE_TEXT) {
            return []
          }

          const iPerformance = element.instancePerformance

          if (!iPerformance) {
            return []
          }

          return {
            id: iPerformance.id,
            elementName: element.elementData.name,
            elementType: element.elementData.type,
            rates: {
              firstErrorRate:
                iPerformance.firstErrorRate ?? iPerformance.totalErrorRate,
              lastErrorRate:
                iPerformance.lastErrorRate ?? iPerformance.totalErrorRate,
              errorRate: iPerformance.totalErrorRate,
              firstPartialRate:
                iPerformance.firstPartialRate ?? iPerformance.totalPartialRate,
              lastPartialRate:
                iPerformance.lastPartialRate ?? iPerformance.totalPartialRate,
              partialRate: iPerformance.totalPartialRate,
              firstCorrectRate:
                iPerformance.firstCorrectRate ?? iPerformance.totalCorrectRate,
              lastCorrectRate:
                iPerformance.lastCorrectRate ?? iPerformance.totalCorrectRate,
              correctRate: iPerformance.totalCorrectRate,
            },
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
      // extract performance data that should be tracked (table cell value)
      const performanceEntry = {
        id: performance.id,
        totalScore: performance.totalScore,
        completion: performance.completion,
        activityId: activity.id,
      }

      // create a new entry in the accumulator or update it with the corresponding activity performance data
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

  // transfer the data into a list format before returning it
  const participantActivityPerformances = Object.entries(
    participantActivityObject
  ).map(([participantId, entry]) => ({
    participantId,
    ...entry,
  }))

  return { ...activityInstanceAnalytics, participantActivityPerformances }
}

export async function getCoursePerformanceAnalytics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  if (!isLearningAnalyticsRolloutEnabled()) {
    return null
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, isLearningAnalyticsEnabled: true },
    include: {
      _count: {
        select: {
          participations: {
            where: learningAnalyticsParticipationWhere(courseId),
          },
        },
      },
      practiceQuizzes: {
        include: {
          progress: true,
          performance: true,
          participantPerformances: {
            where: {
              participant: {
                participations: {
                  some: learningAnalyticsParticipationWhere(courseId),
                },
              },
            },
            include: { participant: true },
          },
          stacks: {
            include: {
              elements: {
                include: {
                  instancePerformance: true,
                  feedbacks: { select: learningAnalyticsFeedbackSelect },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
      microLearnings: {
        include: {
          progress: true,
          performance: true,
          participantPerformances: {
            where: {
              participant: {
                participations: {
                  some: learningAnalyticsParticipationWhere(courseId),
                },
              },
            },
            include: { participant: true },
          },
          stacks: {
            include: {
              elements: {
                include: {
                  instancePerformance: true,
                  feedbacks: { select: learningAnalyticsFeedbackSelect },
                },
              },
            },
          },
        },
        orderBy: { scheduledStartAt: 'desc' },
      },
      participantPerformances: {
        where: {
          participant: {
            participations: {
              some: learningAnalyticsParticipationWhere(courseId),
            },
          },
        },
      },
    },
  })

  if (!course) {
    return null
  }

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
      participantPerformances: course.participantPerformances,
      instanceFeedbacks: [],
      activityFeedbacks: [],
    }
  }

  // map the metrics for all activities in the course to the desired performance and progress values
  const {
    activityProgresses,
    activityPerformances,
    participantActivityPerformances,
    instancePerformances,
  } = computeActivityInstancePerformance({
    course,
  })

  const courseWithEligibleFeedbacks =
    await filterCourseFeedbacksForLearningAnalytics(course, courseId, ctx)
  const { instanceFeedbacks, activityFeedbacks } =
    computeActivityInstanceFeedbacks({ course: courseWithEligibleFeedbacks })

  return {
    name: course.name,
    totalParticipants: course._count.participations,
    activityProgresses,
    activityPerformances,
    participantActivityPerformances,
    instancePerformances,
    participantPerformances: course.participantPerformances,
    instanceFeedbacks,
    activityFeedbacks,
  }
}

export async function getActivityAnalytics(
  { activityId }: { activityId: string },
  ctx: ContextWithUser
) {
  if (!isLearningAnalyticsRolloutEnabled()) {
    return null
  }

  const activityIncludes = {
    stacks: {
      include: {
        elements: {
          include: {
            feedbacks: { select: learningAnalyticsFeedbackSelect },
            instancePerformance: true,
            detailResponses: {
              select: {
                id: true,
                participantId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    },
    course: {
      include: {
        _count: {
          select: {
            participations: {
              where: learningAnalyticsParticipationWhere(),
            },
          },
        },
      },
    },
    performance: true,
  }

  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id: activityId,
      permissions: { some: { userId: ctx.user.sub } },
      course: { isLearningAnalyticsEnabled: true },
    }, // assumption: READ permissions on activity are required (implied by >= READ permissions on course)
    include: activityIncludes,
  })
  const microLearning = practiceQuiz
    ? null
    : await ctx.prisma.microLearning.findUnique({
        where: {
          id: activityId,
          permissions: { some: { userId: ctx.user.sub } },
          course: { isLearningAnalyticsEnabled: true },
        }, // assumption: READ permissions on activity are required (implied by >= READ permissions on course)
        include: activityIncludes,
      })
  const activity = practiceQuiz ?? microLearning
  const activityType = practiceQuiz
    ? ActivityType.PRACTICE_QUIZ
    : ActivityType.MICRO_LEARNING

  if (!activity) {
    return null
  }
  const courseId = activity.courseId
  const eligibleFeedbacks = await filterEligibleLearningAnalyticsActivity(
    activity.stacks.flatMap((stack) =>
      stack.elements.flatMap((element) =>
        element.elementData.type === DB.ElementType.FREE_TEXT
          ? []
          : element.feedbacks
      )
    ),
    courseId,
    ctx
  )
  const eligibleFeedbackIds = new Set(
    eligibleFeedbacks.map((feedback) => feedback.id)
  )
  const eligibleResponseDetails = await filterEligibleLearningAnalyticsActivity(
    activity.stacks.flatMap((stack) =>
      stack.elements.flatMap((element) =>
        element.elementData.type === DB.ElementType.FREE_TEXT
          ? []
          : element.detailResponses
      )
    ),
    courseId,
    ctx
  )
  const eligibleResponseDetailIds = new Set(
    eligibleResponseDetails.map((detail) => detail.id)
  )

  const {
    instanceQuizAnalytics,
    numberOfAnswersActivity,
    totalAverageInstanceTimes,
  } = activity.stacks.reduce<{
    instanceQuizAnalytics: InstanceQuizAnalytics[]
    numberOfAnswersActivity: number
    totalAverageInstanceTimes: number
  }>(
    (acc, stack) => {
      const newInstanceStatistics = stack.elements.flatMap((element) => {
        if (element.elementData.type === DB.ElementType.FREE_TEXT) {
          return []
        }

        // if performance has not been computed, skip this instance
        const performance = element.instancePerformance
        if (!performance) {
          return []
        }

        // number of answers = number of question response details
        const eligibleDetails = element.detailResponses.filter((detail) =>
          eligibleResponseDetailIds.has(detail.id)
        )
        const numberOfAnswers = eligibleDetails.length
        const uniqueParticipants = new Set(
          eligibleDetails.map((detail) => detail.participantId)
        ).size

        // compute the upvote and downvote rates
        const { upvoteRate, downvoteRate, totalVotes } = element.feedbacks
          .filter((feedback) => eligibleFeedbackIds.has(feedback.id))
          .reduce<{
            upvoteRate: number
            downvoteRate: number
            totalVotes: number
          }>(
            (acc, feedback) => {
              if (feedback.upvote) {
                acc.upvoteRate =
                  (acc.upvoteRate * acc.totalVotes + 1) / (acc.totalVotes + 1)
                acc.totalVotes++
              } else if (feedback.downvote) {
                acc.downvoteRate =
                  (acc.downvoteRate * acc.totalVotes + 1) / (acc.totalVotes + 1)
                acc.totalVotes++
              }

              return acc
            },
            {
              upvoteRate: 0,
              downvoteRate: 0,
              totalVotes: 0,
            }
          )

        // increment number of answers on activity
        acc.numberOfAnswersActivity += numberOfAnswers

        // increment total average instance times
        acc.totalAverageInstanceTimes += performance.averageTimeSpent

        return {
          ...performance,
          upvoteRate,
          downvoteRate,
          feedbackCount: totalVotes,
          elementName: element.elementData.name,
          elementType: element.elementData.type,
          numberOfAnswers,
          uniqueParticipants,
        }
      })

      acc.instanceQuizAnalytics.push(...newInstanceStatistics)
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
      ? {
          ...activity.performance,
          id: activity.performance?.id ?? 0,
          numberOfAnswers: numberOfAnswersActivity,
          averageTimeSpent: totalAverageInstanceTimes,
        }
      : null,
    instanceQuizAnalytics,
  }
}

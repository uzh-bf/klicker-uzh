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
import {
  LEARNING_ANALYTICS_DISCLOSURE_VERSION,
  isLearningAnalyticsRolloutEnabled,
  learningAnalyticsParticipationWhere,
} from '../lib/learningAnalytics.js'
import {
  assignLearningAnalyticsStudentLabels,
  buildLearningAnalyticsCsv,
  deidentifyLearningAnalyticsRows,
  meetsLearningAnalyticsMinimumSampleSize,
  summarizeLearningAnalyticsRows,
} from '../lib/learningAnalyticsOutput.js'

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
    },
  })

  if (!course) {
    return null
  }

  // map daily and weekly student activity into the format required by the frontend
  const dailyActivity = course.aggregatedAnalytics
    .filter(
      (analytics) =>
        analytics.type === 'DAILY' &&
        meetsLearningAnalyticsMinimumSampleSize(analytics.participantCount)
    )
    .map((analytics) => ({
      date: analytics.timestamp,
      activeParticipants: analytics.participantCount,
    }))
  const weeklyActivity = course.aggregatedAnalytics
    .filter(
      (analytics) =>
        analytics.type === 'WEEKLY' &&
        meetsLearningAnalyticsMinimumSampleSize(analytics.participantCount)
    )
    .map((analytics) => ({
      date: analytics.timestamp,
      activeParticipants: analytics.participantCount,
    }))

  const isSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
    course.participations.length
  )

  return {
    name: course.name,
    totalParticipants: isSuppressed ? null : course.participations.length,
    isSuppressed,
    dailyActivity: isSuppressed ? [] : dailyActivity,
    weeklyActivity: isSuppressed ? [] : weeklyActivity,
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

  const isSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
    course.participations.length
  )
  const weeklyActivity = course.aggregatedAnalytics
    .filter((analytics) =>
      meetsLearningAnalyticsMinimumSampleSize(analytics.participantCount)
    )
    .map((analytics) => ({
      date: analytics.timestamp,
      activeParticipants: analytics.participantCount,
    }))

  return {
    totalParticipants: isSuppressed ? null : course.participations.length,
    isSuppressed,
    weeklyActivity: isSuppressed ? [] : weeklyActivity,
  }
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
          participantIds: Set<string>
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
            acc.participantIds.add(feedback.participantId)

            return acc
          },
          {
            id: element.id,
            instanceName: element.elementData.name,
            instanceType: element.elementData.type,
            participantIds: new Set(),
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

      const { participantIds, ...feedback } = instanceFeedback
      return {
        ...feedback,
        activityType,
        participantCount: participantIds.size,
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
  participantCount,
}: {
  instanceFeedbacks: InstanceFeedback[]
  activityType: ActivityType
  activityId: string
  activityName: string
  participantCount: number
}) {
  // if no instance feedbacks were provided, do not return statistics for this activity
  if (instanceFeedbacks.length === 0) {
    return undefined
  }

  const feedbackCount = instanceFeedbacks.reduce(
    (count, feedback) => count + feedback.feedbackCount,
    0
  )
  return {
    id: activityId,
    activityType,
    activityName,
    participantCount,
    upvoteRate:
      instanceFeedbacks.reduce(
        (sum, feedback) => sum + feedback.upvoteRate * feedback.feedbackCount,
        0
      ) / feedbackCount,
    downvoteRate:
      instanceFeedbacks.reduce(
        (sum, feedback) => sum + feedback.downvoteRate * feedback.feedbackCount,
        0
      ) / feedbackCount,
    feedbackCount,
  }
}

function countFeedbackParticipants(
  stacks: {
    elements: { feedbacks: LearningAnalyticsFeedback[] }[]
  }[]
) {
  return new Set(
    stacks.flatMap((stack) =>
      stack.elements.flatMap((element) =>
        element.feedbacks.map((feedback) => feedback.participantId)
      )
    )
  ).size
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
      participantCount: countFeedbackParticipants(quiz.stacks),
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
      participantCount: countFeedbackParticipants(micro.stacks),
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
      participantPerformances: DB.ParticipantActivityPerformance[]
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
      participantPerformances: DB.ParticipantActivityPerformance[]
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
            participantCount: iPerformance.responseCount,
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
    Record<string, { activityPerformances: ParticipantActivityPerformance[] }>
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
      if (!acc[performance.participantId]) {
        acc[performance.participantId] = {
          activityPerformances: [performanceEntry],
        }
      } else {
        acc[performance.participantId]!.activityPerformances.push(
          performanceEntry
        )
      }
    })

    return acc
  }, {})

  // transfer the data into a list format before returning it
  const participantActivityPerformances = Object.entries(
    participantActivityObject
  ).map(([participantId, entry]) => ({ participantId, ...entry }))

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
      participations: {
        where: learningAnalyticsParticipationWhere(courseId),
        select: {
          participantId: true,
          learningAnalyticsIncludedFrom: true,
        },
      },
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
            select: {
              id: true,
              participantId: true,
              totalScore: true,
              completion: true,
              practiceQuizId: true,
              microLearningId: true,
            },
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
            select: {
              id: true,
              participantId: true,
              totalScore: true,
              completion: true,
              practiceQuizId: true,
              microLearningId: true,
            },
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
    },
  })

  if (!course) {
    return null
  }

  if (
    course.practiceQuizzes.length === 0 &&
    course.microLearnings.length === 0
  ) {
    const isSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
      course._count.participations
    )
    return {
      name: course.name,
      totalParticipants: isSuppressed ? null : course._count.participations,
      isSuppressed,
      participantActivityPerformanceN: null,
      activityProgresses: [],
      activityPerformances: [],
      participantActivityPerformances: [],
      instancePerformances: [],
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
  const activityIds = [
    ...course.practiceQuizzes.map((activity) => activity.id),
    ...course.microLearnings.map((activity) => activity.id),
  ]
  const inclusionByParticipantId = new Map(
    course.participations.map((participation) => [
      participation.participantId,
      participation.learningAnalyticsIncludedFrom!,
    ])
  )
  const deidentifiedParticipantActivity = deidentifyLearningAnalyticsRows({
    rows: participantActivityPerformances.flatMap((row) => {
      const includedFrom = inclusionByParticipantId.get(row.participantId)
      if (!includedFrom) {
        return []
      }
      return [
        {
          ...row,
          coverage:
            includedFrom <= course.startDate
              ? ('COMPLETE' as const)
              : ('PARTIAL' as const),
        },
      ]
    }),
    activityIds,
  })
  const isSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
    course._count.participations
  )

  return {
    name: course.name,
    totalParticipants: isSuppressed ? null : course._count.participations,
    isSuppressed,
    participantActivityPerformanceN:
      deidentifiedParticipantActivity.rows.length === 0
        ? null
        : deidentifiedParticipantActivity.effectiveN,
    activityProgresses: isSuppressed
      ? []
      : activityProgresses.filter((progress) =>
          meetsLearningAnalyticsMinimumSampleSize(progress.startedCount)
        ),
    activityPerformances: isSuppressed
      ? []
      : activityPerformances.filter((performance) =>
          meetsLearningAnalyticsMinimumSampleSize(performance.participantCount)
        ),
    participantActivityPerformances: isSuppressed
      ? []
      : summarizeLearningAnalyticsRows(deidentifiedParticipantActivity.rows),
    instancePerformances: isSuppressed
      ? []
      : instancePerformances.filter((performance) =>
          meetsLearningAnalyticsMinimumSampleSize(performance.participantCount)
        ),
    instanceFeedbacks: isSuppressed
      ? []
      : instanceFeedbacks.filter((feedback) =>
          meetsLearningAnalyticsMinimumSampleSize(feedback.participantCount)
        ),
    activityFeedbacks: isSuppressed
      ? []
      : activityFeedbacks.filter((feedback) =>
          meetsLearningAnalyticsMinimumSampleSize(feedback.participantCount)
        ),
  }
}

export async function getLearningAnalyticsExport(
  {
    courseId,
    includePartial = false,
  }: { courseId: string; includePartial?: boolean | null },
  ctx: ContextWithUser
) {
  const analytics = await getCoursePerformanceAnalytics({ courseId }, ctx)
  if (!analytics || analytics.isSuppressed) {
    return null
  }

  const selectedRows = analytics.participantActivityPerformances.filter(
    (row) => includePartial || row.coverage === 'COMPLETE'
  )
  if (!meetsLearningAnalyticsMinimumSampleSize(selectedRows.length)) {
    return null
  }

  const relabelledRows = assignLearningAnalyticsStudentLabels(
    selectedRows.map(({ studentLabel: _, ...row }) => row)
  )

  return {
    filename: 'learning-analytics.csv',
    content: buildLearningAnalyticsCsv({
      rows: relabelledRows,
      effectiveN: relabelledRows.length,
      includesPartial: includePartial ?? false,
    }),
    mimeType: 'text/csv;charset=utf-8',
    effectiveN: relabelledRows.length,
    includesPartial: includePartial ?? false,
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
        const eligibleFeedback = element.feedbacks.filter((feedback) =>
          eligibleFeedbackIds.has(feedback.id)
        )
        const feedbackParticipantCount = new Set(
          eligibleFeedback.flatMap((feedback) =>
            feedback.upvote || feedback.downvote ? [feedback.participantId] : []
          )
        ).size
        const { upvoteRate, downvoteRate } = eligibleFeedback.reduce<{
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
        const feedbackSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
          feedbackParticipantCount
        )

        return {
          ...performance,
          upvoteRate: feedbackSuppressed ? 0 : upvoteRate,
          downvoteRate: feedbackSuppressed ? 0 : downvoteRate,
          feedbackCount: feedbackSuppressed ? 0 : feedbackParticipantCount,
          feedbackSuppressed,
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

  const isSuppressed = !meetsLearningAnalyticsMinimumSampleSize(
    activity.course._count.participations
  )
  const activityParticipantCount = activity.performance?.participantCount ?? 0

  return {
    activityName: activity.name,
    activityType,
    courseParticipants: isSuppressed
      ? null
      : activity.course._count.participations,
    isSuppressed,
    activityQuizAnalytics:
      !isSuppressed &&
      activity.performance &&
      meetsLearningAnalyticsMinimumSampleSize(activityParticipantCount)
        ? {
            ...activity.performance,
            id: activity.performance?.id ?? 0,
            numberOfAnswers: numberOfAnswersActivity,
            averageTimeSpent: totalAverageInstanceTimes,
          }
        : null,
    instanceQuizAnalytics: isSuppressed
      ? []
      : instanceQuizAnalytics.filter((instance) =>
          meetsLearningAnalyticsMinimumSampleSize(instance.uniqueParticipants)
        ),
  }
}

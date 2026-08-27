import * as DB from '@klicker-uzh/prisma/client'
import type {
  ActivityFeedback,
  ActivityPerformance,
  InstanceFeedback,
  InstancePerformance,
  InstanceQuizAnalytics,
  ParticipantActivityPerformance,
} from '@klicker-uzh/types'
import { ActivityType } from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import type { ContextWithUser } from '@/lib/context.js'

async function getEligibleParticipantIdsForCourseAnalytics(
  prisma: PrismaTransactionClient,
  courseId: string
) {
  const rows = await prisma.$queryRaw<Array<{ participantId: string }>>`
    SELECT pca."participantId" AS "participantId"
    FROM "ParticipantCourseAnalytics" AS pca
    JOIN "Participant" AS p ON p."id" = pca."participantId"
    JOIN "Course" AS c ON c."id" = pca."courseId"
    JOIN "Participation" AS membership
      ON membership."courseId" = pca."courseId"
      AND membership."participantId" = pca."participantId"
      AND membership."isActive" IS TRUE
    WHERE pca."courseId" = CAST(${courseId} AS uuid)
      AND p."learningAnalyticsConsent" IS TRUE
      AND p."learningAnalyticsChoiceAt" IS NOT NULL
      AND NULLIF(btrim(p."learningAnalyticsDisclosureVersion"), '') IS NOT NULL
      AND c."isLearningAnalyticsEnabled" IS TRUE
      AND c."areAnalyticsValid" IS TRUE
      AND c."isArchived" IS FALSE
      AND c."analyticsLastComputedAt" IS NOT NULL
      AND c."analyticsLastComputedAt" > p."learningAnalyticsChoiceAt"
  `

  return rows.map(({ participantId }) => participantId)
}

async function getEligibleParticipantIdsForPerformanceAnalytics(
  prisma: PrismaTransactionClient,
  courseId: string
) {
  const rows = await prisma.$queryRaw<Array<{ participantId: string }>>`
    WITH individual_rows AS (
      SELECT pp."participantId" AS "participantId"
      FROM "ParticipantPerformance" AS pp
      WHERE pp."courseId" = CAST(${courseId} AS uuid)

      UNION

      SELECT pap."participantId" AS "participantId"
      FROM "ParticipantActivityPerformance" AS pap
      JOIN "PracticeQuiz" AS pq ON pq."id" = pap."practiceQuizId"
      WHERE pq."courseId" = CAST(${courseId} AS uuid)

      UNION

      SELECT pap."participantId" AS "participantId"
      FROM "ParticipantActivityPerformance" AS pap
      JOIN "MicroLearning" AS ml ON ml."id" = pap."microLearningId"
      WHERE ml."courseId" = CAST(${courseId} AS uuid)
    )
    SELECT individual_rows."participantId" AS "participantId"
    FROM individual_rows
    JOIN "Participant" AS p ON p."id" = individual_rows."participantId"
    JOIN "Course" AS c ON c."id" = CAST(${courseId} AS uuid)
    JOIN "Participation" AS membership
      ON membership."courseId" = c."id"
      AND membership."participantId" = individual_rows."participantId"
      AND membership."isActive" IS TRUE
    WHERE p."learningAnalyticsConsent" IS TRUE
      AND p."learningAnalyticsChoiceAt" IS NOT NULL
      AND NULLIF(btrim(p."learningAnalyticsDisclosureVersion"), '') IS NOT NULL
      AND c."isLearningAnalyticsEnabled" IS TRUE
      AND c."areAnalyticsValid" IS TRUE
      AND c."isArchived" IS FALSE
      AND c."analyticsLastComputedAt" IS NOT NULL
      AND c."analyticsLastComputedAt" > p."learningAnalyticsChoiceAt"
  `

  return rows.map(({ participantId }) => participantId)
}

export async function getCourseActivityAnalytics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  return ctx.prisma.$transaction(
    async (prisma) => {
      const eligibleParticipantIds =
        await getEligibleParticipantIdsForCourseAnalytics(prisma, courseId)
      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
          isLearningAnalyticsEnabled: true,
          areAnalyticsValid: true,
        },
        include: {
          participations: true,
          aggregatedAnalytics: {
            orderBy: { timestamp: 'asc' },
          },
          aggregatedCourseAnalytics: true,
          participantCourseAnalytics: {
            where: {
              participantId: { in: eligibleParticipantIds },
              course: { isArchived: false },
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
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
      isolationLevel: DB.Prisma.TransactionIsolationLevel.RepeatableRead,
    }
  )
}

export async function getCourseWeeklyActivity(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: {
      id: courseId,
      isLearningAnalyticsEnabled: true,
      areAnalyticsValid: true,
    },
    include: {
      participations: true,
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
    elements: (DB.ElementInstance & { feedbacks: DB.ElementFeedback[] })[]
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
        elements: (DB.ElementInstance & { feedbacks: DB.ElementFeedback[] })[]
      })[]
    })[]
    microLearnings: (DB.MicroLearning & {
      stacks: (DB.ElementStack & {
        elements: (DB.ElementInstance & { feedbacks: DB.ElementFeedback[] })[]
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
          feedbacks: DB.ElementFeedback[]
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
          feedbacks: DB.ElementFeedback[]
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
  return ctx.prisma.$transaction(
    async (prisma) => {
      const eligibleParticipantIds =
        await getEligibleParticipantIdsForPerformanceAnalytics(prisma, courseId)
      const participantFilter = {
        participantId: { in: eligibleParticipantIds },
      }
      const course = await prisma.course.findUnique({
        where: {
          id: courseId,
          isLearningAnalyticsEnabled: true,
          areAnalyticsValid: true,
        },
        include: {
          _count: { select: { participations: true } },
          practiceQuizzes: {
            include: {
              progress: true,
              performance: true,
              participantPerformances: {
                where: {
                  ...participantFilter,
                  practiceQuiz: { course: { isArchived: false } },
                },
                include: { participant: true },
              },
              stacks: {
                include: {
                  elements: {
                    include: { instancePerformance: true, feedbacks: true },
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
                  ...participantFilter,
                  microLearning: { course: { isArchived: false } },
                },
                include: { participant: true },
              },
              stacks: {
                include: {
                  elements: {
                    include: { instancePerformance: true, feedbacks: true },
                  },
                },
              },
            },
            orderBy: { scheduledStartAt: 'desc' },
          },
          participantPerformances: {
            where: {
              ...participantFilter,
              course: { isArchived: false },
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

      const { instanceFeedbacks, activityFeedbacks } =
        computeActivityInstanceFeedbacks({ course })

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
    },
    {
      maxWait: 10_000,
      timeout: 60_000,
      isolationLevel: DB.Prisma.TransactionIsolationLevel.RepeatableRead,
    }
  )
}

export async function getActivityAnalytics(
  { activityId }: { activityId: string },
  ctx: ContextWithUser
) {
  const activityIncludes = {
    stacks: {
      include: {
        elements: {
          include: {
            feedbacks: true,
            instancePerformance: true,
            _count: {
              select: { detailResponses: true },
            },
          },
        },
      },
    },
    course: {
      include: {
        _count: {
          select: { participations: true },
        },
      },
    },
    performance: true,
  }

  const practiceQuiz = await ctx.prisma.practiceQuiz.findUnique({
    where: {
      id: activityId,
      permissions: { some: { userId: ctx.user.sub } },
      course: { isLearningAnalyticsEnabled: true, areAnalyticsValid: true },
    }, // assumption: READ permissions on activity are required (implied by >= READ permissions on course)
    include: activityIncludes,
  })
  const microLearning = await ctx.prisma.microLearning.findUnique({
    where: {
      id: activityId,
      permissions: { some: { userId: ctx.user.sub } },
      course: { isLearningAnalyticsEnabled: true, areAnalyticsValid: true },
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
        // if performance has not been computed, skip this instance
        const performance = element.instancePerformance
        if (!performance) {
          return []
        }

        // number of answers = number of question response details
        const numberOfAnswers = element._count.detailResponses
        const uniqueParticipants = performance.responseCount

        // compute the upvote and downvote rates
        const { upvoteRate, downvoteRate, totalVotes } =
          element.feedbacks.reduce<{
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

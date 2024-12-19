import {
  ActivityPerformance,
  ActivityType,
  InstancePerformance,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { ContextWithUser } from 'src/lib/context.js'

export async function getCourseActivityAnalytics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, ownerId: ctx.user.sub },
    include: {
      participations: true,
      aggregatedAnalytics: {
        orderBy: { timestamp: 'asc' },
      },
      aggregatedCourseAnalytics: true,
      participantCourseAnalytics: true,
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
  { courseId }: { courseId?: string | null },
  ctx: ContextWithUser
) {
  if (!courseId) {
    return null
  }

  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, ownerId: ctx.user.sub },
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

export async function getCoursePerformanceAnalytics(
  { courseId }: { courseId: string },
  ctx: ContextWithUser
) {
  const course = await ctx.prisma.course.findUnique({
    where: { id: courseId, ownerId: ctx.user.sub },
    include: {
      _count: {
        select: { participations: true },
      },
      practiceQuizzes: {
        include: {
          progress: true,
          performance: true,
          stacks: {
            include: {
              elements: {
                include: {
                  instancePerformance: true,
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
          stacks: {
            include: {
              elements: {
                include: {
                  instancePerformance: true,
                },
              },
            },
          },
        },
        orderBy: { scheduledStartAt: 'desc' },
      },
      participantPerformances: true,
    },
  })

  if (
    !course ||
    (course.practiceQuizzes.length === 0 && course.microLearnings.length === 0)
  ) {
    return null
  }

  // map the metrics for all activities in the course to the desired performance and progress values
  const { activityProgresses, activityPerformances, instancePerformances } = [
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

  return {
    name: course.name,
    totalParticipants: course._count.participations,
    activityProgresses,
    activityPerformances,
    instancePerformances,
    participantPerformances: course.participantPerformances,
  }
}

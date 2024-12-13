import { ActivityType } from '@klicker-uzh/types'
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
      activityProgresses: {
        include: {
          practiceQuiz: true,
          microLearning: true,
        },
      },
    },
  })

  if (!course || course.activityProgresses.length === 0) {
    return null
  }

  // order the activity progresses by creation date
  const orderedProgresses = course.activityProgresses.sort((a, b) =>
    dayjs(b.practiceQuiz?.createdAt ?? b.microLearning?.createdAt).diff(
      dayjs(a.practiceQuiz?.createdAt ?? a.microLearning?.createdAt)
    )
  )

  // map the activity progresses into the format required by the frontend
  const activityProgresses = orderedProgresses.map((progress) => ({
    activityName:
      progress.practiceQuizId !== null
        ? (progress.practiceQuiz?.name ?? 'Unknown')
        : (progress.microLearning?.name ?? 'Unknown'),
    activityType:
      progress.practiceQuizId !== null
        ? ActivityType.PRACTICE_QUIZ
        : ActivityType.MICRO_LEARNING,
    startedCount: progress.startedCount,
    completedCount: progress.completedCount,
    repeatedCount: progress.repeatedCount,
  }))

  return {
    name: course.name,
    totalParticipants: course.activityProgresses[0]!.totalCourseParticipants,
    activityProgresses,
  }
}

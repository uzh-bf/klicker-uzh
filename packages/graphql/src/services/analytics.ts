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

  return {
    name: course.name,
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

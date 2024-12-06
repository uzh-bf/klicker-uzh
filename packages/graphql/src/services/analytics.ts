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
      activityMonday: course.aggregatedCourseAnalytics?.activityMonday ?? 0,
      activityTuesday: course.aggregatedCourseAnalytics?.activityTuesday ?? 0,
      activityWednesday:
        course.aggregatedCourseAnalytics?.activityWednesday ?? 0,
      activityThursday: course.aggregatedCourseAnalytics?.activityThursday ?? 0,
      activityFriday: course.aggregatedCourseAnalytics?.activityFriday ?? 0,
      activitySaturday: course.aggregatedCourseAnalytics?.activitySaturday ?? 0,
      activitySunday: course.aggregatedCourseAnalytics?.activitySunday ?? 0,
    },
  }
}

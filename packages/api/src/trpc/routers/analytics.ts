import { PermissionLevel, type Prisma } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActivityAnalytics,
  toCourseActivityAnalytics,
  toCoursePerformanceAnalytics,
  toCourseWeeklyActivity,
} from '../dto/analytics.js'
import { router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import {
  activityAnalyticsInput,
  courseAnalyticsInput,
} from '../schemas/analytics.js'

const activityAnalyticsInclude = {
  stacks: {
    include: {
      elements: {
        include: {
          feedbacks: {
            select: {
              downvote: true,
              upvote: true,
            },
          },
          instancePerformance: {
            select: {
              id: true,
              responseCount: true,
              averageTimeSpent: true,
              firstErrorRate: true,
              firstPartialRate: true,
              firstCorrectRate: true,
              lastErrorRate: true,
              lastPartialRate: true,
              lastCorrectRate: true,
              totalErrorRate: true,
              totalPartialRate: true,
              totalCorrectRate: true,
            },
          },
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
  performance: {
    select: {
      id: true,
      firstErrorRate: true,
      firstPartialRate: true,
      firstCorrectRate: true,
      lastErrorRate: true,
      lastPartialRate: true,
      lastCorrectRate: true,
      totalErrorRate: true,
      totalPartialRate: true,
      totalCorrectRate: true,
    },
  },
}

const courseActivityAnalyticsInclude = {
  participations: true,
  aggregatedAnalytics: {
    orderBy: { timestamp: 'asc' },
  },
  aggregatedCourseAnalytics: true,
  participantCourseAnalytics: true,
} satisfies Prisma.CourseInclude

const courseWeeklyActivityInclude = {
  participations: true,
  aggregatedAnalytics: {
    where: { type: 'WEEKLY' },
    orderBy: { timestamp: 'asc' },
  },
} satisfies Prisma.CourseInclude

const coursePerformanceAnalyticsInclude = {
  _count: { select: { participations: true } },
  practiceQuizzes: {
    include: {
      progress: true,
      performance: true,
      participantPerformances: { include: { participant: true } },
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
      participantPerformances: { include: { participant: true } },
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
  participantPerformances: true,
} satisfies Prisma.CourseInclude

export const analyticsRouter = router({
  courseActivity: userProcedure
    .input(courseAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const trpcCtx = ctx as TRPCContextWithUser
      const canReadCourse = await hasCoursePermission(
        trpcCtx,
        input.courseId,
        PermissionLevel.READ
      )

      if (!canReadCourse) {
        return { courseActivityAnalytics: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: courseActivityAnalyticsInclude,
      })

      return {
        courseActivityAnalytics: toCourseActivityAnalytics(course),
      }
    }),

  courseWeeklyActivity: userProcedure
    .input(courseAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const trpcCtx = ctx as TRPCContextWithUser
      const canReadCourse = await hasCoursePermission(
        trpcCtx,
        input.courseId,
        PermissionLevel.READ
      )

      if (!canReadCourse) {
        return { courseWeeklyActivity: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: courseWeeklyActivityInclude,
      })

      return {
        courseWeeklyActivity: toCourseWeeklyActivity(course),
      }
    }),

  coursePerformance: userProcedure
    .input(courseAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const trpcCtx = ctx as TRPCContextWithUser
      const canReadCourse = await hasCoursePermission(
        trpcCtx,
        input.courseId,
        PermissionLevel.READ
      )

      if (!canReadCourse) {
        return { coursePerformanceAnalytics: null }
      }

      const prisma = getPrisma(ctx)
      const course = await prisma.course.findUnique({
        where: { id: input.courseId },
        include: coursePerformanceAnalyticsInclude,
      })

      return {
        coursePerformanceAnalytics: toCoursePerformanceAnalytics(course),
      }
    }),

  activity: userProcedure
    .input(activityAnalyticsInput)
    .query(async ({ ctx, input }) => {
      const trpcCtx = ctx as TRPCContextWithUser
      const [canReadPracticeQuiz, canReadMicroLearning] = await Promise.all([
        hasActivityPermission(
          trpcCtx,
          {
            activityId: input.activityId,
            activityType: ActivityType.PRACTICE_QUIZ,
          },
          PermissionLevel.READ
        ),
        hasActivityPermission(
          trpcCtx,
          {
            activityId: input.activityId,
            activityType: ActivityType.MICRO_LEARNING,
          },
          PermissionLevel.READ
        ),
      ])

      if (!canReadPracticeQuiz && !canReadMicroLearning) {
        return { activityAnalytics: null }
      }

      const prisma = getPrisma(ctx)
      const practiceQuiz = canReadPracticeQuiz
        ? await prisma.practiceQuiz.findUnique({
            where: {
              id: input.activityId,
              permissions: { some: { userId: ctx.user.sub } },
            },
            include: activityAnalyticsInclude,
          })
        : null

      if (practiceQuiz) {
        return {
          activityAnalytics: toActivityAnalytics(
            practiceQuiz,
            ActivityType.PRACTICE_QUIZ
          ),
        }
      }

      const microLearning = canReadMicroLearning
        ? await prisma.microLearning.findUnique({
            where: {
              id: input.activityId,
              permissions: { some: { userId: ctx.user.sub } },
            },
            include: activityAnalyticsInclude,
          })
        : null

      return {
        activityAnalytics: toActivityAnalytics(
          microLearning,
          ActivityType.MICRO_LEARNING
        ),
      }
    }),
})

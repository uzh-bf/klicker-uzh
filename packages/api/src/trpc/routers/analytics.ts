import { PermissionLevel } from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import { toActivityAnalytics } from '../dto/analytics.js'
import { router } from '../init.js'
import { hasActivityPermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import { activityAnalyticsInput } from '../schemas/analytics.js'

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

export const analyticsRouter = router({
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

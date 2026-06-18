import {
  ElementBlockStatus,
  PermissionLevel,
  PublicationStatus,
  UserRole,
  type Prisma,
} from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getCachedBlockResults } from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import { createHmac } from 'node:crypto'
import { getPrisma, type TRPCContextWithUser } from '../context.js'
import {
  toActivityAnalytics,
  toCourseActivityAnalytics,
  toCoursePerformanceAnalytics,
  toCourseWeeklyActivity,
} from '../dto/analytics.js'
import {
  toActivityEvaluation,
  toLiveQuizEvaluation,
} from '../dto/evaluation.js'
import { publicProcedure, router } from '../init.js'
import { hasActivityPermission, hasCoursePermission } from '../permissions.js'
import { userProcedure } from '../procedures.js'
import {
  activityAnalyticsInput,
  activityEvaluationInput,
  courseAnalyticsInput,
  liveQuizEvaluationInput,
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

const activityEvaluationInclude = {
  stacks: {
    include: { elements: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  },
} satisfies Prisma.PracticeQuizInclude

const liveQuizEvaluationInclude = {
  activeBlock: { include: { elements: { orderBy: { order: 'asc' } } } },
  blocks: {
    orderBy: { order: 'asc' },
    include: { elements: { orderBy: { order: 'asc' } } },
  },
  feedbacks: {
    include: { responses: true },
    orderBy: { updatedAt: 'desc' },
  },
  confusionFeedbacks: { orderBy: { createdAt: 'asc' } },
  course: { select: { isGamificationEnabled: true, language: true } },
  leaderboard: {
    include: { participant: true, sessionParticipation: true },
  },
  temporaryLeaderboard: true,
} satisfies Prisma.LiveQuizInclude

function isValidLiveQuizHmac({
  hmac,
  id,
  namespace,
}: {
  hmac?: string | null
  id: string
  namespace: string
}) {
  if (typeof hmac !== 'string' || hmac === '') return false

  const hmacEncoder = createHmac('sha256', process.env.APP_SECRET as string)
  hmacEncoder.update(namespace + id)

  return hmacEncoder.digest('hex') === hmac
}

function toLiveQuizEvaluationLeaderboard({
  participantProfilesVisible,
  quiz,
}: {
  participantProfilesVisible: boolean
  quiz: Prisma.LiveQuizGetPayload<{ include: typeof liveQuizEvaluationInclude }>
}) {
  if (!quiz.isGamificationEnabled) return null

  const executedBlockOrders = quiz.blocks
    .filter((block) => block.status === ElementBlockStatus.EXECUTED)
    .map((block) => Number(block.order))
  const lastBlockOrder =
    executedBlockOrders.length > 0 ? Math.max(...executedBlockOrders) : 0

  const entries = quiz.leaderboard
    .flatMap((entry) => {
      if (
        quiz.course?.isGamificationEnabled &&
        !entry.sessionParticipation?.isActive
      ) {
        return []
      }

      return {
        id: entry.id,
        participantId: entry.participant.id,
        username:
          entry.participant.isProfilePublic && participantProfilesVisible
            ? entry.participant.username
            : 'Anonymous',
        avatar:
          entry.participant.isProfilePublic && participantProfilesVisible
            ? entry.participant.avatar
            : null,
        score: entry.score,
        isTemporary: false,
        lastBlockOrder,
      }
    })
    .concat(
      quiz.temporaryLeaderboard.map((entry) => ({
        id: Math.floor(Math.random() * 1000000000),
        participantId: entry.id,
        username: participantProfilesVisible ? entry.username : 'Anonymous',
        avatar: participantProfilesVisible ? entry.avatar : null,
        score: entry.score,
        isTemporary: true,
        lastBlockOrder,
      }))
    )

  return entries
    .sort((a, b) => b.score - a.score || a.username.localeCompare(b.username))
    .map((entry, ix) => ({
      id: entry.id,
      participantId: entry.participantId,
      rank: ix + 1,
      username: entry.username,
      avatar: entry.avatar,
      score: entry.score,
      isTemporary: entry.isTemporary,
    }))
}

export const analyticsRouter = router({
  practiceQuizEvaluation: userProcedure
    .input(activityEvaluationInput)
    .query(async ({ ctx, input }) => {
      const canRead = await hasActivityPermission(
        ctx as TRPCContextWithUser,
        {
          activityId: input.id,
          activityType: ActivityType.PRACTICE_QUIZ,
        },
        PermissionLevel.READ
      )

      if (!canRead) {
        return { practiceQuizEvaluation: null }
      }

      const prisma = getPrisma(ctx)
      const practiceQuiz = await prisma.practiceQuiz.findUnique({
        where: {
          id: input.id,
          status: PublicationStatus.PUBLISHED,
          isDeleted: false,
        },
        include: activityEvaluationInclude,
      })

      return {
        practiceQuizEvaluation: toActivityEvaluation(practiceQuiz),
      }
    }),

  microLearningEvaluation: userProcedure
    .input(activityEvaluationInput)
    .query(async ({ ctx, input }) => {
      const canRead = await hasActivityPermission(
        ctx as TRPCContextWithUser,
        {
          activityId: input.id,
          activityType: ActivityType.MICRO_LEARNING,
        },
        PermissionLevel.READ
      )

      if (!canRead) {
        return { microLearningEvaluation: null }
      }

      const prisma = getPrisma(ctx)
      const microLearning = await prisma.microLearning.findUnique({
        where: {
          id: input.id,
          status: {
            in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED],
          },
          isDeleted: false,
        },
        include: activityEvaluationInclude,
      })

      return {
        microLearningEvaluation: toActivityEvaluation(microLearning),
      }
    }),

  liveQuizEvaluation: publicProcedure
    .input(liveQuizEvaluationInput)
    .query(async ({ ctx, input }) => {
      const prisma = getPrisma(ctx)
      const hmacProvided = typeof input.hmac === 'string' && input.hmac !== ''

      if (!ctx.user?.sub && !hmacProvided) {
        return { liveQuizEvaluation: null, liveQuizLeaderboard: null }
      }

      if (!hmacProvided) {
        const canRead = ctx.user?.sub
          ? await hasActivityPermission(
              ctx as TRPCContextWithUser,
              { activityId: input.id, activityType: ActivityType.LIVE_QUIZ },
              PermissionLevel.READ
            )
          : false

        if (!canRead) {
          return { liveQuizEvaluation: null, liveQuizLeaderboard: null }
        }
      }

      const liveQuiz = await prisma.liveQuiz.findUnique({
        where: {
          id: input.id,
          status: {
            in: [PublicationStatus.PUBLISHED, PublicationStatus.ENDED],
          },
          isDeleted: false,
        },
        include: liveQuizEvaluationInclude,
      })

      if (!liveQuiz) {
        return { liveQuizEvaluation: null, liveQuizLeaderboard: null }
      }

      const validHmac = isValidLiveQuizHmac({
        hmac: input.hmac,
        id: liveQuiz.id,
        namespace: liveQuiz.namespace,
      })

      if (hmacProvided && !validHmac) {
        return { liveQuizEvaluation: null, liveQuizLeaderboard: null }
      }

      const redis = liveQuiz.isAssessmentEnabled
        ? ctx.redisAssessmentExec
        : ctx.redisExec
      const cachedResults =
        liveQuiz.activeBlockId && liveQuiz.activeBlock && redis
          ? await getCachedBlockResults({
              redisExec: redis as Redis,
              activeBlock: liveQuiz.activeBlock,
            })
          : null
      const activeBlockWithResults = cachedResults
        ? {
            ...liveQuiz.activeBlock!,
            elements: liveQuiz.activeBlock!.elements.map((instance) => ({
              ...instance,
              anonymousResults:
                cachedResults.instanceResults[instance.id]?.anonymousResults ??
                instance.anonymousResults,
            })),
          }
        : undefined
      const participant =
        ctx.user?.sub && ctx.user.role === UserRole.PARTICIPANT
          ? await prisma.participant.findUnique({ where: { id: ctx.user.sub } })
          : null
      const participantProfilesVisible =
        (participant?.isProfilePublic ?? false) ||
        ctx.user?.role === UserRole.TEMPORARY_PARTICIPANT ||
        ctx.user?.role === UserRole.USER ||
        ctx.user?.role === UserRole.ADMIN ||
        validHmac

      return {
        liveQuizEvaluation: toLiveQuizEvaluation({
          liveQuiz: {
            ...liveQuiz,
            blocks: liveQuiz.blocks.filter(
              (block) => block.status === ElementBlockStatus.EXECUTED
            ),
          },
          activeBlockWithResults,
        }),
        liveQuizLeaderboard: toLiveQuizEvaluationLeaderboard({
          participantProfilesVisible,
          quiz: liveQuiz,
        }),
      }
    }),

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

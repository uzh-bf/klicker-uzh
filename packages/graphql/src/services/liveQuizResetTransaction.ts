import * as DB from '@klicker-uzh/prisma/client'
import { getInitialInstanceResults } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import {
  formatLiveQuizActivityInfo,
  type LiveQuizActivityInfo,
  type LiveQuizActivityInfoPermission,
} from './liveQuizActivityInfo.js'
import {
  inspectLegacyRegularLiveQuizRewards,
  persistLiveQuizRewardRun,
  reverseLiveQuizRewardRun,
  type RewardReversalTotals,
  type WeeklyTimelineRecomputation,
} from './liveQuizRewards.js'
import { hasValidLiveQuizRewardEntries } from './liveQuizRewardValidation.js'

function resetActivityInfoInclude(userId: string) {
  return {
    course: {
      include: {
        permissions: {
          where: { userId },
          select: { permissionLevel: true },
        },
      },
    },
    permissions: {
      where: { userId },
      include: { directPermission: true },
    },
    blocks: {
      include: { _count: { select: { elements: true } } },
      orderBy: { order: 'asc' },
    },
    templateInfo: true,
    _count: { select: { permissions: true } },
  } as const
}

function resetError(code: string, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

export async function resetLiveQuizExecutionState({
  liveQuizId,
  userId,
  tx,
}: {
  liveQuizId: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUniqueOrThrow({
    where: { id: liveQuizId },
    include: {
      blocks: {
        include: {
          elements: true,
        },
      },
    },
  })

  for (const block of quiz.blocks) {
    await tx.elementBlock.update({
      where: { id: block.id },
      data: {
        status: DB.ElementBlockStatus.SCHEDULED,
        startedAt: null,
        closedAt: null,
        expiresAt: null,
        execution: { increment: 1 },
      },
    })
    for (const instance of block.elements) {
      const initialResults = getInitialInstanceResults(instance.elementData)
      await tx.elementInstance.update({
        where: { id: instance.id },
        data: {
          liveQuizResponses: { deleteMany: {} },
          results: initialResults,
          anonymousResults: initialResults,
        },
      })
    }
  }

  const transitioned = await tx.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.ENDED,
      isDeleted: false,
    },
    data: {
      status: DB.PublicationStatus.DRAFT,
      startedAt: null,
      finishedAt: null,
      availableFrom: null,
      scheduledPublicationTaskId: null,
      activeBlockId: null,
      activeRewardRunId: null,
    },
  })
  if (transitioned.count !== 1) {
    throw resetError(
      'LIVE_QUIZ_RESET_CONFLICT',
      'Live quiz state changed while it was being reset'
    )
  }

  const updatedQuiz = await tx.liveQuiz.update({
    where: { id: liveQuizId },
    data: {
      feedbacks: { deleteMany: {} },
      confusionFeedbacks: { deleteMany: {} },
      leaderboard: { deleteMany: {} },
      temporaryLeaderboard: { deleteMany: {} },
    },
    include: resetActivityInfoInclude(userId),
  })
  if (updatedQuiz.permissions.length !== 1 && updatedQuiz.ownerId !== userId) {
    throw resetError(
      'LIVE_QUIZ_RESET_PERMISSION_MISSING',
      'Reset activity permission could not be formatted safely'
    )
  }
  return { ...updatedQuiz, resetUserId: userId }
}

export type ResetActivityInfoSource = Awaited<
  ReturnType<typeof resetLiveQuizExecutionState>
>

export function formatResetActivityInfo(activity: ResetActivityInfoSource) {
  const storedPermission = activity.permissions[0]
  const isImplicitOwner =
    storedPermission === undefined && activity.ownerId === activity.resetUserId
  if (!storedPermission && !isImplicitOwner) {
    throw resetError(
      'LIVE_QUIZ_RESET_PERMISSION_MISSING',
      'Reset activity permission could not be formatted safely'
    )
  }

  const permission: LiveQuizActivityInfoPermission = storedPermission ?? {
    permissionLevel: DB.PermissionLevel.OWNER,
    derived: false,
    directPermission: null,
  }
  const isAdministrator = (permissionLevel: DB.PermissionLevel): boolean =>
    permissionLevel === DB.PermissionLevel.OWNER ||
    permissionLevel === DB.PermissionLevel.ADMIN
  const isActivityReviewer =
    activity.courseId === null
      ? isAdministrator(permission.permissionLevel)
      : activity.course?.ownerId === activity.resetUserId ||
        (activity.course?.permissions.some((coursePermission) =>
          isAdministrator(coursePermission.permissionLevel)
        ) ??
          false)
  return formatLiveQuizActivityInfo({
    activity,
    permission,
    isActivityReviewer,
    implicitOwner: isImplicitOwner,
  })
}

export type ResetActivityInfo = ReturnType<typeof formatResetActivityInfo>

export type ResetLiveQuizServiceResult =
  | {
      outcome: 'SUCCESS'
      activity: LiveQuizActivityInfo
      rewardRunId: string | null
      totals: RewardReversalTotals
      weeklyTimelineRecomputations: WeeklyTimelineRecomputation[]
    }
  | {
      outcome: 'INVALID_STATE' | 'REWARD_DATA_UNAVAILABLE' | 'CONFLICT'
      activity: null
    }

async function loadResettableQuiz({
  id,
  userId,
  tx,
}: {
  id: string
  userId: string
  tx: DB.Prisma.TransactionClient
}) {
  const quiz = await tx.liveQuiz.findUnique({
    where: { id },
    include: {
      activeRewardRun: {
        include: {
          entries: {
            include: {
              participation: {
                select: { participantId: true, courseId: true },
              },
            },
          },
        },
      },
      rewardRuns: { select: { id: true, status: true } },
      permissions: { where: { userId } },
      course: {
        include: {
          permissions: { where: { userId } },
        },
      },
    },
  })
  if (!quiz) return null

  const isAdministrator = (
    permissions: Array<{ permissionLevel: DB.PermissionLevel }>
  ) =>
    permissions.some(
      (permission) =>
        permission.permissionLevel === DB.PermissionLevel.ADMIN ||
        permission.permissionLevel === DB.PermissionLevel.OWNER
    )
  const regularAuthorized =
    quiz.ownerId === userId || isAdministrator(quiz.permissions)
  const assessmentAuthorized =
    quiz.course !== null && isAdministrator(quiz.course.permissions)
  if (
    (quiz.isAssessmentEnabled && !assessmentAuthorized) ||
    (!quiz.isAssessmentEnabled && !regularAuthorized)
  ) {
    throw resetError('FORBIDDEN', 'LIVE_QUIZ_RESET_FORBIDDEN')
  }
  return quiz
}

type ResettableQuiz = NonNullable<
  Awaited<ReturnType<typeof loadResettableQuiz>>
>

async function resolveAppliedRewardRun({
  quiz,
  ctx,
  tx,
}: {
  quiz: ResettableQuiz
  ctx: ContextWithUser
  tx: DB.Prisma.TransactionClient
}): Promise<string | 'REWARD_DATA_UNAVAILABLE' | null> {
  const activeRun = quiz.activeRewardRun
  const appliedRuns = quiz.rewardRuns.filter(
    (run) => run.status === DB.LiveQuizRewardRunStatus.APPLIED
  )
  const hasAnyRewardRunState =
    quiz.activeRewardRunId !== null || quiz.rewardRuns.length > 0

  if (hasAnyRewardRunState) {
    const validActiveRun =
      activeRun !== null &&
      quiz.activeRewardRunId === activeRun.id &&
      activeRun.liveQuizId === quiz.id &&
      activeRun.status === DB.LiveQuizRewardRunStatus.APPLIED &&
      quiz.finishedAt !== null &&
      activeRun.endedAt.getTime() === quiz.finishedAt.getTime() &&
      appliedRuns.length === 1 &&
      appliedRuns[0]!.id === activeRun.id &&
      hasValidLiveQuizRewardEntries(activeRun.entries, {
        persisted: true,
        uniqueParticipants: true,
      }) &&
      (quiz.isGamificationEnabled || activeRun.entries.length === 0)
    return validActiveRun ? activeRun.id : 'REWARD_DATA_UNAVAILABLE'
  }

  if (!quiz.isGamificationEnabled) return null

  const inspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: quiz.id, prisma: tx },
    ctx
  )
  if (inspection.status === 'UNAVAILABLE') {
    return 'REWARD_DATA_UNAVAILABLE'
  }
  try {
    return await persistLiveQuizRewardRun({
      liveQuizId: quiz.id,
      plan: inspection.plan,
      tx,
    })
  } catch (error) {
    if (isRewardRunConflict(error)) {
      throw resetError(
        'LIVE_QUIZ_RESET_CONFLICT',
        'Live quiz reward state changed while it was being reconstructed'
      )
    }
    throw error
  }
}

function errorCode(error: unknown): unknown {
  return typeof error === 'object' &&
    error !== null &&
    'extensions' in error &&
    typeof error.extensions === 'object' &&
    error.extensions !== null &&
    'code' in error.extensions
    ? error.extensions.code
    : undefined
}

function isPrismaSerializationConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2034'
  )
}

function isRewardRunConflict(error: unknown): boolean {
  return (
    errorCode(error) === 'LIVE_QUIZ_REWARD_CONFLICT' ||
    errorCode(error) === 'LIVE_QUIZ_RESET_CONFLICT'
  )
}

function isRewardDataUnavailable(error: unknown): boolean {
  return errorCode(error) === 'LIVE_QUIZ_REWARD_DATA_UNAVAILABLE'
}

export async function executeLiveQuizReset(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<ResetLiveQuizServiceResult> {
  try {
    return await ctx.prisma.$transaction(
      async (tx) => {
        const quiz = await loadResettableQuiz({
          id,
          userId: ctx.user.sub,
          tx,
        })
        if (
          !quiz ||
          quiz.isDeleted ||
          quiz.status !== DB.PublicationStatus.ENDED
        ) {
          return { outcome: 'INVALID_STATE', activity: null }
        }

        const rewardRunId = quiz.isAssessmentEnabled
          ? null
          : await resolveAppliedRewardRun({ quiz, ctx, tx })
        if (rewardRunId === 'REWARD_DATA_UNAVAILABLE') {
          return { outcome: 'REWARD_DATA_UNAVAILABLE', activity: null }
        }

        let totals: RewardReversalTotals = {
          coursePoints: 0,
          participantXp: 0,
          timelineChanges: 0,
          achievementChanges: 0,
        }
        let weeklyTimelineRecomputations: WeeklyTimelineRecomputation[] = []
        if (rewardRunId) {
          const reversal = await reverseLiveQuizRewardRun({
            rewardRunId,
            actorId: ctx.user.sub,
            tx,
          })
          totals = reversal.totals
          weeklyTimelineRecomputations = reversal.weeklyTimelineRecomputations
        }

        const updatedQuiz = await resetLiveQuizExecutionState({
          liveQuizId: id,
          userId: ctx.user.sub,
          tx,
        })
        return {
          outcome: 'SUCCESS',
          activity: formatResetActivityInfo(updatedQuiz),
          rewardRunId,
          totals,
          weeklyTimelineRecomputations,
        }
      },
      {
        isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable,
        timeout: 60000,
      }
    )
  } catch (error) {
    if (isPrismaSerializationConflict(error) || isRewardRunConflict(error)) {
      return { outcome: 'CONFLICT', activity: null }
    }
    if (isRewardDataUnavailable(error)) {
      return { outcome: 'REWARD_DATA_UNAVAILABLE', activity: null }
    }
    throw error
  }
}

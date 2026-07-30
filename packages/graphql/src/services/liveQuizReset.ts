import * as DB from '@klicker-uzh/prisma/client'
import { ActivityType } from '@klicker-uzh/types'
import { getInitialInstanceResults } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
import { getPermissionBooleans } from './activities.js'
import {
  inspectLegacyRegularLiveQuizRewards,
  persistLiveQuizRewardRun,
  reverseLiveQuizRewardRun,
  type LiveQuizRewardPlan,
  type RewardReversalTotals,
  type WeeklyTimelineRecomputation,
} from './liveQuizRewards.js'

export type LiveQuizResetOutcome =
  | 'SUCCESS'
  | 'INVALID_STATE'
  | 'REWARD_DATA_UNAVAILABLE'
  | 'CONFLICT'

export type LiveQuizResetEligibilityReason =
  | 'ELIGIBLE'
  | 'INVALID_STATE'
  | 'ASSESSMENT_POLICY'
  | 'REWARD_DATA_UNAVAILABLE'

export type LiveQuizLegacyReconstructionStatus =
  | 'NOT_REQUIRED'
  | 'AVAILABLE'
  | 'UNAVAILABLE'

export interface LiveQuizResetSummary {
  numOfResponses: number
  numOfFeedbacks: number
  numOfConfusionFeedbacks: number
  numOfLeaderboardEntries: number
  coursePointsToReverse: number
  xpToReverse: number
  numOfTimelineChanges: number
  numOfAchievementChanges: number
  eligible: boolean
  reason: LiveQuizResetEligibilityReason
  legacyReconstructionStatus: LiveQuizLegacyReconstructionStatus
}

interface RewardSummary {
  coursePointsToReverse: number
  xpToReverse: number
  numOfTimelineChanges: number
  numOfAchievementChanges: number
}

function summarizeRewardPlan(plan: LiveQuizRewardPlan): RewardSummary {
  return plan.entries.reduce<RewardSummary>(
    (summary, entry) => ({
      coursePointsToReverse:
        summary.coursePointsToReverse + entry.coursePointsAwarded,
      xpToReverse: summary.xpToReverse + entry.participantXpAwarded,
      numOfTimelineChanges:
        summary.numOfTimelineChanges +
        (entry.participationId !== null &&
        entry.courseId !== null &&
        entry.timelineDate !== null &&
        (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
          ? 1
          : 0),
      numOfAchievementChanges:
        summary.numOfAchievementChanges +
        (entry.achievementId !== null && entry.achievementCountAwarded !== 0
          ? 1
          : 0),
    }),
    {
      coursePointsToReverse: 0,
      xpToReverse: 0,
      numOfTimelineChanges: 0,
      numOfAchievementChanges: 0,
    }
  )
}

function hasValidRewardEntries(
  entries: Array<{
    participantId: string | null
    participationId: number | null
    participation: {
      participantId: string
      courseId: string
    } | null
    courseId: string | null
    coursePointsAwarded: number
    participantXpAwarded: number
    timelineDate: Date | null
    timelinePointsAwarded: number
    timelineXpAwarded: number
    achievementId: number | null
    achievementCountAwarded: number
  }>
): boolean {
  return entries.every(
    (entry) =>
      entry.participantId !== null &&
      (entry.participationId === null ||
        (entry.participation !== null &&
          entry.participation.participantId === entry.participantId &&
          entry.participation.courseId === entry.courseId)) &&
      (entry.coursePointsAwarded === 0 ||
        (entry.participationId !== null && entry.courseId !== null)) &&
      (entry.timelinePointsAwarded === 0 && entry.timelineXpAwarded === 0
        ? true
        : entry.participationId !== null &&
          entry.courseId !== null &&
          entry.timelineDate !== null) &&
      (entry.achievementCountAwarded === 0 || entry.achievementId !== null)
  )
}

export async function getLiveQuizResetSummary(
  { quizId }: { quizId: string },
  ctx: ContextWithUser
): Promise<LiveQuizResetSummary | null> {
  const liveQuiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      permissions: {
        where: { userId: ctx.user.sub },
        select: { permissionLevel: true },
      },
      course: {
        include: {
          permissions: {
            where: { userId: ctx.user.sub },
            select: { permissionLevel: true },
          },
        },
      },
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
      blocks: {
        select: {
          elements: {
            select: {
              results: true,
              anonymousResults: true,
              _count: { select: { liveQuizResponses: true } },
            },
          },
        },
      },
      _count: {
        select: {
          feedbacks: true,
          confusionFeedbacks: true,
          leaderboard: true,
          temporaryLeaderboard: true,
        },
      },
    },
  })

  if (!liveQuiz) {
    return null
  }

  const isAdministrator = (
    permissions: Array<{ permissionLevel: DB.PermissionLevel }>
  ) =>
    permissions.some(
      (permission) =>
        permission.permissionLevel === DB.PermissionLevel.ADMIN ||
        permission.permissionLevel === DB.PermissionLevel.OWNER
    )
  const canReset = liveQuiz.isAssessmentEnabled
    ? liveQuiz.course !== null && isAdministrator(liveQuiz.course.permissions)
    : liveQuiz.ownerId === ctx.user.sub || isAdministrator(liveQuiz.permissions)

  if (!canReset) {
    return null
  }

  const numOfResponses = liveQuiz.blocks.reduce(
    (quizTotal, block) =>
      quizTotal +
      block.elements.reduce(
        (blockTotal, instance) =>
          blockTotal +
          Math.max(
            instance._count.liveQuizResponses,
            instance.results.total + instance.anonymousResults.total
          ),
        0
      ),
    0
  )
  const quizCounts = {
    numOfResponses,
    numOfFeedbacks: liveQuiz._count.feedbacks,
    numOfConfusionFeedbacks: liveQuiz._count.confusionFeedbacks,
    numOfLeaderboardEntries:
      liveQuiz._count.leaderboard + liveQuiz._count.temporaryLeaderboard,
  }
  const emptyRewardSummary: RewardSummary = {
    coursePointsToReverse: 0,
    xpToReverse: 0,
    numOfTimelineChanges: 0,
    numOfAchievementChanges: 0,
  }

  if (liveQuiz.status !== DB.PublicationStatus.ENDED || liveQuiz.isDeleted) {
    return {
      ...quizCounts,
      ...emptyRewardSummary,
      eligible: false,
      reason: 'INVALID_STATE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
    }
  }

  if (liveQuiz.isAssessmentEnabled) {
    return {
      ...quizCounts,
      ...emptyRewardSummary,
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
    }
  }

  const activeRun = liveQuiz.activeRewardRun
  const appliedRuns = liveQuiz.rewardRuns.filter(
    (run) => run.status === DB.LiveQuizRewardRunStatus.APPLIED
  )
  const hasValidActiveRun =
    activeRun !== null &&
    liveQuiz.activeRewardRunId === activeRun.id &&
    activeRun.liveQuizId === liveQuiz.id &&
    activeRun.status === DB.LiveQuizRewardRunStatus.APPLIED &&
    liveQuiz.finishedAt !== null &&
    activeRun.endedAt.getTime() === liveQuiz.finishedAt.getTime() &&
    appliedRuns.length === 1 &&
    appliedRuns[0]!.id === activeRun.id &&
    hasValidRewardEntries(activeRun.entries)
  const hasAnyRewardRunState =
    liveQuiz.activeRewardRunId !== null || liveQuiz.rewardRuns.length > 0

  if (hasValidActiveRun) {
    if (!liveQuiz.isGamificationEnabled && activeRun.entries.length > 0) {
      return {
        ...quizCounts,
        ...emptyRewardSummary,
        eligible: false,
        reason: 'REWARD_DATA_UNAVAILABLE',
        legacyReconstructionStatus: 'UNAVAILABLE',
      }
    }

    return {
      ...quizCounts,
      ...summarizeRewardPlan({
        endedAt: activeRun.endedAt,
        isLegacyReconstructed: activeRun.isLegacyReconstructed,
        entries: activeRun.entries.flatMap((entry) =>
          entry.participantId === null
            ? []
            : [
                {
                  participantId: entry.participantId,
                  participationId: entry.participationId,
                  courseId: entry.courseId,
                  coursePointsAwarded: entry.coursePointsAwarded,
                  participantXpAwarded: entry.participantXpAwarded,
                  timelineDate: entry.timelineDate,
                  timelinePointsAwarded: entry.timelinePointsAwarded,
                  timelineXpAwarded: entry.timelineXpAwarded,
                  achievementId: entry.achievementId,
                  achievementCountAwarded: entry.achievementCountAwarded,
                },
              ]
        ),
      }),
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
    }
  }

  if (hasAnyRewardRunState) {
    return {
      ...quizCounts,
      ...emptyRewardSummary,
      eligible: false,
      reason: 'REWARD_DATA_UNAVAILABLE',
      legacyReconstructionStatus: 'UNAVAILABLE',
    }
  }

  if (!liveQuiz.isGamificationEnabled) {
    return {
      ...quizCounts,
      ...emptyRewardSummary,
      eligible: true,
      reason: 'ELIGIBLE',
      legacyReconstructionStatus: 'NOT_REQUIRED',
    }
  }

  const legacyInspection = await inspectLegacyRegularLiveQuizRewards(
    { liveQuizId: liveQuiz.id },
    ctx
  )
  if (legacyInspection.status === 'UNAVAILABLE') {
    return {
      ...quizCounts,
      ...emptyRewardSummary,
      eligible: false,
      reason: 'REWARD_DATA_UNAVAILABLE',
      legacyReconstructionStatus: 'UNAVAILABLE',
    }
  }

  return {
    ...quizCounts,
    ...summarizeRewardPlan(legacyInspection.plan),
    eligible: true,
    reason: 'ELIGIBLE',
    legacyReconstructionStatus: 'AVAILABLE',
  }
}

function resetActivityInfoInclude(userId: string) {
  return {
    course: true,
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
  const permission = activity.permissions[0]
  const isImplicitOwner =
    permission === undefined && activity.ownerId === activity.resetUserId
  if (!permission && !isImplicitOwner) {
    throw resetError(
      'LIVE_QUIZ_RESET_PERMISSION_MISSING',
      'Reset activity permission could not be formatted safely'
    )
  }
  const permissionLevel =
    permission?.permissionLevel ?? DB.PermissionLevel.OWNER
  const derived = permission?.derived ?? false
  const access = getPermissionBooleans({
    permissionLevel,
    derived,
    directGroupPermission:
      permission?.directPermission?.userGroupId !== null &&
      permission?.directPermission?.userGroupId !== undefined,
  })
  return {
    id: activity.id,
    templateId: activity.templateInfo?.id ?? null,
    name: activity.name,
    displayName: activity.displayName,
    reviewStatus: activity.reviewStatus,
    type: ActivityType.LIVE_QUIZ,
    status: activity.status,
    courseId: activity.courseId,
    courseName: activity.course?.name,
    courseStartDate: activity.course?.startDate,
    courseLanguage: activity.course?.language,
    numOfStacks: activity.blocks.length,
    numOfElements: activity.blocks.reduce(
      (total, block) => total + block._count.elements,
      0
    ),
    permissionLevel,
    derivedAccess: derived,
    areInstancesOutdated: activity.areInstancesOutdated,
    isGamificationEnabled: activity.isGamificationEnabled,
    isAssessmentEnabled: activity.isAssessmentEnabled,
    pinCode: activity.pinCode,
    numSharedUsers: Math.max(0, activity._count.permissions - 1),
    ...access,
    isActivityReviewer: activity.isAssessmentEnabled,
    updatedAt: activity.updatedAt,
  }
}

export type ResetActivityInfo = ReturnType<typeof formatResetActivityInfo>

export type ResetLiveQuizServiceResult =
  | {
      outcome: 'SUCCESS'
      activity: ResetActivityInfo
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
    throw resetError(
      'LIVE_QUIZ_RESET_FORBIDDEN',
      'Only an activity owner or administrator can reset this live quiz'
    )
  }
  return quiz
}

type ResettableQuiz = NonNullable<
  Awaited<ReturnType<typeof loadResettableQuiz>>
>

function hasConsistentLedgerEntries(
  entries: ResettableQuiz['activeRewardRun'] extends null
    ? never
    : NonNullable<ResettableQuiz['activeRewardRun']>['entries']
): boolean {
  const participantIds = new Set<string>()
  return entries.every((entry) => {
    if (
      entry.participantId === null ||
      participantIds.has(entry.participantId)
    ) {
      return false
    }
    participantIds.add(entry.participantId)
    return (
      (entry.participationId === null ||
        (entry.participation !== null &&
          entry.participation.participantId === entry.participantId &&
          entry.participation.courseId === entry.courseId)) &&
      (entry.coursePointsAwarded === 0 ||
        (entry.participationId !== null && entry.courseId !== null)) &&
      (entry.timelinePointsAwarded === 0 && entry.timelineXpAwarded === 0
        ? true
        : entry.participationId !== null &&
          entry.courseId !== null &&
          entry.timelineDate !== null) &&
      (entry.achievementCountAwarded === 0 || entry.achievementId !== null)
    )
  })
}

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
      hasConsistentLedgerEntries(activeRun.entries) &&
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

export async function resetLiveQuiz(
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

export async function resetAssessmentLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
) {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id, isAssessmentEnabled: true },
    select: { id: true },
  })
  if (!quiz) return null
  try {
    const result = await resetLiveQuiz({ id }, ctx)
    return result.outcome === 'SUCCESS' ? result.activity : null
  } catch {
    return null
  }
}

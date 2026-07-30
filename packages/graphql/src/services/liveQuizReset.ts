import * as DB from '@klicker-uzh/prisma/client'
import type {
  CleanupLiveQuizResetCacheInput,
  HatchetHandlers,
  LiveQuizResetCacheGenerationSnapshot,
} from '@klicker-uzh/types'
import { ActivityType } from '@klicker-uzh/types'
import { getInitialInstanceResults } from '@klicker-uzh/util'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import { v4 as uuidv4 } from 'uuid'
import type { ContextWithUser } from '../lib/context.js'
import { getPermissionBooleans } from './activities.js'
import {
  inspectLegacyRegularLiveQuizRewards,
  persistLiveQuizRewardRun,
  recomputeWeeklyTimelineEntry,
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
    numSharedUsers: Math.max(
      0,
      activity._count.permissions - (isImplicitOwner ? 0 : 1)
    ),
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
    throw resetError('FORBIDDEN', 'LIVE_QUIZ_RESET_FORBIDDEN')
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

async function executeLiveQuizReset(
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

const CLEAR_LIVE_QUIZ_CACHE_SCRIPT = `
local currentGeneration = redis.call('HGET', KEYS[1], 'cacheGeneration')
if ARGV[1] == 'LEGACY' then
  if currentGeneration then
    return 0
  end
elseif currentGeneration ~= ARGV[2] then
  return 0
end
for index = 1, #KEYS do
  redis.call('UNLINK', KEYS[index])
end
return 1
`

const INITIALIZE_LIVE_QUIZ_CACHE_SCRIPT = `
for index = 1, #KEYS do
  redis.call('UNLINK', KEYS[index])
end
redis.call(
  'HSET',
  KEYS[1],
  'namespace', ARGV[1],
  'startedAt', ARGV[2],
  'isGamificationEnabled', ARGV[3],
  'isAssessmentEnabled', ARGV[4],
  'cacheGeneration', ARGV[5]
)
return ARGV[5]
`

async function scanLiveQuizExecutionKeys({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<string[]> {
  const keys = new Set<string>()
  let cursor = '0'
  do {
    const [nextCursor, batch] = await redis.scan(
      cursor,
      'MATCH',
      `lq:${liveQuizId}:*`,
      'COUNT',
      500
    )
    cursor = nextCursor
    for (const key of batch) keys.add(key)
  } while (cursor !== '0')
  return [...keys]
}

function includeMetaKey(liveQuizId: string, keys: string[]): string[] {
  const metaKey = `lq:${liveQuizId}:meta`
  return [metaKey, ...keys.filter((key) => key !== metaKey)]
}

async function clearAllLiveQuizExecutionCache({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<void> {
  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  await redis.unlink(...keys)
}

export async function clearLiveQuizExecutionCache({
  liveQuizId,
  redis,
  cacheGenerationSnapshot,
}: {
  liveQuizId: string
  redis: Redis
  cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
}): Promise<boolean> {
  if (cacheGenerationSnapshot.status === 'UNAVAILABLE') return false

  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  const legacy =
    cacheGenerationSnapshot.generation === null ? 'LEGACY' : 'GENERATED'
  const cleared = await redis.eval(
    CLEAR_LIVE_QUIZ_CACHE_SCRIPT,
    keys.length,
    ...keys,
    legacy,
    cacheGenerationSnapshot.generation ?? ''
  )
  return cleared === 1
}

async function recoverAndClearUnavailableLiveQuizExecutionCache({
  liveQuizId,
  redis,
  prisma,
}: {
  liveQuizId: string
  redis: Redis
  prisma: DB.PrismaClient
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "LiveQuiz"
      WHERE "id" = ${liveQuizId}::uuid
      FOR UPDATE
    `
    if (lockedRows.length === 0) {
      await clearAllLiveQuizExecutionCache({ liveQuizId, redis })
      return
    }

    const quiz = await tx.liveQuiz.findUnique({
      where: { id: liveQuizId },
      select: { status: true, isDeleted: true },
    })
    if (!quiz || quiz.isDeleted) {
      await clearAllLiveQuizExecutionCache({ liveQuizId, redis })
      return
    }
    if (
      quiz.status !== DB.PublicationStatus.DRAFT &&
      quiz.status !== DB.PublicationStatus.SCHEDULED
    ) {
      return
    }

    const generation = await redis.hget(
      `lq:${liveQuizId}:meta`,
      'cacheGeneration'
    )
    const cleared = await clearLiveQuizExecutionCache({
      liveQuizId,
      redis,
      cacheGenerationSnapshot: {
        status: 'AVAILABLE',
        generation,
      },
    })
    if (!cleared) {
      throw new Error('Live quiz cache generation changed during cleanup')
    }
  })
}

export async function initializeLiveQuizExecutionCache({
  liveQuizId,
  namespace,
  isGamificationEnabled,
  isAssessmentEnabled,
  redis,
  startedAt,
}: {
  liveQuizId: string
  namespace: string
  isGamificationEnabled: boolean
  isAssessmentEnabled: boolean
  redis: Redis
  startedAt: Date
}): Promise<string> {
  const keys = includeMetaKey(
    liveQuizId,
    await scanLiveQuizExecutionKeys({ liveQuizId, redis })
  )
  const cacheGeneration = uuidv4()
  await redis.eval(
    INITIALIZE_LIVE_QUIZ_CACHE_SCRIPT,
    keys.length,
    ...keys,
    namespace,
    startedAt.getTime(),
    String(isGamificationEnabled),
    String(isAssessmentEnabled),
    cacheGeneration
  )
  return cacheGeneration
}

export const handleCleanupLiveQuizResetCache: HatchetHandlers['handleCleanupLiveQuizResetCache'] =
  async (
    {
      liveQuizId,
      isAssessmentEnabled,
      cacheGenerationSnapshot,
      weeklyTimelineRecomputations,
    },
    globalCtx
  ) => {
    for (const recomputation of weeklyTimelineRecomputations) {
      await recomputeWeeklyTimelineEntry({
        participationId: recomputation.participationId,
        courseId: recomputation.courseId,
        weekStart: new Date(recomputation.weekStart),
        prisma: globalCtx.prisma,
      })
    }
    const redis = isAssessmentEnabled
      ? globalCtx.redisAssessmentExec
      : globalCtx.redisExec
    if (cacheGenerationSnapshot.status === 'UNAVAILABLE') {
      await recoverAndClearUnavailableLiveQuizExecutionCache({
        liveQuizId,
        redis,
        prisma: globalCtx.prisma,
      })
    } else {
      await clearLiveQuizExecutionCache({
        liveQuizId,
        redis,
        cacheGenerationSnapshot,
      })
    }
    return true
  }

type LiveQuizResetAuditDetails =
  | {
      event: 'LIVE_QUIZ_RESET_INITIATED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 1
    }
  | {
      event: 'LIVE_QUIZ_RESET_BLOCKED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      outcome: Exclude<LiveQuizResetOutcome, 'SUCCESS'>
    }
  | {
      event: 'LIVE_QUIZ_RESET_COMPLETED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      rewardRunId: string | null
      outcome: 'SUCCESS'
      coursePoints: number
      participantXp: number
      timelineChanges: number
      achievementChanges: number
    }
  | {
      event: 'LIVE_QUIZ_RESET_FAILED'
      actorId: string
      liveQuizId: string
      operationId: string
      occurredAt: string
      sequence: 2
      failureCode: 'UNEXPECTED_RESET_FAILURE'
    }

async function enqueueLiveQuizResetAudit(
  ctx: ContextWithUser,
  details: LiveQuizResetAuditDetails
): Promise<void> {
  await ctx.tasks.createAuditLogEntry.runNoWait([
    { message: { info: JSON.stringify(details) } },
  ])
}

function logResetDeliveryFailure(
  delivery: 'audit' | 'cleanup' | 'invalidation'
): void {
  console.error(`Failed to deliver live quiz reset ${delivery}`)
}

async function snapshotResetCacheGeneration({
  id,
  ctx,
}: {
  id: string
  ctx: ContextWithUser
}): Promise<LiveQuizResetCacheGenerationSnapshot> {
  const quiz = await ctx.prisma.liveQuiz.findUnique({
    where: { id },
    select: {
      status: true,
      isDeleted: true,
      isAssessmentEnabled: true,
    },
  })
  if (!quiz || quiz.isDeleted || quiz.status !== DB.PublicationStatus.ENDED) {
    return { status: 'UNAVAILABLE' }
  }

  const redis = quiz.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec
  try {
    return {
      status: 'AVAILABLE',
      generation: await redis.hget(`lq:${id}:meta`, 'cacheGeneration'),
    }
  } catch {
    return { status: 'UNAVAILABLE' }
  }
}

async function runPostCommitCleanup({
  id,
  result,
  cacheGenerationSnapshot,
  ctx,
}: {
  id: string
  result: Extract<ResetLiveQuizServiceResult, { outcome: 'SUCCESS' }>
  cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
  ctx: ContextWithUser
}): Promise<void> {
  const cleanupInput: CleanupLiveQuizResetCacheInput = {
    liveQuizId: id,
    isAssessmentEnabled: result.activity.isAssessmentEnabled,
    cacheGenerationSnapshot,
    weeklyTimelineRecomputations: result.weeklyTimelineRecomputations.map(
      (entry) => ({
        participationId: entry.participationId,
        courseId: entry.courseId,
        weekStart: entry.weekStart.toISOString(),
      })
    ),
  }
  const redis = result.activity.isAssessmentEnabled
    ? ctx.redisAssessmentExec
    : ctx.redisExec

  let fallbackRequired = false
  try {
    for (const recomputation of result.weeklyTimelineRecomputations) {
      await recomputeWeeklyTimelineEntry({
        ...recomputation,
        prisma: ctx.prisma,
      })
    }
    fallbackRequired = !(await clearLiveQuizExecutionCache({
      liveQuizId: id,
      redis,
      cacheGenerationSnapshot,
    }))
  } catch {
    fallbackRequired = true
  }

  if (fallbackRequired) {
    try {
      await ctx.tasks.cleanupLiveQuizResetCache.runNoWait([cleanupInput])
    } catch {
      logResetDeliveryFailure('cleanup')
    }
  }

  try {
    ctx.emitter.emit('invalidate', { typename: 'LiveQuiz', id })
  } catch {
    logResetDeliveryFailure('invalidation')
  }
}

export async function resetLiveQuiz(
  { id }: { id: string },
  ctx: ContextWithUser
): Promise<ResetLiveQuizServiceResult> {
  const operationId = uuidv4()
  await enqueueLiveQuizResetAudit(ctx, {
    event: 'LIVE_QUIZ_RESET_INITIATED',
    actorId: ctx.user.sub,
    liveQuizId: id,
    operationId,
    occurredAt: new Date().toISOString(),
    sequence: 1,
  })

  let result: ResetLiveQuizServiceResult
  let cacheGenerationSnapshot: LiveQuizResetCacheGenerationSnapshot
  try {
    cacheGenerationSnapshot = await snapshotResetCacheGeneration({ id, ctx })
    result = await executeLiveQuizReset({ id }, ctx)
  } catch (error) {
    try {
      await enqueueLiveQuizResetAudit(ctx, {
        event: 'LIVE_QUIZ_RESET_FAILED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        operationId,
        occurredAt: new Date().toISOString(),
        sequence: 2,
        failureCode: 'UNEXPECTED_RESET_FAILURE',
      })
    } catch {
      logResetDeliveryFailure('audit')
    }
    throw error
  }

  if (result.outcome === 'SUCCESS') {
    await runPostCommitCleanup({
      id,
      result,
      cacheGenerationSnapshot,
      ctx,
    })
    try {
      await enqueueLiveQuizResetAudit(ctx, {
        event: 'LIVE_QUIZ_RESET_COMPLETED',
        actorId: ctx.user.sub,
        liveQuizId: id,
        operationId,
        occurredAt: new Date().toISOString(),
        sequence: 2,
        rewardRunId: result.rewardRunId,
        outcome: result.outcome,
        coursePoints: result.totals.coursePoints,
        participantXp: result.totals.participantXp,
        timelineChanges: result.totals.timelineChanges,
        achievementChanges: result.totals.achievementChanges,
      })
    } catch {
      logResetDeliveryFailure('audit')
    }
    return result
  }

  try {
    await enqueueLiveQuizResetAudit(ctx, {
      event: 'LIVE_QUIZ_RESET_BLOCKED',
      actorId: ctx.user.sub,
      liveQuizId: id,
      operationId,
      occurredAt: new Date().toISOString(),
      sequence: 2,
      outcome: result.outcome,
    })
  } catch {
    logResetDeliveryFailure('audit')
  }
  return result
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

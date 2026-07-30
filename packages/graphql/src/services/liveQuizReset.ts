import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import {
  inspectLegacyRegularLiveQuizRewards,
  type LiveQuizRewardPlan,
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
      activeRewardRun: { include: { entries: true } },
      rewardRuns: { select: { id: true, status: true } },
      blocks: {
        select: {
          elements: {
            select: { results: true, anonymousResults: true },
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
          blockTotal + instance.results.total + instance.anonymousResults.total,
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

import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import { loadLiveQuizRewardCurrentState } from './liveQuizRewardState.js'
import type {
  ApplyRegularLiveQuizRewardPlanInput,
  LiveQuizRewardDelta,
  PersistLiveQuizRewardRunInput,
} from './liveQuizRewardTypes.js'
import {
  isoWeekStart,
  rewardPairKey,
  timelineKey,
} from './liveQuizRewardUtils.js'
import { validateLiveQuizRewardEntries } from './liveQuizRewardValidation.js'
import { getTimelineWeekBounds } from './participants.js'

async function applyDailyTimelineDelta({
  entry,
  tx,
}: {
  entry: LiveQuizRewardDelta
  tx: DB.Prisma.TransactionClient
}): Promise<void> {
  await tx.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId: entry.participationId!,
        courseId: entry.courseId!,
        timestamp: entry.timelineDate!,
        type: DB.TimelineEntryType.DAILY,
      },
    },
    create: {
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      timestamp: entry.timelineDate!,
      type: DB.TimelineEntryType.DAILY,
      collectedPoints: entry.timelinePointsAwarded,
      collectedXp: entry.timelineXpAwarded,
      computedAt: new Date(),
    },
    update: {
      collectedPoints: { increment: entry.timelinePointsAwarded },
      collectedXp: { increment: entry.timelineXpAwarded },
      computedAt: new Date(),
    },
  })
}

function rewardConflict(message: string): GraphQLError {
  return new GraphQLError(message, {
    extensions: { code: 'LIVE_QUIZ_REWARD_CONFLICT' },
  })
}

async function createRewardRunRecord({
  liveQuizId,
  plan,
  tx,
}: PersistLiveQuizRewardRunInput): Promise<string> {
  if (plan.entries.some((entry) => !entry.participantId)) {
    throw rewardConflict('Every live quiz reward entry needs a participant')
  }

  const liveQuiz = await tx.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: {
      status: true,
      activeRewardRun: {
        select: { id: true, liveQuizId: true, status: true },
      },
      rewardRuns: {
        where: { status: DB.LiveQuizRewardRunStatus.APPLIED },
        select: { id: true },
        take: 1,
      },
    },
  })

  if (!liveQuiz || liveQuiz.status !== DB.PublicationStatus.ENDED) {
    throw rewardConflict('Live quiz must be ended before rewards are persisted')
  }

  if (
    liveQuiz.activeRewardRun !== null &&
    (liveQuiz.activeRewardRun.liveQuizId !== liveQuizId ||
      liveQuiz.activeRewardRun.status !== DB.LiveQuizRewardRunStatus.APPLIED)
  ) {
    throw rewardConflict('Live quiz has an invalid active reward run')
  }

  if (liveQuiz.activeRewardRun !== null) {
    throw rewardConflict('Live quiz already has an active reward run')
  }

  if (liveQuiz.rewardRuns.length > 0) {
    throw rewardConflict('Live quiz already has an applied reward run')
  }

  const rewardRun = await tx.liveQuizRewardRun.create({
    data: {
      liveQuizId,
      endedAt: plan.endedAt,
      isLegacyReconstructed: plan.isLegacyReconstructed,
      entries: { create: plan.entries },
    },
  })

  const pointed = await tx.liveQuiz.updateMany({
    where: {
      id: liveQuizId,
      status: DB.PublicationStatus.ENDED,
      activeRewardRunId: null,
    },
    data: { activeRewardRunId: rewardRun.id },
  })

  if (pointed.count !== 1) {
    throw rewardConflict('Live quiz reward run could not be activated')
  }

  return rewardRun.id
}

export async function persistLiveQuizRewardRun(
  input: PersistLiveQuizRewardRunInput
): Promise<string> {
  return createRewardRunRecord(input)
}

export async function applyRegularLiveQuizRewardPlan({
  liveQuizId,
  plan,
  tx,
}: ApplyRegularLiveQuizRewardPlanInput): Promise<string> {
  for (const entry of plan.entries) {
    if (entry.participantXpAwarded !== 0) {
      await tx.participant.update({
        where: { id: entry.participantId },
        data: { xp: { increment: entry.participantXpAwarded } },
      })
    }

    if (
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.coursePointsAwarded !== 0
    ) {
      await tx.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: DB.LeaderboardType.COURSE,
            participantId: entry.participantId,
            courseId: entry.courseId,
          },
        },
        create: {
          type: DB.LeaderboardType.COURSE,
          participantId: entry.participantId,
          courseId: entry.courseId,
          participation: { connect: { id: entry.participationId } },
          score: entry.coursePointsAwarded,
        },
        update: { score: { increment: entry.coursePointsAwarded } },
      })
    }

    if (
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.timelineDate !== null
    ) {
      await applyDailyTimelineDelta({ entry, tx })
    }

    if (entry.achievementId !== null && entry.achievementCountAwarded !== 0) {
      await tx.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: entry.participantId,
            achievementId: entry.achievementId,
          },
        },
        create: {
          participantId: entry.participantId,
          achievementId: entry.achievementId,
          achievedAt: plan.endedAt,
          achievedCount: entry.achievementCountAwarded,
        },
        update: {
          achievedCount: { increment: entry.achievementCountAwarded },
        },
      })
    }
  }

  return createRewardRunRecord({ liveQuizId, plan, tx })
}

export interface RewardReversalTotals {
  coursePoints: number
  participantXp: number
  timelineChanges: number
  achievementChanges: number
}

export interface WeeklyTimelineRecomputation {
  participationId: number
  courseId: string
  weekStart: Date
}

export interface RewardReversalResult {
  totals: RewardReversalTotals
  weeklyTimelineRecomputations: WeeklyTimelineRecomputation[]
}

function rewardReversalError(code: string, message: string): GraphQLError {
  return new GraphQLError(message, { extensions: { code } })
}

function timelineEntryKey({
  participationId,
  courseId,
  timestamp,
  type,
}: {
  participationId: number
  courseId: string
  timestamp: Date
  type: DB.TimelineEntryType
}): string {
  return `${participationId}:${courseId}:${timestamp.toISOString()}:${type}`
}

export async function recomputeWeeklyTimelineEntry({
  participationId,
  courseId,
  weekStart,
  prisma,
}: {
  participationId: number
  courseId: string
  weekStart: Date
  prisma: DB.Prisma.TransactionClient | DB.PrismaClient
}): Promise<void> {
  const canonicalWeekStart = getTimelineWeekBounds(weekStart).weekStart
  const { weekEnd } = getTimelineWeekBounds(canonicalWeekStart)
  const daily = await prisma.timelineEntry.aggregate({
    where: {
      participationId,
      courseId,
      type: DB.TimelineEntryType.DAILY,
      timestamp: { gte: canonicalWeekStart, lt: weekEnd },
    },
    _sum: { collectedPoints: true, collectedXp: true },
  })
  const collectedPoints = daily._sum.collectedPoints ?? 0
  const collectedXp = daily._sum.collectedXp ?? 0

  if (collectedPoints === 0 && collectedXp === 0) {
    await prisma.timelineEntry.deleteMany({
      where: {
        participationId,
        courseId,
        type: DB.TimelineEntryType.WEEKLY,
        timestamp: canonicalWeekStart,
      },
    })
    return
  }

  await prisma.timelineEntry.upsert({
    where: {
      participationId_courseId_timestamp_type: {
        participationId,
        courseId,
        timestamp: canonicalWeekStart,
        type: DB.TimelineEntryType.WEEKLY,
      },
    },
    create: {
      participationId,
      courseId,
      type: DB.TimelineEntryType.WEEKLY,
      timestamp: canonicalWeekStart,
      collectedPoints,
      collectedXp,
      computedAt: new Date(),
    },
    update: {
      collectedPoints,
      collectedXp,
      computedAt: new Date(),
    },
  })
}

export async function reverseLiveQuizRewardRun({
  rewardRunId,
  actorId,
  tx,
}: {
  rewardRunId: string
  actorId: string
  tx: DB.Prisma.TransactionClient
}): Promise<RewardReversalResult> {
  const run = await tx.liveQuizRewardRun.findUnique({
    where: { id: rewardRunId },
    include: {
      activeForLiveQuiz: {
        select: {
          id: true,
          activeRewardRunId: true,
          status: true,
          isDeleted: true,
          finishedAt: true,
        },
      },
      entries: {
        include: {
          participation: {
            select: { participantId: true, courseId: true },
          },
        },
      },
    },
  })
  if (
    !run ||
    run.status !== DB.LiveQuizRewardRunStatus.APPLIED ||
    run.activeForLiveQuiz?.id !== run.liveQuizId ||
    run.activeForLiveQuiz.activeRewardRunId !== run.id ||
    run.activeForLiveQuiz.status !== DB.PublicationStatus.ENDED ||
    run.activeForLiveQuiz.isDeleted ||
    run.activeForLiveQuiz.finishedAt?.getTime() !== run.endedAt.getTime()
  ) {
    throw rewardReversalError(
      'LIVE_QUIZ_REWARD_DATA_UNAVAILABLE',
      'Live quiz reward run is not an exact active run'
    )
  }

  const appliedRunCount = await tx.liveQuizRewardRun.count({
    where: {
      liveQuizId: run.liveQuizId,
      status: DB.LiveQuizRewardRunStatus.APPLIED,
    },
  })
  const ledger = validateLiveQuizRewardEntries(run.entries, {
    persisted: true,
    uniqueParticipants: true,
  })
  if (appliedRunCount !== 1 || !ledger) {
    throw rewardReversalError(
      'LIVE_QUIZ_REWARD_DATA_UNAVAILABLE',
      'Live quiz reward entries are incomplete or inconsistent'
    )
  }

  const transitioned = await tx.liveQuizRewardRun.updateMany({
    where: {
      id: rewardRunId,
      liveQuizId: run.liveQuizId,
      status: DB.LiveQuizRewardRunStatus.APPLIED,
    },
    data: {
      status: DB.LiveQuizRewardRunStatus.REVERSED,
      reversedAt: new Date(),
      reversedById: actorId,
    },
  })
  if (transitioned.count !== 1) {
    throw rewardReversalError(
      'LIVE_QUIZ_REWARD_CONFLICT',
      'Live quiz reward run was already reversed'
    )
  }

  const currentState = await loadLiveQuizRewardCurrentState({
    ledger,
    prisma: tx,
    dailyTimelineDate: 'EXACT',
  })
  if (currentState.issue !== null) {
    const errors = {
      PARTICIPANT_XP: [
        'LIVE_QUIZ_PARTICIPANT_XP_UNDERFLOW',
        'Participant XP is lower than the recorded live quiz reward',
      ],
      COURSE_POINTS: [
        'LIVE_QUIZ_COURSE_REWARD_UNDERFLOW',
        'Course points are lower than the recorded live quiz reward',
      ],
      TIMELINE: [
        'LIVE_QUIZ_TIMELINE_REWARD_UNDERFLOW',
        'Timeline totals are lower than the recorded live quiz reward',
      ],
      ACHIEVEMENT: [
        'LIVE_QUIZ_ACHIEVEMENT_REWARD_UNDERFLOW',
        'Achievement count is lower than the recorded live quiz reward',
      ],
    } as const
    const [code, message] = errors[currentState.issue]
    throw rewardReversalError(code, message)
  }

  const {
    courseLeaderboardByParticipant,
    timelineByKey,
    achievementByParticipant,
  } = currentState
  const {
    participantXpEntries,
    courseEntries,
    timelineEntries,
    achievementEntries,
  } = ledger

  const totals: RewardReversalTotals = {
    coursePoints: 0,
    participantXp: 0,
    timelineChanges: 0,
    achievementChanges: 0,
  }
  const weeklyTimelineRecomputations = new Map<
    string,
    WeeklyTimelineRecomputation
  >()

  for (const entry of participantXpEntries) {
    const updated = await tx.participant.updateMany({
      where: {
        id: entry.participantId,
        xp: { gte: entry.participantXpAwarded },
      },
      data: { xp: { decrement: entry.participantXpAwarded } },
    })
    if (updated.count !== 1) {
      throw rewardReversalError(
        'LIVE_QUIZ_PARTICIPANT_XP_UNDERFLOW',
        'Participant XP changed while reversing live quiz rewards'
      )
    }
    totals.participantXp += entry.participantXpAwarded
  }

  for (const entry of courseEntries) {
    const leaderboard = courseLeaderboardByParticipant.get(
      rewardPairKey(entry.participantId, entry.courseId)
    )
    if (!leaderboard) {
      throw rewardReversalError(
        'LIVE_QUIZ_COURSE_REWARD_UNDERFLOW',
        'Course points changed while reversing live quiz rewards'
      )
    }
    const score = leaderboard.score - entry.coursePointsAwarded
    if (score === 0) {
      await tx.leaderboardEntry.delete({ where: { id: leaderboard.id } })
    } else {
      const updated = await tx.leaderboardEntry.updateMany({
        where: {
          id: leaderboard.id,
          score: { gte: entry.coursePointsAwarded },
        },
        data: { score: { decrement: entry.coursePointsAwarded } },
      })
      if (updated.count !== 1) {
        throw rewardReversalError(
          'LIVE_QUIZ_COURSE_REWARD_UNDERFLOW',
          'Course points changed while reversing live quiz rewards'
        )
      }
    }
    totals.coursePoints += entry.coursePointsAwarded
  }

  for (const entry of timelineEntries) {
    const dailyKey = timelineKey({
      participationId: entry.participationId,
      courseId: entry.courseId,
      timestamp: entry.timelineDate,
      type: DB.TimelineEntryType.DAILY,
    })
    const weekStart = isoWeekStart(entry.timelineDate)
    const weeklyKey = timelineKey({
      participationId: entry.participationId,
      courseId: entry.courseId,
      timestamp: weekStart,
      type: DB.TimelineEntryType.WEEKLY,
    })
    const daily = timelineByKey.get(dailyKey)
    const timeline = daily ?? timelineByKey.get(weeklyKey)
    if (timeline) {
      const collectedPoints =
        timeline.collectedPoints - entry.timelinePointsAwarded
      const collectedXp = timeline.collectedXp - entry.timelineXpAwarded
      if (collectedPoints === 0 && collectedXp === 0) {
        await tx.timelineEntry.delete({ where: { id: timeline.id } })
      } else {
        await tx.timelineEntry.update({
          where: { id: timeline.id },
          data: { collectedPoints, collectedXp, computedAt: new Date() },
        })
      }
      if (daily) {
        const recomputation = {
          participationId: entry.participationId,
          courseId: entry.courseId,
          weekStart,
        }
        weeklyTimelineRecomputations.set(
          timelineEntryKey({
            ...recomputation,
            timestamp: weekStart,
            type: DB.TimelineEntryType.WEEKLY,
          }),
          recomputation
        )
      }
      totals.timelineChanges += 1
    }
  }

  for (const entry of achievementEntries) {
    const achievement = achievementByParticipant.get(
      rewardPairKey(entry.participantId, entry.achievementId)
    )
    if (!achievement) {
      throw rewardReversalError(
        'LIVE_QUIZ_ACHIEVEMENT_REWARD_UNDERFLOW',
        'Achievement count changed while reversing live quiz rewards'
      )
    }
    const achievedCount =
      achievement.achievedCount - entry.achievementCountAwarded
    if (achievedCount === 0) {
      await tx.participantAchievementInstance.delete({
        where: { id: achievement.id },
      })
    } else {
      await tx.participantAchievementInstance.update({
        where: { id: achievement.id },
        data: { achievedCount },
      })
    }
    totals.achievementChanges += entry.achievementCountAwarded
  }

  return {
    totals,
    weeklyTimelineRecomputations: [...weeklyTimelineRecomputations.values()],
  }
}

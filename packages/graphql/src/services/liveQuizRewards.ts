import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'

export interface RankAchievementReward {
  id: number
  rewardedPoints: number | null
  rewardedXP: number | null
}

export interface LiveQuizRewardParticipant {
  participantId: string
  participationId: number | null
  courseId: string | null
  hasActiveParticipation: boolean
  isCourseGamificationEnabled: boolean
  score?: number
  xp?: number
}

export interface LiveQuizRewardDelta {
  participantId: string
  participationId: number | null
  courseId: string | null
  coursePointsAwarded: number
  participantXpAwarded: number
  timelineDate: Date | null
  timelinePointsAwarded: number
  timelineXpAwarded: number
  achievementId: number | null
  achievementCountAwarded: number
}

export interface LiveQuizRewardPlan {
  endedAt: Date
  entries: LiveQuizRewardDelta[]
  isLegacyReconstructed: boolean
}

export interface CalculateLiveQuizRewardPlanInput {
  participants: LiveQuizRewardParticipant[]
  achievements: {
    first: RankAchievementReward
    second: RankAchievementReward
    third: RankAchievementReward
  }
  awardAchievements: boolean
  endedAt: Date
  isLegacyReconstructed?: boolean
}

export interface ApplyRegularLiveQuizRewardPlanInput {
  liveQuizId: string
  plan: LiveQuizRewardPlan
  tx: DB.Prisma.TransactionClient
}

export type PersistLiveQuizRewardRunInput = ApplyRegularLiveQuizRewardPlanInput

export const RANK_ACHIEVEMENT_IDS = {
  first: 5,
  second: 6,
  third: 7,
} as const

export function calculateLiveQuizRewardPlan({
  participants,
  achievements,
  awardAchievements,
  endedAt,
  isLegacyReconstructed = false,
}: CalculateLiveQuizRewardPlanInput): LiveQuizRewardPlan {
  const rankedScores = participants
    .flatMap((participant) =>
      participant.score === undefined ? [] : [participant.score]
    )
    .sort((left, right) => right - left)
    .slice(0, 3)

  const goldScore = rankedScores[0]
  const silverScore = rankedScores[1]
  const bronzeScore = rankedScores[2]

  return {
    endedAt,
    isLegacyReconstructed,
    entries: participants.map((participant) => {
      let achievement: RankAchievementReward | null = null

      if (
        awardAchievements &&
        participant.score !== undefined &&
        participant.xp !== undefined
      ) {
        if (participant.score === goldScore) {
          achievement = achievements.first
        } else if (
          participant.score === silverScore &&
          silverScore !== goldScore
        ) {
          achievement = achievements.second
        } else if (
          participant.score === bronzeScore &&
          bronzeScore !== silverScore
        ) {
          achievement = achievements.third
        }
      }

      const rankPoints = achievement?.rewardedPoints ?? 0
      const rankXp = achievement?.rewardedXP ?? 0
      const coursePointsAwarded =
        participant.hasActiveParticipation &&
        participant.isCourseGamificationEnabled &&
        participant.score !== undefined
          ? participant.score + rankPoints
          : 0
      const participantXpAwarded =
        participant.xp === undefined ? 0 : participant.xp + rankXp
      const timelineDate =
        participant.participationId !== null &&
        participant.courseId !== null &&
        (coursePointsAwarded !== 0 || participantXpAwarded !== 0)
          ? endedAt
          : null
      const achievementCountAwarded =
        achievement !== null && participant.courseId !== null ? 1 : 0

      return {
        participantId: participant.participantId,
        participationId: participant.participationId,
        courseId: participant.courseId,
        coursePointsAwarded,
        participantXpAwarded,
        timelineDate,
        timelinePointsAwarded: coursePointsAwarded,
        timelineXpAwarded: timelineDate ? participantXpAwarded : 0,
        achievementId: achievementCountAwarded === 1 ? achievement!.id : null,
        achievementCountAwarded,
      }
    }),
  }
}

export function hasSampleSolutionQuestion(
  blocks: Array<{
    elements: Array<{
      elementType: DB.ElementType
      elementData: ElementData
    }>
  }>
): boolean {
  return blocks.some((block) =>
    block.elements.some((instance) => {
      const options = instance.elementData.options
      return (
        instance.elementType !== DB.ElementType.CONTENT &&
        options !== undefined &&
        'hasSampleSolution' in options &&
        (options.hasSampleSolution ?? false)
      )
    })
  )
}

export function shouldAwardRankAchievements({
  hasSampleSolution,
  participants,
}: {
  hasSampleSolution: boolean
  participants: LiveQuizRewardParticipant[]
}): boolean {
  return (
    hasSampleSolution &&
    participants.filter((participant) => participant.score !== undefined)
      .length >= 3
  )
}

export async function loadRankAchievementRewards(
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
): Promise<CalculateLiveQuizRewardPlanInput['achievements']> {
  const [first, second, third] = await Promise.all([
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.first },
    }),
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.second },
    }),
    prisma.achievement.findUniqueOrThrow({
      where: { id: RANK_ACHIEVEMENT_IDS.third },
    }),
  ])

  return { first, second, third }
}

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

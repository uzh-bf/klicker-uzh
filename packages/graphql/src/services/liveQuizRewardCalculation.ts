import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import type {
  CalculateLiveQuizRewardPlanInput,
  LiveQuizRewardParticipant,
  LiveQuizRewardPlan,
  RankAchievementReward,
  RankAchievementRewards,
} from './liveQuizRewardTypes.js'

export const RANK_ACHIEVEMENT_IDS = {
  first: 5,
  second: 6,
  third: 7,
} as const

const MAX_PRISMA_INT = 2147483647

function invalidLiveQuizRewardData(message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'LIVE_QUIZ_REWARD_DATA_INVALID' },
  })
}

function parseCanonicalNonnegativeRewardInteger(
  value: string,
  dataName: string
) {
  if (!/^(?:0|[1-9]\d*)$/.test(value)) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} reward data`)
  }

  const parsedValue = Number(value)
  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < 0 ||
    parsedValue > MAX_PRISMA_INT
  ) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} reward data`)
  }

  return parsedValue
}

function parseRedisHashResult(result: unknown, dataName: string) {
  if (
    !Array.isArray(result) ||
    result.length !== 2 ||
    result[0] !== null ||
    typeof result[1] !== 'object' ||
    result[1] === null ||
    Array.isArray(result[1]) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(result[1])) ||
    !Object.values(result[1]).every((value) => typeof value === 'string')
  ) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} snapshot`)
  }

  return result[1] as Record<string, string>
}

export async function snapshotRegularLiveQuizRewards({
  liveQuizId,
  redis,
}: {
  liveQuizId: string
  redis: Redis
}): Promise<Map<string, { score?: number; xp?: number }>> {
  const snapshot = redis.multi()
  snapshot.hgetall(`lq:${liveQuizId}:lb`)
  snapshot.hgetall(`lq:${liveQuizId}:xp`)
  const snapshotResult = await snapshot.exec()

  if (!Array.isArray(snapshotResult) || snapshotResult.length !== 2) {
    throw invalidLiveQuizRewardData('Invalid live quiz reward snapshot')
  }

  const quizLeaderboard = parseRedisHashResult(snapshotResult[0], 'leaderboard')
  const quizXp = parseRedisHashResult(snapshotResult[1], 'XP')
  const cachedRewards = new Map<string, { score?: number; xp?: number }>()

  for (const [participantId, value] of Object.entries(quizXp)) {
    const xp = parseCanonicalNonnegativeRewardInteger(value, 'XP')
    cachedRewards.set(participantId, { xp })
  }

  for (const [participantId, value] of Object.entries(quizLeaderboard)) {
    const score = parseCanonicalNonnegativeRewardInteger(value, 'leaderboard')
    cachedRewards.set(participantId, {
      ...cachedRewards.get(participantId),
      score,
    })
  }

  return cachedRewards
}

export function calculateLiveQuizRewardPlan(
  input: CalculateLiveQuizRewardPlanInput
): LiveQuizRewardPlan {
  const { participants, endedAt, isLegacyReconstructed = false } = input
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
        input.awardAchievements &&
        participant.score !== undefined &&
        participant.xp !== undefined
      ) {
        if (participant.score === goldScore) {
          achievement = input.achievements.first
        } else if (
          participant.score === silverScore &&
          silverScore !== goldScore
        ) {
          achievement = input.achievements.second
        } else if (
          participant.score === bronzeScore &&
          bronzeScore !== silverScore
        ) {
          achievement = input.achievements.third
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
      const timelinePointsAwarded =
        isLegacyReconstructed &&
        participant.hasActiveParticipation &&
        participant.score !== undefined
          ? participant.score + rankPoints
          : coursePointsAwarded
      const timelineDate =
        participant.participationId !== null &&
        participant.courseId !== null &&
        (timelinePointsAwarded !== 0 || participantXpAwarded !== 0)
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
        timelinePointsAwarded,
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
): Promise<RankAchievementRewards> {
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

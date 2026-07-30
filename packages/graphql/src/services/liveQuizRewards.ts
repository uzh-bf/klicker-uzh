import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import { validate as uuidValidate } from 'uuid'
import { getTimelineWeekBounds } from './participants.js'

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

export interface RankAchievementRewards {
  first: RankAchievementReward
  second: RankAchievementReward
  third: RankAchievementReward
}

interface CalculateLiveQuizRewardPlanBaseInput {
  participants: LiveQuizRewardParticipant[]
  endedAt: Date
  isLegacyReconstructed?: boolean
}

export type CalculateLiveQuizRewardPlanInput =
  CalculateLiveQuizRewardPlanBaseInput &
    (
      | {
          awardAchievements: true
          achievements: RankAchievementRewards
        }
      | {
          awardAchievements: false
          achievements?: never
        }
    )

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

export type LegacyRewardInspection =
  | { status: 'AVAILABLE'; plan: LiveQuizRewardPlan }
  | { status: 'UNAVAILABLE'; plan: null }

function utcDate(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  )
}

function isoWeekStart(date: Date): Date {
  const day = utcDate(date)
  const daysSinceMonday = (day.getUTCDay() + 6) % 7
  day.setUTCDate(day.getUTCDate() - daysSinceMonday)
  return day
}

function rewardPairKey(participantId: string, relatedId: string | number) {
  return `${participantId}:${relatedId}`
}

function timelineKey({
  participationId,
  courseId,
  timestamp,
  type,
}: {
  participationId: number
  courseId: string
  timestamp: Date
  type: DB.TimelineEntryType
}) {
  return `${participationId}:${courseId}:${utcDate(timestamp).toISOString()}:${type}`
}

async function legacyPlanMatchesCurrentRewards({
  plan,
  prisma,
}: {
  plan: LiveQuizRewardPlan
  prisma: DB.PrismaClient | DB.Prisma.TransactionClient
}): Promise<boolean> {
  const participantIds = plan.entries.map((entry) => entry.participantId)
  const courseEntries = plan.entries.filter(
    (
      entry
    ): entry is LiveQuizRewardDelta & {
      courseId: string
    } => entry.courseId !== null && entry.coursePointsAwarded !== 0
  )
  const achievementEntries = plan.entries.filter(
    (
      entry
    ): entry is LiveQuizRewardDelta & {
      achievementId: number
    } => entry.achievementId !== null && entry.achievementCountAwarded !== 0
  )
  const timelineEntries = plan.entries.filter(
    (
      entry
    ): entry is LiveQuizRewardDelta & {
      participationId: number
      courseId: string
      timelineDate: Date
    } =>
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.timelineDate !== null &&
      (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
  )

  const [participants, courseLeaderboards, achievements, timelines] =
    await Promise.all([
      participantIds.length > 0
        ? prisma.participant.findMany({
            where: { id: { in: participantIds } },
            select: { id: true, xp: true },
          })
        : Promise.resolve([]),
      courseEntries.length > 0
        ? prisma.leaderboardEntry.findMany({
            where: {
              type: DB.LeaderboardType.COURSE,
              OR: courseEntries.map((entry) => ({
                participantId: entry.participantId,
                courseId: entry.courseId,
              })),
            },
            select: { participantId: true, courseId: true, score: true },
          })
        : Promise.resolve([]),
      achievementEntries.length > 0
        ? prisma.participantAchievementInstance.findMany({
            where: {
              OR: achievementEntries.map((entry) => ({
                participantId: entry.participantId,
                achievementId: entry.achievementId,
              })),
            },
            select: {
              participantId: true,
              achievementId: true,
              achievedCount: true,
            },
          })
        : Promise.resolve([]),
      timelineEntries.length > 0
        ? prisma.timelineEntry.findMany({
            where: {
              OR: timelineEntries.flatMap((entry) => [
                {
                  participationId: entry.participationId,
                  courseId: entry.courseId,
                  timestamp: utcDate(entry.timelineDate),
                  type: DB.TimelineEntryType.DAILY,
                },
                {
                  participationId: entry.participationId,
                  courseId: entry.courseId,
                  timestamp: isoWeekStart(entry.timelineDate),
                  type: DB.TimelineEntryType.WEEKLY,
                },
              ]),
            },
            select: {
              participationId: true,
              courseId: true,
              timestamp: true,
              type: true,
              collectedPoints: true,
              collectedXp: true,
            },
          })
        : Promise.resolve([]),
    ])

  const participantById = new Map<string, { id: string; xp: number }>(
    participants.map(
      (participant) =>
        [participant.id, participant] as [string, { id: string; xp: number }]
    )
  )
  const courseLeaderboardByParticipant = new Map<
    string,
    { participantId: string; courseId: string | null; score: number }
  >(
    courseLeaderboards.flatMap((entry) =>
      entry.courseId === null
        ? []
        : [
            [rewardPairKey(entry.participantId, entry.courseId), entry] as [
              string,
              {
                participantId: string
                courseId: string | null
                score: number
              },
            ],
          ]
    )
  )
  const achievementByParticipant = new Map<
    string,
    {
      participantId: string
      achievementId: number
      achievedCount: number
    }
  >(
    achievements.map(
      (entry) =>
        [rewardPairKey(entry.participantId, entry.achievementId), entry] as [
          string,
          {
            participantId: string
            achievementId: number
            achievedCount: number
          },
        ]
    )
  )
  const timelineByKey = new Map<
    string,
    {
      participationId: number
      courseId: string | null
      timestamp: Date
      type: DB.TimelineEntryType
      collectedPoints: number
      collectedXp: number
    }
  >(
    timelines.flatMap((entry) =>
      entry.courseId === null
        ? []
        : [
            [
              timelineKey({
                participationId: entry.participationId,
                courseId: entry.courseId,
                timestamp: entry.timestamp,
                type: entry.type,
              }),
              entry,
            ] as [
              string,
              {
                participationId: number
                courseId: string | null
                timestamp: Date
                type: DB.TimelineEntryType
                collectedPoints: number
                collectedXp: number
              },
            ],
          ]
    )
  )

  for (const entry of plan.entries) {
    const participant = participantById.get(entry.participantId)
    if (!participant || participant.xp < entry.participantXpAwarded) {
      return false
    }

    if (entry.courseId !== null && entry.coursePointsAwarded !== 0) {
      const courseLeaderboard = courseLeaderboardByParticipant.get(
        rewardPairKey(entry.participantId, entry.courseId)
      )
      if (
        !courseLeaderboard ||
        courseLeaderboard.score < entry.coursePointsAwarded
      ) {
        return false
      }
    }

    if (entry.achievementId !== null && entry.achievementCountAwarded !== 0) {
      const achievement = achievementByParticipant.get(
        rewardPairKey(entry.participantId, entry.achievementId)
      )
      if (
        !achievement ||
        achievement.achievedCount < entry.achievementCountAwarded
      ) {
        return false
      }
    }

    if (
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.timelineDate !== null &&
      (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
    ) {
      const daily = timelineByKey.get(
        timelineKey({
          participationId: entry.participationId,
          courseId: entry.courseId,
          timestamp: entry.timelineDate,
          type: DB.TimelineEntryType.DAILY,
        })
      )
      const weekly = timelineByKey.get(
        timelineKey({
          participationId: entry.participationId,
          courseId: entry.courseId,
          timestamp: isoWeekStart(entry.timelineDate),
          type: DB.TimelineEntryType.WEEKLY,
        })
      )
      const timeline = daily ?? weekly
      if (
        timeline &&
        (timeline.collectedPoints < entry.timelinePointsAwarded ||
          timeline.collectedXp < entry.timelineXpAwarded)
      ) {
        return false
      }
    }
  }

  return true
}

export async function inspectLegacyRegularLiveQuizRewards(
  {
    liveQuizId,
    prisma,
  }: {
    liveQuizId: string
    prisma?: DB.PrismaClient | DB.Prisma.TransactionClient
  },
  ctx: {
    prisma: DB.PrismaClient
    redisExec: Redis
  }
): Promise<LegacyRewardInspection> {
  const prismaClient = prisma ?? ctx.prisma
  const quiz = await prismaClient.liveQuiz.findUnique({
    where: { id: liveQuizId },
    include: {
      course: { select: { isGamificationEnabled: true } },
      blocks: { include: { elements: true } },
      leaderboard: {
        where: { type: DB.LeaderboardType.SESSION },
        include: { sessionParticipation: true },
      },
      temporaryLeaderboard: true,
      activeRewardRun: {
        select: { id: true, liveQuizId: true, status: true },
      },
      rewardRuns: { select: { id: true, status: true } },
    },
  })

  if (
    !quiz ||
    quiz.isAssessmentEnabled ||
    !quiz.isGamificationEnabled ||
    quiz.status !== DB.PublicationStatus.ENDED ||
    quiz.isDeleted ||
    quiz.finishedAt === null ||
    quiz.activeRewardRunId !== null ||
    quiz.activeRewardRun !== null ||
    quiz.rewardRuns.length > 0
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  let cachedRewards: Map<string, { score?: number; xp?: number }>
  try {
    cachedRewards = await snapshotRegularLiveQuizRewards({
      liveQuizId,
      redis: ctx.redisExec,
    })
  } catch {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const cachedIds = [...cachedRewards.keys()]
  if (cachedIds.some((id) => !uuidValidate(id))) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const responseParticipants = await prismaClient.liveQuizResponse.findMany({
    where: { instance: { elementBlock: { liveQuizId } } },
    select: { participantId: true },
    distinct: ['participantId'],
  })
  const responseParticipantIds = new Set(
    responseParticipants.map((response) => response.participantId)
  )
  const candidateParticipantIds = [
    ...new Set([
      ...cachedIds,
      ...responseParticipantIds,
      ...quiz.leaderboard.map((entry) => entry.participantId),
      ...quiz.temporaryLeaderboard.map((entry) => entry.id),
    ]),
  ]
  const [participants, participations] = await Promise.all([
    prismaClient.participant.findMany({
      where: { id: { in: candidateParticipantIds } },
      select: { id: true },
    }),
    quiz.courseId
      ? prismaClient.participation.findMany({
          where: {
            courseId: quiz.courseId,
            participantId: { in: candidateParticipantIds },
          },
          select: { id: true, isActive: true, participantId: true },
        })
      : Promise.resolve([]),
  ])
  const existingParticipantIds = new Set(
    participants.map((participant) => participant.id)
  )
  const participationByParticipant = new Map<
    string,
    { id: number; isActive: boolean; participantId: string }
  >(
    participations.map(
      (participation) =>
        [participation.participantId, participation] as [
          string,
          { id: number; isActive: boolean; participantId: string },
        ]
    )
  )

  const sessionEntryByParticipant = new Map<
    string,
    (typeof quiz.leaderboard)[number]
  >()
  for (const entry of quiz.leaderboard) {
    if (
      !existingParticipantIds.has(entry.participantId) ||
      sessionEntryByParticipant.has(entry.participantId)
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }
    sessionEntryByParticipant.set(entry.participantId, entry)
  }

  const permanentTemporaryEntryByParticipant = new Map<
    string,
    (typeof quiz.temporaryLeaderboard)[number]
  >()
  const genuineTemporaryParticipantIds = new Set<string>()
  for (const entry of quiz.temporaryLeaderboard) {
    if (!existingParticipantIds.has(entry.id)) {
      genuineTemporaryParticipantIds.add(entry.id)
      continue
    }
    if (permanentTemporaryEntryByParticipant.has(entry.id)) {
      return { status: 'UNAVAILABLE', plan: null }
    }
    permanentTemporaryEntryByParticipant.set(entry.id, entry)
  }

  for (const participantId of cachedIds) {
    if (
      !existingParticipantIds.has(participantId) &&
      !genuineTemporaryParticipantIds.has(participantId)
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }
  }

  const expectedPermanentParticipantIds = new Set([
    ...responseParticipantIds,
    ...sessionEntryByParticipant.keys(),
    ...permanentTemporaryEntryByParticipant.keys(),
    ...cachedIds.filter((id) => existingParticipantIds.has(id)),
  ])
  const completePermanentRewards = new Map<
    string,
    { score: number; xp: number }
  >()
  for (const participantId of expectedPermanentParticipantIds) {
    const reward = cachedRewards.get(participantId)
    if (
      !existingParticipantIds.has(participantId) ||
      reward?.score === undefined ||
      reward.xp === undefined
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }

    const participation = participationByParticipant.get(participantId)
    const sessionEntry = sessionEntryByParticipant.get(participantId)
    const temporaryEntry =
      permanentTemporaryEntryByParticipant.get(participantId)
    const hasGamifiedCourseParticipation =
      quiz.courseId !== null &&
      quiz.course?.isGamificationEnabled === true &&
      participation !== undefined

    if (hasGamifiedCourseParticipation && participation.isActive) {
      if (
        !sessionEntry ||
        temporaryEntry ||
        sessionEntry.score !== reward.score ||
        sessionEntry.sessionParticipationId !== participation.id
      ) {
        return { status: 'UNAVAILABLE', plan: null }
      }
    } else if (hasGamifiedCourseParticipation) {
      if (sessionEntry || temporaryEntry) {
        return { status: 'UNAVAILABLE', plan: null }
      }
    } else if (
      sessionEntry ||
      !temporaryEntry ||
      temporaryEntry.score !== reward.score
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }

    completePermanentRewards.set(participantId, {
      score: reward.score,
      xp: reward.xp,
    })
  }

  const rewardParticipants: LiveQuizRewardParticipant[] = [
    ...expectedPermanentParticipantIds,
  ].map((participantId) => {
    const reward = completePermanentRewards.get(participantId)!
    const participation = participationByParticipant.get(participantId)
    return {
      participantId,
      participationId: participation?.id ?? null,
      courseId: quiz.courseId,
      hasActiveParticipation: participation?.isActive ?? false,
      isCourseGamificationEnabled: quiz.course?.isGamificationEnabled ?? false,
      score: reward.score,
      xp: reward.xp,
    }
  })

  const awardAchievements = shouldAwardRankAchievements({
    hasSampleSolution: hasSampleSolutionQuestion(quiz.blocks),
    participants: rewardParticipants,
  })
  let plan: LiveQuizRewardPlan
  if (awardAchievements) {
    try {
      const achievements = await loadRankAchievementRewards(prismaClient)
      plan = calculateLiveQuizRewardPlan({
        participants: rewardParticipants,
        achievements,
        awardAchievements: true,
        endedAt: quiz.finishedAt,
        isLegacyReconstructed: true,
      })
    } catch {
      return { status: 'UNAVAILABLE', plan: null }
    }
  } else {
    plan = calculateLiveQuizRewardPlan({
      participants: rewardParticipants,
      awardAchievements: false,
      endedAt: quiz.finishedAt,
      isLegacyReconstructed: true,
    })
  }

  if (
    !(await legacyPlanMatchesCurrentRewards({ plan, prisma: prismaClient }))
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  return { status: 'AVAILABLE', plan }
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

  const [appliedRunCount, participantCount] = await Promise.all([
    tx.liveQuizRewardRun.count({
      where: {
        liveQuizId: run.liveQuizId,
        status: DB.LiveQuizRewardRunStatus.APPLIED,
      },
    }),
    tx.participant.count({
      where: {
        id: {
          in: run.entries.flatMap((entry) =>
            entry.participantId === null ? [] : [entry.participantId]
          ),
        },
      },
    }),
  ])
  const participantIds = new Set<string>()
  const validEntries = run.entries.every((entry) => {
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
      (entry.achievementCountAwarded === 0 || entry.achievementId !== null) &&
      entry.coursePointsAwarded >= 0 &&
      entry.participantXpAwarded >= 0 &&
      entry.timelinePointsAwarded >= 0 &&
      entry.timelineXpAwarded >= 0 &&
      entry.achievementCountAwarded >= 0
    )
  })
  if (
    appliedRunCount !== 1 ||
    participantCount !== participantIds.size ||
    !validEntries
  ) {
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

  const courseEntries = run.entries.filter(
    (entry) =>
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.coursePointsAwarded !== 0
  )
  const timelineEntries = run.entries.filter(
    (entry) =>
      entry.participationId !== null &&
      entry.courseId !== null &&
      entry.timelineDate !== null &&
      (entry.timelinePointsAwarded !== 0 || entry.timelineXpAwarded !== 0)
  )
  const achievementEntries = run.entries.filter(
    (entry) =>
      entry.participantId !== null &&
      entry.achievementId !== null &&
      entry.achievementCountAwarded !== 0
  )
  const participantXpEntries = run.entries.filter(
    (entry) => entry.participantId !== null && entry.participantXpAwarded !== 0
  )
  const timelineKeys = timelineEntries.flatMap((entry) => {
    const { weekStart } = getTimelineWeekBounds(entry.timelineDate!)
    return [
      {
        participationId: entry.participationId!,
        courseId: entry.courseId!,
        timestamp: entry.timelineDate!,
        type: DB.TimelineEntryType.DAILY,
      },
      {
        participationId: entry.participationId!,
        courseId: entry.courseId!,
        timestamp: weekStart,
        type: DB.TimelineEntryType.WEEKLY,
      },
    ]
  })
  const [participants, courseLeaderboards, timelines, achievements] =
    await Promise.all([
      tx.participant.findMany({
        where: {
          id: {
            in: participantXpEntries.map((entry) => entry.participantId!),
          },
        },
        select: { id: true, xp: true },
      }),
      tx.leaderboardEntry.findMany({
        where: {
          OR: courseEntries.map((entry) => ({
            type: DB.LeaderboardType.COURSE,
            participantId: entry.participantId!,
            courseId: entry.courseId!,
          })),
        },
      }),
      tx.timelineEntry.findMany({
        where: {
          OR: timelineKeys,
        },
      }),
      tx.participantAchievementInstance.findMany({
        where: {
          OR: achievementEntries.map((entry) => ({
            participantId: entry.participantId!,
            achievementId: entry.achievementId!,
          })),
        },
      }),
    ])
  const participantById = new Map(
    participants.map((participant) => [participant.id, participant])
  )
  const courseLeaderboardByParticipant = new Map(
    courseLeaderboards.map((leaderboard) => [
      rewardPairKey(leaderboard.participantId, leaderboard.courseId!),
      leaderboard,
    ])
  )
  const timelineByKey = new Map(
    timelines.map((entry) => [
      timelineEntryKey({
        participationId: entry.participationId,
        courseId: entry.courseId!,
        timestamp: entry.timestamp,
        type: entry.type,
      }),
      entry,
    ])
  )
  const achievementByParticipant = new Map(
    achievements.map((instance) => [
      rewardPairKey(instance.participantId, instance.achievementId),
      instance,
    ])
  )

  for (const entry of participantXpEntries) {
    const participant = participantById.get(entry.participantId!)
    if (!participant || participant.xp < entry.participantXpAwarded) {
      throw rewardReversalError(
        'LIVE_QUIZ_PARTICIPANT_XP_UNDERFLOW',
        'Participant XP is lower than the recorded live quiz reward'
      )
    }
  }
  for (const entry of courseEntries) {
    const leaderboard = courseLeaderboardByParticipant.get(
      rewardPairKey(entry.participantId!, entry.courseId!)
    )
    if (!leaderboard || leaderboard.score < entry.coursePointsAwarded) {
      throw rewardReversalError(
        'LIVE_QUIZ_COURSE_REWARD_UNDERFLOW',
        'Course points are lower than the recorded live quiz reward'
      )
    }
  }
  for (const entry of timelineEntries) {
    const dailyKey = timelineEntryKey({
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      timestamp: entry.timelineDate!,
      type: DB.TimelineEntryType.DAILY,
    })
    const { weekStart } = getTimelineWeekBounds(entry.timelineDate!)
    const weeklyKey = timelineEntryKey({
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      timestamp: weekStart,
      type: DB.TimelineEntryType.WEEKLY,
    })
    const timeline = timelineByKey.get(dailyKey) ?? timelineByKey.get(weeklyKey)
    if (
      timeline &&
      (timeline.collectedPoints < entry.timelinePointsAwarded ||
        timeline.collectedXp < entry.timelineXpAwarded)
    ) {
      throw rewardReversalError(
        'LIVE_QUIZ_TIMELINE_REWARD_UNDERFLOW',
        'Timeline totals are lower than the recorded live quiz reward'
      )
    }
  }
  for (const entry of achievementEntries) {
    const achievement = achievementByParticipant.get(
      rewardPairKey(entry.participantId!, entry.achievementId!)
    )
    if (
      !achievement ||
      achievement.achievedCount < entry.achievementCountAwarded
    ) {
      throw rewardReversalError(
        'LIVE_QUIZ_ACHIEVEMENT_REWARD_UNDERFLOW',
        'Achievement count is lower than the recorded live quiz reward'
      )
    }
  }

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
        id: entry.participantId!,
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
      rewardPairKey(entry.participantId!, entry.courseId!)
    )!
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
    const dailyKey = timelineEntryKey({
      participationId: entry.participationId!,
      courseId: entry.courseId!,
      timestamp: entry.timelineDate!,
      type: DB.TimelineEntryType.DAILY,
    })
    const { weekStart } = getTimelineWeekBounds(entry.timelineDate!)
    const weeklyKey = timelineEntryKey({
      participationId: entry.participationId!,
      courseId: entry.courseId!,
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
          participationId: entry.participationId!,
          courseId: entry.courseId!,
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
    }
    totals.timelineChanges += 1
  }

  for (const entry of achievementEntries) {
    const achievement = achievementByParticipant.get(
      rewardPairKey(entry.participantId!, entry.achievementId!)
    )!
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

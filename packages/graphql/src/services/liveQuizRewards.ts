import * as DB from '@klicker-uzh/prisma/client'
import type { ElementData } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { Redis } from 'ioredis'
import { validate as uuidValidate } from 'uuid'

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

const MIN_PRISMA_INT = -2147483648
const MAX_PRISMA_INT = 2147483647

function invalidLiveQuizRewardData(message: string) {
  return new GraphQLError(message, {
    extensions: { code: 'LIVE_QUIZ_REWARD_DATA_INVALID' },
  })
}

function parseCanonicalRewardInteger(value: string, dataName: string) {
  if (!/^(?:0|-[1-9]\d*|[1-9]\d*)$/.test(value)) {
    throw invalidLiveQuizRewardData(`Invalid live quiz ${dataName} reward data`)
  }

  const parsedValue = Number(value)
  if (
    !Number.isInteger(parsedValue) ||
    parsedValue < MIN_PRISMA_INT ||
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
    const xp = parseCanonicalRewardInteger(value, 'XP')
    cachedRewards.set(participantId, { xp })
  }

  for (const [participantId, value] of Object.entries(quizLeaderboard)) {
    const score = parseCanonicalRewardInteger(value, 'leaderboard')
    cachedRewards.set(participantId, {
      ...cachedRewards.get(participantId),
      score,
    })
  }

  return cachedRewards
}

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

  const persistedScores = new Map<string, number>()
  const sessionEntryByParticipant = new Map<
    string,
    (typeof quiz.leaderboard)[number]
  >()
  for (const entry of quiz.leaderboard) {
    if (
      !existingParticipantIds.has(entry.participantId) ||
      persistedScores.has(entry.participantId)
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }
    persistedScores.set(entry.participantId, entry.score)
    sessionEntryByParticipant.set(entry.participantId, entry)
  }

  const permanentTemporaryParticipantIds = new Set<string>()
  const genuineTemporaryParticipantIds = new Set<string>()
  for (const entry of quiz.temporaryLeaderboard) {
    if (!existingParticipantIds.has(entry.id)) {
      genuineTemporaryParticipantIds.add(entry.id)
      continue
    }
    if (persistedScores.has(entry.id)) {
      return { status: 'UNAVAILABLE', plan: null }
    }
    permanentTemporaryParticipantIds.add(entry.id)
    persistedScores.set(entry.id, entry.score)
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
    ...permanentTemporaryParticipantIds,
    ...cachedIds.filter((id) => existingParticipantIds.has(id)),
  ])
  for (const participantId of expectedPermanentParticipantIds) {
    if (
      !existingParticipantIds.has(participantId) ||
      cachedRewards.get(participantId)?.xp === undefined
    ) {
      return { status: 'UNAVAILABLE', plan: null }
    }
  }

  const cachedPermanentScoreEntries = [...cachedRewards.entries()].flatMap(
    ([participantId, reward]) =>
      existingParticipantIds.has(participantId) && reward.score !== undefined
        ? ([[participantId, reward.score]] as const)
        : []
  )
  if (
    cachedPermanentScoreEntries.length !== persistedScores.size ||
    cachedPermanentScoreEntries.some(
      ([participantId, score]) => persistedScores.get(participantId) !== score
    )
  ) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  for (const [participantId, sessionEntry] of sessionEntryByParticipant) {
    if (quiz.courseId !== null) {
      const participation = participationByParticipant.get(participantId)
      if (
        !participation ||
        sessionEntry.sessionParticipationId !== participation.id
      ) {
        return { status: 'UNAVAILABLE', plan: null }
      }
    } else if (sessionEntry.sessionParticipationId !== null) {
      return { status: 'UNAVAILABLE', plan: null }
    }
  }

  const rewardParticipants: LiveQuizRewardParticipant[] = [
    ...expectedPermanentParticipantIds,
  ].map((participantId) => {
    const reward = cachedRewards.get(participantId)!
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

  let achievements: CalculateLiveQuizRewardPlanInput['achievements']
  try {
    achievements = await loadRankAchievementRewards(prismaClient)
  } catch {
    return { status: 'UNAVAILABLE', plan: null }
  }

  const plan = calculateLiveQuizRewardPlan({
    participants: rewardParticipants,
    achievements,
    awardAchievements: shouldAwardRankAchievements({
      hasSampleSolution: hasSampleSolutionQuestion(quiz.blocks),
      participants: rewardParticipants,
    }),
    endedAt: quiz.finishedAt,
    isLegacyReconstructed: true,
  })

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

import * as DB from '@klicker-uzh/prisma/client'
import type { Redis } from 'ioredis'
import { validate as uuidValidate } from 'uuid'
import {
  calculateLiveQuizRewardPlan,
  hasSampleSolutionQuestion,
  loadRankAchievementRewards,
  shouldAwardRankAchievements,
  snapshotRegularLiveQuizRewards,
} from './liveQuizRewardCalculation.js'
import { loadLiveQuizRewardCurrentState } from './liveQuizRewardState.js'
import type {
  LiveQuizRewardParticipant,
  LiveQuizRewardPlan,
} from './liveQuizRewardTypes.js'
import { validateLiveQuizRewardEntries } from './liveQuizRewardValidation.js'

export type LegacyRewardInspection =
  | { status: 'AVAILABLE'; plan: LiveQuizRewardPlan }
  | { status: 'UNAVAILABLE'; plan: null }

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

  const ledger = validateLiveQuizRewardEntries(plan.entries, {
    persisted: false,
    uniqueParticipants: true,
  })
  if (!ledger) {
    return { status: 'UNAVAILABLE', plan: null }
  }
  const currentState = await loadLiveQuizRewardCurrentState({
    ledger,
    prisma: prismaClient,
    dailyTimelineDate: 'UTC_DAY',
  })
  if (currentState.issue !== null) {
    return { status: 'UNAVAILABLE', plan: null }
  }

  return { status: 'AVAILABLE', plan }
}

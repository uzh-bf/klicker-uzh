import {
  ElementBlockStatus,
  UserRole,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { levelFromXp } from '@klicker-uzh/util'
import { createHmac } from 'node:crypto'
import type { TRPCUser } from '../trpc/context.js'
import { stableTemporaryNumericId } from './responseIdentifiers.js'

export type LiveQuizLeaderboardEntry = {
  id: number
  participantId: string
  username: string
  avatar: string | null
  score: number
  level: number
  isTemporary: boolean
  lastBlockOrder: number
  rank: number
}

export async function getLiveQuizLeaderboard({
  hmac,
  prisma,
  quizId,
  user,
}: {
  hmac?: string | null
  prisma: PrismaClient
  quizId: string
  user?: TRPCUser | null
}): Promise<LiveQuizLeaderboardEntry[] | null> {
  const quiz = await prisma.liveQuiz.findUnique({
    where: { id: quizId },
    include: {
      leaderboard: {
        include: { participant: true, sessionParticipation: true },
      },
      course: { select: { isGamificationEnabled: true } },
      temporaryLeaderboard: true,
      blocks: true,
    },
  })

  if (!quiz) return []
  if (!quiz.isGamificationEnabled) return null

  const participant =
    user?.sub && user.role === UserRole.PARTICIPANT
      ? await prisma.participant.findUnique({
          where: { id: user.sub },
          select: { isProfilePublic: true },
        })
      : null

  let participantProfilesVisible =
    (participant?.isProfilePublic ?? false) ||
    user?.role === UserRole.TEMPORARY_PARTICIPANT ||
    user?.role === UserRole.USER ||
    user?.role === UserRole.ADMIN

  if (hmac && process.env.APP_SECRET) {
    const hmacEncoder = createHmac('sha256', process.env.APP_SECRET)
    hmacEncoder.update(quiz.namespace + quiz.id)
    if (hmacEncoder.digest('hex') === hmac) {
      participantProfilesVisible = true
    }
  }

  const executedBlockOrders = quiz.blocks
    .filter((block) => block.status === ElementBlockStatus.EXECUTED)
    .map((block) => Number(block.order))
  const lastBlockOrder =
    executedBlockOrders.length > 0 ? Math.max(...executedBlockOrders) : 0

  const regularEntries = quiz.leaderboard.flatMap((entry) => {
    if (
      quiz.course?.isGamificationEnabled &&
      !entry.sessionParticipation?.isActive
    ) {
      return []
    }

    const visible =
      entry.participant.isProfilePublic && participantProfilesVisible

    return {
      id: entry.id,
      participantId: entry.participant.id,
      username: visible ? entry.participant.username : 'Anonymous',
      avatar: visible ? entry.participant.avatar : null,
      score: entry.score,
      level: levelFromXp(entry.participant.xp),
      isTemporary: false,
      lastBlockOrder,
    }
  })

  const temporaryEntries = quiz.temporaryLeaderboard.map((entry) => ({
    id: stableTemporaryNumericId(entry.id),
    participantId: entry.id,
    username: participantProfilesVisible ? entry.username : 'Anonymous',
    avatar: participantProfilesVisible ? entry.avatar : null,
    score: entry.score,
    level: 1,
    isTemporary: true,
    lastBlockOrder,
  }))

  return [...regularEntries, ...temporaryEntries]
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.username.localeCompare(b.username)
    })
    .map((entry, ix) => ({
      ...entry,
      rank: ix + 1,
    }))
}

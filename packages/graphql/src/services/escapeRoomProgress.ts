import * as DB from '@klicker-uzh/prisma/client'
import { isEscapeRoomExpired } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
interface EscapeRoomProgressArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
}

// A single participant's run through an escape-room activity, as seen by the
// owning lecturer. clearedStacks/totalStacks drive the segmented progress bar;
// hintsUsedCount/penaltySeconds/timeSpentSeconds surface the cost side of the run.
export interface EscapeRoomAttemptProgress {
  id: string | null
  participantId: string | null
  displayName: string
  avatar: string | null
  status: DB.EscapeRoomStatus | 'NOT_STARTED'
  startedAt: Date | null
  completedAt: Date | null
  lockoutUntil: Date | null
  penaltySeconds: number
  hintsUsedCount: number
  clearedStacks: number
  timeSpentSeconds: number | null
}

export interface EscapeRoomProgress {
  activityId: string
  totalStacks: number
  timeLimit: number
  attempts: EscapeRoomAttemptProgress[]
}

function stackWhere(
  args: EscapeRoomProgressArgs
): DB.Prisma.ElementStackWhereInput {
  if (args.practiceQuizId) return { practiceQuizId: args.practiceQuizId }
  return { microLearningId: args.microLearningId! }
}

/**
 * Lecturer-facing progress view over every attempt on an escape-room activity.
 * Owner authorization is enforced by withPermission at the resolver layer; this
 * service assumes the caller already passed the WRITE/READ check.
 */
export async function getEscapeRoomProgress(
  args: EscapeRoomProgressArgs,
  ctx: ContextWithUser
): Promise<EscapeRoomProgress | null> {
  const { practiceQuizId, microLearningId } = args

  if ([practiceQuizId, microLearningId].filter(Boolean).length !== 1) {
    throw new GraphQLError('Exactly one escape-room activity is required')
  }

  const activityId = practiceQuizId ?? microLearningId

  if (!activityId) {
    throw new GraphQLError('An escape-room activity id is required')
  }

  // 1. Load the escape-room config to confirm the activity is actually an
  //    escape room and to read the time limit for the header.
  const config = await ctx.prisma.escapeRoomConfig.findFirst({
    where: {
      practiceQuizId: practiceQuizId ?? undefined,
      microLearningId: microLearningId ?? undefined,
    },
    include: {
      practiceQuiz: { select: { courseId: true } },
      microLearning: { select: { courseId: true } },
    },
  })
  if (!config) return null

  // 2. Load ordered stacks with their element-instance ids so we can compute
  //    how many leading stacks a participant has fully cleared (mirrors the
  //    getPracticeQuizData masking logic).
  const where = stackWhere(args)
  const stacks = await ctx.prisma.elementStack.findMany({
    where,
    include: { elements: { select: { id: true } } },
    orderBy: { order: 'asc' },
  })
  const totalStacks = stacks.length

  // 3. Load every attempt on this activity with the participant identity.
  const attempts = await ctx.prisma.escapeRoomAttempt.findMany({
    where: {
      practiceQuizId: practiceQuizId ?? undefined,
      microLearningId: microLearningId ?? undefined,
    },
    include: {
      participant: { select: { id: true, username: true, avatar: true } },
    },
    orderBy: { startedAt: 'asc' },
  })

  const now = Date.now()
  const elapsedAttemptIds = attempts
    .filter(
      (attempt) =>
        attempt.status === DB.EscapeRoomStatus.IN_PROGRESS &&
        isEscapeRoomExpired(attempt, now)
    )
    .map((attempt) => attempt.id)
  if (elapsedAttemptIds.length > 0) {
    await ctx.prisma.escapeRoomAttempt.updateMany({
      where: {
        id: { in: elapsedAttemptIds },
        status: DB.EscapeRoomStatus.IN_PROGRESS,
      },
      data: { status: DB.EscapeRoomStatus.EXPIRED },
    })
    const persistedElapsedAttempts =
      await ctx.prisma.escapeRoomAttempt.findMany({
        where: { id: { in: elapsedAttemptIds } },
        select: { id: true, status: true },
      })
    const persistedElapsedStatuses = new Map(
      persistedElapsedAttempts.map((attempt) => [attempt.id, attempt.status])
    )
    for (const attempt of attempts) {
      const persistedStatus = persistedElapsedStatuses.get(attempt.id)
      if (persistedStatus) {
        attempt.status = persistedStatus
      }
    }
  }

  // 4. Compute cleared stacks from correct responses in one query.
  const clearedByParticipant = new Map<string, number>()
  const participantIds = attempts
    .map((a) => a.participantId)
    .filter((id): id is string => id != null)

  if (participantIds.length > 0 && totalStacks > 0) {
    const responses = await ctx.prisma.questionResponse.findMany({
      where: {
        participantId: { in: participantIds },
        elementInstance: { elementStack: where },
      },
      select: {
        participantId: true,
        elementInstanceId: true,
        lastResponseCorrectness: true,
      },
    })

    // participantId -> set of instance ids answered correctly
    const correct = new Map<string, Set<number>>()
    for (const resp of responses) {
      if (
        resp.participantId == null ||
        resp.lastResponseCorrectness !== DB.ResponseCorrectness.CORRECT
      ) {
        continue
      }
      if (!correct.has(resp.participantId)) {
        correct.set(resp.participantId, new Set())
      }
      correct.get(resp.participantId)!.add(resp.elementInstanceId)
    }

    for (const participantId of participantIds) {
      const correctSet = correct.get(participantId) ?? new Set<number>()
      let cleared = 0
      for (const stack of stacks) {
        const allCorrect =
          stack.elements.length > 0 &&
          stack.elements.every((elem) => correctSet.has(elem.id))
        if (!allCorrect) break
        cleared += 1
      }
      clearedByParticipant.set(participantId, cleared)
    }
  }

  const progressForAttempt = (
    attempt: (typeof attempts)[number]
  ): EscapeRoomAttemptProgress => {
    const hintsUsedCount = Array.isArray(attempt.hintsUsed)
      ? attempt.hintsUsed.length
      : 0

    const clearedStacks =
      attempt.participantId != null
        ? (clearedByParticipant.get(attempt.participantId) ?? 0)
        : 0

    const timeSpentSeconds = attempt.completedAt
      ? Math.round(
          (attempt.completedAt.getTime() - attempt.startedAt.getTime()) / 1000
        )
      : null
    const activeLockoutUntil =
      attempt.lockoutUntil != null && attempt.lockoutUntil.getTime() > now
        ? attempt.lockoutUntil
        : null

    return {
      id: attempt.id,
      participantId: attempt.participantId,
      displayName: attempt.participant?.username ?? 'Unknown',
      avatar: attempt.participant?.avatar ?? null,
      status: attempt.status,
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
      lockoutUntil: activeLockoutUntil,
      penaltySeconds: attempt.penaltySeconds,
      hintsUsedCount,
      clearedStacks,
      timeSpentSeconds,
    }
  }

  let progress = attempts.map(progressForAttempt)
  const participantCourseId =
    config.practiceQuiz?.courseId ?? config.microLearning?.courseId
  if (participantCourseId) {
    // The progress dashboard tracks the whole class, so include every enrolled
    // participant rather than only leaderboard-active ones (isActive gates
    // leaderboard membership, which is orthogonal to escape-room progress).
    // Students without an attempt show as NOT_STARTED.
    const roster = await ctx.prisma.participation.findMany({
      where: { courseId: participantCourseId },
      include: {
        participant: {
          select: { id: true, username: true, avatar: true },
        },
      },
      orderBy: { participant: { username: 'asc' } },
    })
    const attemptsByParticipant = new Map(
      attempts.flatMap((attempt) =>
        attempt.participantId ? [[attempt.participantId, attempt]] : []
      )
    )
    const rosterParticipantIds = new Set(
      roster.map(({ participant }) => participant.id)
    )
    const rosterProgress = roster.map(({ participant }) => {
      const attempt = attemptsByParticipant.get(participant.id)
      return attempt
        ? progressForAttempt(attempt)
        : {
            id: null,
            participantId: participant.id,
            displayName: participant.username,
            avatar: participant.avatar,
            status: 'NOT_STARTED' as const,
            startedAt: null,
            completedAt: null,
            lockoutUntil: null,
            penaltySeconds: 0,
            hintsUsedCount: 0,
            clearedStacks: 0,
            timeSpentSeconds: null,
          }
    })
    // Never drop a real attempt: keep participant attempts whose participation
    // is no longer in the course roster (e.g. the student left the course).
    const orphanProgress = attempts
      .filter(
        (attempt) =>
          attempt.participantId &&
          !rosterParticipantIds.has(attempt.participantId)
      )
      .map(progressForAttempt)
    progress = [...rosterProgress, ...orphanProgress]
  }

  return {
    activityId,
    totalStacks,
    timeLimit: config.timeLimit,
    attempts: progress,
  }
}

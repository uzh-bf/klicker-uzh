import * as DB from '@klicker-uzh/prisma/client'
import { isEscapeRoomExpired } from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'
interface EscapeRoomProgressArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  elementBlockId?: number | null
  liveQuizId?: string | null
}

// A participant's or group's run through an escape-room activity, as seen by
// the owning lecturer. clearedStacks/totalStacks drive the segmented progress
// bar; hintsUsedCount/penaltySeconds/timeSpentSeconds surface the cost side.
export interface EscapeRoomAttemptProgress {
  id: string | null
  participantId: string | null
  groupId: string | null
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
): DB.Prisma.ElementStackWhereInput | null {
  if (args.practiceQuizId) return { practiceQuizId: args.practiceQuizId }
  if (args.microLearningId) return { microLearningId: args.microLearningId }
  if (args.groupActivityId) return { groupActivityId: args.groupActivityId }
  return null
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
  const {
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId,
    liveQuizId,
  } = args

  const activityKinds = [
    practiceQuizId,
    microLearningId,
    groupActivityId,
    elementBlockId != null && liveQuizId ? 'liveQuizBlock' : null,
  ].filter(Boolean)
  if (
    activityKinds.length !== 1 ||
    (elementBlockId != null) !== (liveQuizId != null)
  ) {
    throw new GraphQLError('Exactly one escape-room activity is required')
  }

  const activityId =
    practiceQuizId ??
    microLearningId ??
    groupActivityId ??
    (elementBlockId != null ? String(elementBlockId) : null)
  if (!activityId) {
    throw new GraphQLError('An escape-room activity id is required')
  }

  // 1. Load the escape-room config to confirm the activity is actually an
  //    escape room and to read the time limit for the header.
  const config = await ctx.prisma.escapeRoomConfig.findFirst({
    where: {
      practiceQuizId: practiceQuizId ?? undefined,
      microLearningId: microLearningId ?? undefined,
      groupActivityId: groupActivityId ?? undefined,
      elementBlockId: elementBlockId ?? undefined,
      elementBlock:
        elementBlockId != null && liveQuizId ? { liveQuizId } : undefined,
    },
    include: {
      practiceQuiz: { select: { courseId: true } },
      microLearning: { select: { courseId: true } },
      groupActivity: { select: { courseId: true } },
    },
  })
  if (!config) return null

  // 2. Load ordered stacks with their element-instance ids so we can compute
  //    how many leading stacks a participant has fully cleared (mirrors the
  //    getPracticeQuizData masking logic).
  const where = stackWhere(args)
  const stacks = where
    ? await ctx.prisma.elementStack.findMany({
        where,
        include: { elements: { select: { id: true } } },
        orderBy: { order: 'asc' },
      })
    : []
  const totalStacks =
    elementBlockId != null
      ? await ctx.prisma.elementInstance.count({
          where: {
            elementBlockId,
            elementType: {
              in: [
                DB.ElementType.SC,
                DB.ElementType.MC,
                DB.ElementType.KPRIM,
                DB.ElementType.NUMERICAL,
                DB.ElementType.FREE_TEXT,
                DB.ElementType.QR_SCAN,
              ],
            },
          },
        })
      : stacks.length

  // 3. Load every attempt on this activity with the participant identity.
  const attempts = await ctx.prisma.escapeRoomAttempt.findMany({
    where: {
      practiceQuizId: practiceQuizId ?? undefined,
      microLearningId: microLearningId ?? undefined,
      groupActivityId: groupActivityId ?? undefined,
      elementBlockId: elementBlockId ?? undefined,
    },
    include: {
      participant: { select: { id: true, username: true, avatar: true } },
      group: { select: { id: true, name: true } },
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

  if (where && participantIds.length > 0 && totalStacks > 0) {
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
      elementBlockId != null
        ? attempt.status === DB.EscapeRoomStatus.COMPLETED
          ? totalStacks
          : 0
        : attempt.participantId != null
          ? (clearedByParticipant.get(attempt.participantId) ?? 0)
          : attempt.status === DB.EscapeRoomStatus.COMPLETED
            ? totalStacks
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
      groupId: attempt.groupId,
      displayName:
        attempt.participant?.username ?? attempt.group?.name ?? 'Unknown',
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
            groupId: null,
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

  const groupCourseId = config.groupActivity?.courseId
  if (groupCourseId) {
    const groupRoster = await ctx.prisma.participantGroup.findMany({
      where: { courseId: groupCourseId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    })
    const attemptsByGroup = new Map(
      attempts.flatMap((attempt) =>
        attempt.groupId ? [[attempt.groupId, attempt]] : []
      )
    )
    const rosterGroupIds = new Set(groupRoster.map((group) => group.id))
    const rosterProgress = groupRoster.map((group) => {
      const attempt = attemptsByGroup.get(group.id)
      return attempt
        ? progressForAttempt(attempt)
        : {
            id: null,
            participantId: null,
            groupId: group.id,
            displayName: group.name,
            avatar: null,
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
    const orphanProgress = attempts
      .filter(
        (attempt) => attempt.groupId && !rosterGroupIds.has(attempt.groupId)
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

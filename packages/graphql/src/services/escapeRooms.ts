import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

export const ESCAPE_ROOM_GRACE_SECONDS = 5

export function getRemainingSecondsUntil(deadline: Date, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline.getTime() - now) / 1000))
}

export function getEscapeRoomRemainingSeconds(
  attempt: Pick<
    DB.EscapeRoomAttempt,
    'startedAt' | 'timeLimit' | 'penaltySeconds'
  >,
  now = Date.now()
) {
  const elapsedSeconds = (now - new Date(attempt.startedAt).getTime()) / 1000
  return Math.max(
    0,
    Math.ceil(attempt.timeLimit - attempt.penaltySeconds - elapsedSeconds)
  )
}

export function getEscapeRoomExpiresInSeconds(
  attempt: Pick<
    DB.EscapeRoomAttempt,
    'startedAt' | 'timeLimit' | 'penaltySeconds'
  >,
  now = Date.now()
) {
  return getEscapeRoomRemainingSeconds(
    { ...attempt, timeLimit: attempt.timeLimit + ESCAPE_ROOM_GRACE_SECONDS },
    now
  )
}

export async function getEscapeRoomHints(
  args: {
    practiceQuizId?: string | null
    microLearningId?: string | null
    groupActivityId?: string | null
    liveQuizId?: string | null
  },
  ctx: ContextWithUser
) {
  const activityIdCount = [
    args.practiceQuizId,
    args.microLearningId,
    args.groupActivityId,
    args.liveQuizId,
  ].filter((id) => id != null).length
  if (activityIdCount !== 1) {
    throw new GraphQLError('Exactly one escape room activity ID is required')
  }

  const activity = args.practiceQuizId
    ? await ctx.prisma.practiceQuiz.findUnique({
        where: { id: args.practiceQuizId },
        select: { ownerId: true },
      })
    : args.microLearningId
      ? await ctx.prisma.microLearning.findUnique({
          where: { id: args.microLearningId },
          select: { ownerId: true },
        })
      : args.groupActivityId
        ? await ctx.prisma.groupActivity.findUnique({
            where: { id: args.groupActivityId },
            select: { ownerId: true },
          })
        : await ctx.prisma.liveQuiz.findUnique({
            where: { id: args.liveQuizId! },
            select: { ownerId: true },
          })
  if (!activity || activity.ownerId !== ctx.user.sub) {
    throw new GraphQLError('Only the activity owner can read escape room hints')
  }

  const elements = await ctx.prisma.elementInstance.findMany({
    where: {
      elementStack: args.practiceQuizId
        ? { practiceQuizId: args.practiceQuizId }
        : args.microLearningId
          ? { microLearningId: args.microLearningId }
          : args.groupActivityId
            ? { groupActivityId: args.groupActivityId }
            : undefined,
      elementBlock: args.liveQuizId
        ? { liveQuizId: args.liveQuizId }
        : undefined,
    },
    select: { id: true, options: true },
  })

  return elements.flatMap((element) => {
    const hint = element.options.escapeRoomHint?.trim()
    return hint ? [{ instanceId: element.id, hint }] : []
  })
}

type StackWithRevealedHints<
  T extends {
    elements: Array<{
      id: number
      options: { escapeRoomHint?: string | null }
    }>
  },
> = Omit<T, 'elements'> & {
  elements: Array<T['elements'][number] & { revealedHint: string | null }>
}

export function restoreUsedEscapeRoomHints<
  T extends {
    elements: Array<{
      id: number
      options: { escapeRoomHint?: string | null }
    }>
  },
>(stacks: T[], hintsUsed: unknown): StackWithRevealedHints<T>[] {
  const usedHintIds = new Set(
    Array.isArray(hintsUsed) ? hintsUsed.map(String) : []
  )
  return stacks.map((stack) => ({
    ...stack,
    elements: stack.elements.map((element) => ({
      ...element,
      revealedHint: usedHintIds.has(String(element.id))
        ? (element.options.escapeRoomHint ?? null)
        : null,
    })),
  }))
}

export function isEscapeRoomStackCleared(
  elements: Array<{
    elementType: DB.ElementType
    responses?: Array<{
      lastResponseCorrectness: DB.ResponseCorrectness | null
    }>
  }>
) {
  return elements
    .filter((element) => element.elementType !== DB.ElementType.CONTENT)
    .every((element) =>
      element.responses?.some(
        (response) =>
          response.lastResponseCorrectness === DB.ResponseCorrectness.CORRECT
      )
    )
}

interface EscapeRoomProgressArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  elementBlockId?: number | null
  liveQuizId?: string | null
}

// A single participant's (or group's) run through an escape-room activity, as
// seen by the owning lecturer. clearedStacks/totalStacks drive the segmented
// progress bar; hintsUsedCount/penaltySeconds/timeSpentSeconds surface the cost
// side of the run.
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

// Which stack-scoping filter the current activity uses. groupActivity and the
// live-quiz elementBlock path do not gate per-stack via QuestionResponse, so
// their per-stack progress is derived coarsely from the attempt status.
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
  const totalStacks = elementBlockId
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

  // 3. Load every attempt on this activity with the participant/group identity.
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
  // 4. For participant-scoped stack activities, compute cleared stacks from the
  //    correct responses in one query. Group/live-quiz paths fall back to a
  //    status-derived estimate (they do not track per-stack QuestionResponse).
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

    const clearedStacks = elementBlockId
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
      lockoutUntil: attempt.lockoutUntil,
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
    const roster = await ctx.prisma.participation.findMany({
      where: { courseId: participantCourseId, isActive: true },
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
    progress = roster.map(({ participant }) => {
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
  }

  return {
    activityId,
    totalStacks,
    timeLimit: config.timeLimit,
    attempts: progress,
  }
}

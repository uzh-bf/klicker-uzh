import * as DB from '@klicker-uzh/prisma/client'
import { GraphQLError } from 'graphql'
import type { ContextWithUser } from '../lib/context.js'

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
}

// A single participant's (or group's) run through an escape-room activity, as
// seen by the owning lecturer. clearedStacks/totalStacks drive the segmented
// progress bar; hintsUsedCount/penaltySeconds/timeSpentSeconds surface the cost
// side of the run.
export interface EscapeRoomAttemptProgress {
  id: string
  participantId: string | null
  groupId: string | null
  displayName: string
  avatar: string | null
  status: DB.EscapeRoomStatus
  startedAt: Date
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
  const { practiceQuizId, microLearningId, groupActivityId, elementBlockId } =
    args

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
  const totalStacks = stacks.length

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

  const progress: EscapeRoomAttemptProgress[] = attempts.map((attempt) => {
    const hintsUsedCount = Array.isArray(attempt.hintsUsed)
      ? attempt.hintsUsed.length
      : 0

    const clearedStacks =
      attempt.participantId != null
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
  })

  return {
    activityId,
    totalStacks,
    timeLimit: config.timeLimit,
    attempts: progress,
  }
}

import {
  type EscapeRoomScoredStage,
  type EscapeRoomStageOutcome,
  isEscapeRoomBonusStage,
  rankEscapeRoomScores,
  scoreEscapeRoomAttempt,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  isEscapeRoomExpired,
} from '@klicker-uzh/types'
import { GraphQLError } from 'graphql'
import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Context, ContextWithUser } from '../lib/context.js'
import {
  getStageOutcome,
  isBonusAnswered,
  isClearedWithoutAnswer,
  parseEscapeRoomStageOutcomes,
} from './escapeRoomStageOutcomes.js'
import {
  getGroupEscapeRoomStages,
  parseGroupEscapeRoomStageResponses,
} from './groupEscapeRoomSubmissions.js'
import { checkAccess } from './sharing.js'

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
  // Ranking by the shared scoring rules; null until a stage has an outcome.
  rank: number | null
  solvedStages: number
  revealedStages: number
  skippedStages: number
  bonusCorrect: boolean | null
  rankedSeconds: number | null
}

const UNSCORED = {
  rank: null,
  solvedStages: 0,
  revealedStages: 0,
  skippedStages: 0,
  bonusCorrect: null,
  rankedSeconds: null,
} as const

function getScoredStages(
  attempt: {
    groupId: string | null
    status: DB.EscapeRoomStatus
    completedAt: Date | null
    stageResponses: unknown
    stageOutcomes: unknown
  },
  // Number of stages of a Live Quiz block; 0 for the other modes.
  liveQuizStageCount = 0
): EscapeRoomScoredStage[] {
  if (attempt.groupId) {
    return parseGroupEscapeRoomStageResponses(attempt.stageResponses).flatMap(
      (entry) =>
        Number.isNaN(new Date(entry.clearedAt).getTime())
          ? []
          : [
              {
                outcome: entry.outcome ?? 'SOLVED',
                at: entry.clearedAt,
                creditSeconds: entry.creditSeconds,
              },
            ]
    )
  }
  const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes).flatMap(
    (entry) =>
      entry.outcome && entry.at
        ? [
            {
              outcome: entry.outcome,
              at: entry.at,
              creditSeconds: entry.creditSeconds,
            },
          ]
        : []
  )
  // Live Quiz attempts completed before outcomes were recorded count as
  // solved at their completion time; their recorded penalties still apply.
  if (
    outcomes.length === 0 &&
    liveQuizStageCount > 0 &&
    attempt.status === DB.EscapeRoomStatus.COMPLETED &&
    attempt.completedAt
  ) {
    return Array.from({ length: liveQuizStageCount }, () => ({
      outcome: 'SOLVED' as const,
      at: attempt.completedAt as Date,
    }))
  }
  return outcomes
}

export type EscapeRoomStageMode =
  | 'PRACTICE_QUIZ'
  | 'MICROLEARNING'
  | 'GROUP_ACTIVITY'
  | 'LIVE_QUIZ'

// A stage and the element instances it contains: a stack in Practice Quiz and
// Microlearning, a single element instance in Group Activity and Live Quiz.
export interface EscapeRoomStageDescriptor {
  stageKey: string
  instanceIds: number[]
}

export interface EscapeRoomStageResult {
  stageKey: string
  outcome: EscapeRoomStageOutcome | null
  wrongAttempts: number
  hints: number
}

/**
 * Normalizes one attempt of any escape-room mode to one result per stage, so
 * the per-stage insights count the same way in every mode. Hint keys are
 * `<instanceId>` or `<instanceId>:<index>` and are mapped to their stage.
 */
export function getEscapeRoomStageResults(
  mode: EscapeRoomStageMode,
  attempt: {
    status?: DB.EscapeRoomStatus
    completedAt?: Date | null
    stageOutcomes: unknown
    stageResponses?: unknown
    hintsUsed: unknown
  },
  stages: EscapeRoomStageDescriptor[]
): EscapeRoomStageResult[] {
  const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
  const groupResponses =
    mode === 'GROUP_ACTIVITY'
      ? parseGroupEscapeRoomStageResponses(attempt.stageResponses)
      : []
  // Live Quiz attempts completed before outcomes were recorded count as solved.
  const legacySolved =
    mode === 'LIVE_QUIZ' &&
    outcomes.length === 0 &&
    attempt.status === DB.EscapeRoomStatus.COMPLETED
  const hintInstanceIds = (
    Array.isArray(attempt.hintsUsed) ? attempt.hintsUsed : []
  ).map((key) => Number(String(key).split(':')[0]))

  return stages.map((stage) => {
    const recorded = getStageOutcome(outcomes, stage.stageKey)
    const response = groupResponses.find(
      (entry) => String(entry.instanceId) === stage.stageKey
    )
    return {
      stageKey: stage.stageKey,
      outcome: response
        ? (response.outcome ?? 'SOLVED')
        : legacySolved
          ? 'SOLVED'
          : recorded.outcome,
      wrongAttempts: recorded.wrongAttempts,
      hints: hintInstanceIds.filter((id) => stage.instanceIds.includes(id))
        .length,
    }
  })
}

// Per-stage counts over the started attempts of an activity, for the lecturer.
export interface EscapeRoomStageProgress {
  stageKey: string
  title: string | null
  isBonus: boolean
  solved: number
  revealed: number
  skipped: number
  // Wrong answers recorded, but the stage was never cleared.
  attemptedNotCleared: number
  // No outcome and no wrong answer recorded.
  notReached: number
  wrongAttempts: number
  hintsUsed: number
  bonusCorrect: number
  bonusWrong: number
  debrief: string | null
}

export interface EscapeRoomProgress {
  activityId: string
  totalStacks: number
  timeLimit: number
  // Digest that opens the classroom projector of a Live Quiz block.
  projectorDigest: string | null
  attempts: EscapeRoomAttemptProgress[]
  stages: EscapeRoomStageProgress[]
}

// The debrief of a stage is the texts of its elements in element order.
function joinDebriefs(elements: Array<{ options: unknown }>): string | null {
  const texts = elements.flatMap(({ options }) => {
    const text = (options as { escapeRoomDebrief?: unknown } | null)
      ?.escapeRoomDebrief
    return typeof text === 'string' && text.trim() ? [text.trim()] : []
  })
  return texts.length > 0 ? texts.join('\n\n') : null
}

interface StageSource {
  id: number
  order: number
  options: unknown
  element: { name: string }
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
      elementBlock: {
        select: { liveQuiz: { select: { courseId: true } } },
      },
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
        include: {
          elements: {
            select: {
              id: true,
              elementType: true,
              order: true,
              options: true,
              element: { select: { name: true } },
            },
          },
        },
        orderBy: { order: 'asc' },
      })
    : []
  // Group Activity stages are its answerable elements; Live Quiz blocks count
  // their supported elements; individual modes count stacks.
  const liveQuizStages: StageSource[] =
    elementBlockId != null
      ? await ctx.prisma.elementInstance.findMany({
          where: {
            elementBlockId,
            elementType: { in: [...ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES] },
          },
          select: {
            id: true,
            order: true,
            options: true,
            element: { select: { name: true } },
          },
          orderBy: { order: 'asc' },
        })
      : []
  const liveQuizStageIds = liveQuizStages.map((instance) => String(instance.id))
  const totalStacks =
    elementBlockId != null
      ? liveQuizStageIds.length
      : groupActivityId
        ? getGroupEscapeRoomStages(stacks).length
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

  // A closed Live Quiz block ends every attempt on it, including one that
  // started while the block was closing.
  const blockClosed =
    elementBlockId != null &&
    (
      await ctx.prisma.elementBlock.findUnique({
        where: { id: elementBlockId },
        select: { status: true },
      })
    )?.status === DB.ElementBlockStatus.EXECUTED

  const now = Date.now()
  const elapsedAttemptIds = attempts
    .filter(
      (attempt) =>
        attempt.status === DB.EscapeRoomStatus.IN_PROGRESS &&
        (blockClosed || isEscapeRoomExpired(attempt, now))
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

  // Live Quiz attempts record their cleared stages in Redis, the same set the
  // student view counts, because their responses are graded asynchronously.
  // The stored stage outcomes keep the count after the Redis keys expire.
  const liveQuizClearedByAttempt = new Map<string, Set<string>>()
  const unfinishedLiveQuizAttempts =
    elementBlockId != null
      ? attempts.filter(
          (attempt) => attempt.status !== DB.EscapeRoomStatus.COMPLETED
        )
      : []
  if (unfinishedLiveQuizAttempts.length > 0) {
    const pipeline = ctx.redisExec.pipeline()
    for (const attempt of unfinishedLiveQuizAttempts) {
      pipeline.smembers(`escape-attempt:${attempt.id}:cleared`)
    }
    const results = (await pipeline.exec()) ?? []
    const stageIds = new Set(liveQuizStageIds)
    unfinishedLiveQuizAttempts.forEach((attempt, ix) => {
      const [error, members] = results[ix] ?? [null, []]
      const cleared = new Set(
        (!error && Array.isArray(members) ? members : []).map(String)
      )
      // A reveal or skip is stored before the Redis write, so a stage counts
      // as cleared when either store says so.
      for (const entry of parseEscapeRoomStageOutcomes(attempt.stageOutcomes)) {
        if (
          entry.outcome === 'SOLVED' ||
          entry.outcome === 'REVEALED' ||
          entry.outcome === 'SKIPPED'
        ) {
          cleared.add(entry.stageKey)
        }
      }
      liveQuizClearedByAttempt.set(
        attempt.id,
        new Set([...cleared].filter((id) => stageIds.has(id)))
      )
    })
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

    for (const attempt of attempts) {
      const participantId = attempt.participantId
      if (participantId == null) continue
      const correctSet = correct.get(participantId) ?? new Set<number>()
      const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
      let cleared = 0
      for (const stack of stacks) {
        const outcome = getStageOutcome(outcomes, stack.id)
        const allCorrect =
          stack.elements.length > 0 &&
          stack.elements.every((elem) => correctSet.has(elem.id))
        if (
          !allCorrect &&
          !isClearedWithoutAnswer(outcome) &&
          !isBonusAnswered(outcome)
        ) {
          break
        }
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
          : (liveQuizClearedByAttempt.get(attempt.id)?.size ?? 0)
        : attempt.status === DB.EscapeRoomStatus.COMPLETED
          ? totalStacks
          : attempt.participantId != null
            ? (clearedByParticipant.get(attempt.participantId) ?? 0)
            : Math.min(
                parseGroupEscapeRoomStageResponses(attempt.stageResponses)
                  .length,
                totalStacks
              )

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
      rank: null,
      ...scoreEscapeRoomAttempt({
        startedAt: attempt.startedAt,
        penaltySeconds: attempt.penaltySeconds,
        stages: getScoredStages(attempt, liveQuizStageIds.length),
      }),
    }
  }

  let progress = attempts.map(progressForAttempt)
  const participantCourseId =
    config.practiceQuiz?.courseId ??
    config.microLearning?.courseId ??
    config.elementBlock?.liveQuiz.courseId
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
            ...UNSCORED,
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
            ...UNSCORED,
          }
    })
    const orphanProgress = attempts
      .filter(
        (attempt) => attempt.groupId && !rosterGroupIds.has(attempt.groupId)
      )
      .map(progressForAttempt)
    progress = [...rosterProgress, ...orphanProgress]
  }

  const ranks = new Map(
    rankEscapeRoomScores(
      progress.map((entry, index) => ({ ...entry, index }))
    ).map((entry) => [entry.index, entry.rank])
  )

  // Stage descriptors in play order, one per stage of the activity.
  const mode: EscapeRoomStageMode =
    elementBlockId != null
      ? 'LIVE_QUIZ'
      : groupActivityId
        ? 'GROUP_ACTIVITY'
        : microLearningId
          ? 'MICROLEARNING'
          : 'PRACTICE_QUIZ'
  const stageSources: Array<{
    descriptor: EscapeRoomStageDescriptor
    elements: StageSource[]
  }> =
    mode === 'LIVE_QUIZ'
      ? liveQuizStages.map((instance) => ({
          descriptor: {
            stageKey: String(instance.id),
            instanceIds: [instance.id],
          },
          elements: [instance],
        }))
      : mode === 'GROUP_ACTIVITY'
        ? getGroupEscapeRoomStages(stacks).map((instance) => ({
            descriptor: {
              stageKey: String(instance.id),
              instanceIds: [instance.id],
            },
            elements: [instance],
          }))
        : stacks.map((stack) => {
            const elements = [...stack.elements].sort(
              (a, b) => a.order - b.order
            )
            return {
              descriptor: {
                stageKey: String(stack.id),
                instanceIds: elements.map((element) => element.id),
              },
              elements,
            }
          })
  const descriptors = stageSources.map((source) => source.descriptor)
  const stageResultsByAttempt = attempts.map((attempt) => {
    const cleared = liveQuizClearedByAttempt.get(attempt.id)
    return getEscapeRoomStageResults(mode, attempt, descriptors).map(
      (result) =>
        // A solve is in the Redis set before its outcome is stored.
        result.outcome === null && cleared?.has(result.stageKey)
          ? { ...result, outcome: 'SOLVED' as const }
          : result
    )
  })
  const stages = stageSources.map(({ descriptor, elements }, index) => {
    const stage: EscapeRoomStageProgress = {
      stageKey: descriptor.stageKey,
      title: elements[0]?.element.name ?? null,
      isBonus: isEscapeRoomBonusStage(config, index, stageSources.length),
      solved: 0,
      revealed: 0,
      skipped: 0,
      attemptedNotCleared: 0,
      notReached: 0,
      wrongAttempts: 0,
      hintsUsed: 0,
      bonusCorrect: 0,
      bonusWrong: 0,
      debrief: joinDebriefs(elements),
    }
    for (const results of stageResultsByAttempt) {
      const { outcome, wrongAttempts, hints } = results[index]!
      stage.wrongAttempts += wrongAttempts
      stage.hintsUsed += hints
      if (outcome === 'SOLVED') stage.solved += 1
      else if (outcome === 'REVEALED') stage.revealed += 1
      else if (outcome === 'SKIPPED') stage.skipped += 1
      else if (outcome === 'BONUS_CORRECT') stage.bonusCorrect += 1
      else if (outcome === 'BONUS_WRONG') stage.bonusWrong += 1
      else if (wrongAttempts > 0 || hints > 0) stage.attemptedNotCleared += 1
      else stage.notReached += 1
    }
    return stage
  })

  return {
    activityId,
    totalStacks,
    timeLimit: config.timeLimit,
    projectorDigest:
      // Without a secret the cockpit omits the projector link.
      elementBlockId != null && liveQuizId && process.env.APP_SECRET
        ? getEscapeRoomProjectorDigest(liveQuizId, elementBlockId)
        : null,
    attempts: progress.map((entry, index) => ({
      ...entry,
      rank: ranks.get(index) ?? null,
    })),
    stages,
  }
}

// Purpose-scoped digest that opens the projector of one Live Quiz block. Its
// message differs from the results-page and leaderboard digests, so neither
// unlocks the other.
export function getEscapeRoomProjectorDigest(
  liveQuizId: string,
  elementBlockId: number
): string {
  const secret = process.env.APP_SECRET
  if (!secret) throw new GraphQLError('Projector access is not configured')
  return createHmac('sha256', secret)
    .update(`escape-projector:liveQuizBlock:${liveQuizId}:${elementBlockId}`)
    .digest('hex')
}

export function isValidEscapeRoomProjectorDigest(
  liveQuizId: string,
  elementBlockId: number,
  digest: string | null | undefined
): boolean {
  if (!digest) return false
  const expected = Buffer.from(
    getEscapeRoomProjectorDigest(liveQuizId, elementBlockId)
  )
  const received = Buffer.from(digest)
  return (
    received.length === expected.length && timingSafeEqual(received, expected)
  )
}

export type EscapeRoomProjectorPhase = 'LOBBY' | 'RUNNING' | 'CLOSED'

// One listed participant on the projector. It carries no attempt, participant
// or group identifier.
export interface EscapeRoomProjectorRow {
  rank: number | null
  displayName: string
  avatar: string | null
  clearedStages: number
  solvedStages: number
  revealedStages: number
  skippedStages: number
  bonusCorrect: boolean | null
  rankedSeconds: number | null
  status: EscapeRoomAttemptProgress['status']
  endsAt: Date | null
}

export interface EscapeRoomProjector {
  phase: EscapeRoomProjectorPhase
  serverNow: Date
  closesAt: Date | null
  timeLimit: number
  totalStages: number
  startedCount: number
  rankedCount: number
  rows: EscapeRoomProjectorRow[]
  stages: EscapeRoomStageProgress[]
}

const PROJECTOR_PHASES: Record<
  DB.ElementBlockStatus,
  EscapeRoomProjectorPhase
> = {
  SCHEDULED: 'LOBBY',
  ACTIVE: 'RUNNING',
  EXECUTED: 'CLOSED',
}

/**
 * Classroom projector view of a Live Quiz escape block. Access is either READ
 * permission on the quiz or the block's projector digest. Participants are
 * listed under the Live Quiz leaderboard rules; all started attempts count in
 * the totals and per-stage numbers.
 */
export async function getEscapeRoomProjector(
  args: EscapeRoomProgressArgs & { digest?: string | null },
  ctx: Context
): Promise<EscapeRoomProjector> {
  const { liveQuizId, elementBlockId, digest } = args
  if (
    !liveQuizId ||
    elementBlockId == null ||
    args.practiceQuizId ||
    args.microLearningId ||
    args.groupActivityId
  ) {
    throw new GraphQLError('The projector supports Live Quiz blocks only')
  }

  const hasAccess =
    isValidEscapeRoomProjectorDigest(liveQuizId, elementBlockId, digest) ||
    (ctx.user != null &&
      (await checkAccess(
        [
          {
            liveQuizId,
            minimumPermissionLevel: DB.PermissionLevel.READ,
          },
        ],
        ctx as ContextWithUser
      )))
  if (!hasAccess) throw new GraphQLError('Not authorized')

  const block = await ctx.prisma.elementBlock.findFirst({
    where: { id: elementBlockId, liveQuizId },
    select: {
      status: true,
      expiresAt: true,
      liveQuiz: {
        select: {
          courseId: true,
          course: { select: { isGamificationEnabled: true } },
        },
      },
    },
  })
  // The progress service reads and expires attempts on behalf of the lecturer;
  // access was decided above.
  const progress = block
    ? await getEscapeRoomProgress(
        { liveQuizId, elementBlockId },
        ctx as ContextWithUser
      )
    : null
  if (!block || !progress) throw new GraphQLError('Escape room not found')

  const phase = PROJECTOR_PHASES[block.status]
  const started = progress.attempts.filter(
    (attempt) => attempt.status !== 'NOT_STARTED'
  )

  // Live Quiz leaderboard rules: in a gamified course only participants who
  // opted in are listed, and only public profiles show their name.
  const gamified = block.liveQuiz.course?.isGamificationEnabled ?? false
  const participantIds = started.flatMap((attempt) =>
    attempt.participantId ? [attempt.participantId] : []
  )
  const [participants, participations] = await Promise.all([
    ctx.prisma.participant.findMany({
      where: { id: { in: participantIds } },
      select: { id: true, isProfilePublic: true },
    }),
    gamified && block.liveQuiz.courseId
      ? ctx.prisma.participation.findMany({
          where: {
            courseId: block.liveQuiz.courseId,
            participantId: { in: participantIds },
          },
          select: { participantId: true, isActive: true },
        })
      : [],
  ])
  const publicProfiles = new Map(
    participants.map((participant) => [
      participant.id,
      participant.isProfilePublic,
    ])
  )
  const optedIn = new Map<string, boolean>(
    participations.map(
      (entry) => [entry.participantId, entry.isActive] as const
    )
  )
  const listed = started.filter(
    (attempt) =>
      attempt.participantId != null &&
      (!gamified || optedIn.get(attempt.participantId) === true)
  )

  // Rank only among the listed participants, with the shared comparator.
  const rows = rankEscapeRoomScores(listed).map((attempt) => {
    const isPublic = publicProfiles.get(attempt.participantId!) ?? false
    return {
      rank: attempt.rank,
      displayName: isPublic ? attempt.displayName : 'Anonymous',
      avatar: isPublic ? attempt.avatar : null,
      clearedStages: attempt.clearedStacks,
      solvedStages: attempt.solvedStages,
      revealedStages: attempt.revealedStages,
      skippedStages: attempt.skippedStages,
      bonusCorrect: attempt.bonusCorrect,
      rankedSeconds: attempt.rankedSeconds,
      status: attempt.status,
      endsAt:
        attempt.status === DB.EscapeRoomStatus.IN_PROGRESS && attempt.startedAt
          ? new Date(attempt.startedAt.getTime() + progress.timeLimit * 1000)
          : null,
    }
  })

  return {
    phase,
    serverNow: new Date(),
    closesAt: block.expiresAt,
    timeLimit: progress.timeLimit,
    totalStages: progress.totalStacks,
    startedCount: started.length,
    rankedCount: rows.filter((row) => row.rank !== null).length,
    rows,
    stages: progress.stages.map((stage) => ({
      ...stage,
      debrief: phase === 'CLOSED' ? stage.debrief : null,
    })),
  }
}

import {
  type EscapeRoomRules,
  getEscapeRoomHintPenalty,
  getEscapeRoomSkipPenalty,
  isEscapeRoomBonusStage,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import {
  ESCAPE_ROOM_GRACE_SECONDS,
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  getCurrentEscapeRoomInstance,
  getEscapeRoomHintKey,
  getEscapeRoomInstanceHints,
  getEscapeRoomLifecycleClaimKey,
  isEscapeRoomExpired,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import type { IEscapeRoomRulesInput } from '../schema/escapeRoomConfig.js'
import {
  type EscapeRoomStageOutcomeEntry,
  getEscapeRoomRules,
  getStageOutcome,
  isBonusAnswered,
  isClearedWithoutAnswer,
  parseEscapeRoomStageOutcomes,
  setStageOutcome,
} from './escapeRoomStageOutcomes.js'
import {
  completeGroupEscapeRoomDecisions,
  getGroupEscapeRoomStages,
  type GroupEscapeRoomStageResponse,
  isGroupEscapeRoomComplete,
  parseGroupEscapeRoomStageResponses,
} from './groupEscapeRoomSubmissions.js'
import { checkAccess } from './sharing.js'

export { ESCAPE_ROOM_GRACE_SECONDS }

const RELEASE_ESCAPE_ROOM_CLAIM = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

export async function releaseEscapeRoomLifecycleClaim(
  ctx: Pick<ContextWithUser, 'redisExec'>,
  claimKey: string,
  claimToken: string
) {
  await ctx.redisExec.eval(RELEASE_ESCAPE_ROOM_CLAIM, 1, claimKey, claimToken)
}

export function validateEscapeRoomConfig({
  timeLimit,
  hintPenalty,
}: {
  timeLimit: number
  hintPenalty: number
}) {
  if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 86_400) {
    throw new GraphQLError(
      'Escape room time limit must be an integer between 1 and 86400 seconds',
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }
  if (
    !Number.isInteger(hintPenalty) ||
    hintPenalty < 0 ||
    hintPenalty > 3_600
  ) {
    throw new GraphQLError(
      'Escape room hint penalty must be an integer between 0 and 3600 seconds',
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }
}

function getRuleSeconds(value: number | null | undefined, field: string) {
  if (value == null) return null
  if (!Number.isInteger(value) || value < 0 || value > 3_600) {
    throw new GraphQLError(
      `Escape room ${field} must be an integer between 0 and 3600 seconds`,
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }
  return value
}

// Validates the scoring rules and returns the complete config data. Without
// an input the stored rules stay unchanged (and default to off on create).
export function getEscapeRoomRulesData(
  rules: IEscapeRoomRulesInput | null | undefined
) {
  if (!rules) return {}
  const hintPenalties = rules.hintPenalties ?? []
  if (hintPenalties.length > 10) {
    throw new GraphQLError('Escape rooms support at most 10 hint penalties', {
      extensions: { code: 'BAD_USER_INPUT' },
    })
  }
  const maxWrongAttempts = rules.maxWrongAttempts ?? null
  if (
    maxWrongAttempts !== null &&
    (!Number.isInteger(maxWrongAttempts) ||
      maxWrongAttempts < 1 ||
      maxWrongAttempts > 50)
  ) {
    throw new GraphQLError(
      'Escape room attempts before reveal must be an integer between 1 and 50',
      { extensions: { code: 'BAD_USER_INPUT' } }
    )
  }
  return {
    hintPenalties: hintPenalties.map(
      (penalty) => getRuleSeconds(penalty, 'hint penalty')!
    ),
    wrongAnswerPenalty:
      getRuleSeconds(rules.wrongAnswerPenalty, 'wrong answer penalty') ?? 0,
    maxWrongAttempts,
    revealPenalty: getRuleSeconds(rules.revealPenalty, 'reveal penalty') ?? 0,
    skipPenalty: getRuleSeconds(rules.skipPenalty, 'skip penalty'),
    bonusSeconds: getRuleSeconds(rules.bonusSeconds, 'bonus time'),
  }
}

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
  return Math.max(0, Math.ceil(attempt.timeLimit - elapsedSeconds))
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

  const accessRequest = args.practiceQuizId
    ? {
        practiceQuizId: args.practiceQuizId,
        minimumPermissionLevel: DB.PermissionLevel.WRITE,
      }
    : args.microLearningId
      ? {
          microLearningId: args.microLearningId,
          minimumPermissionLevel: DB.PermissionLevel.WRITE,
        }
      : args.groupActivityId
        ? {
            groupActivityId: args.groupActivityId,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          }
        : {
            liveQuizId: args.liveQuizId!,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          }
  const hasWriteAccess = await checkAccess([accessRequest], ctx)
  if (!hasWriteAccess) {
    throw new GraphQLError('Write access is required to read escape room hints')
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
    const hints = getEscapeRoomInstanceHints(element.options)
    return hints.length > 0
      ? [{ instanceId: element.id, hint: hints[0]!.text, hints }]
      : []
  })
}

type HintOptions = Parameters<typeof getEscapeRoomInstanceHints>[0]

type StackWithRevealedHints<
  T extends {
    elements: Array<{ id: number; options: HintOptions }>
  },
> = Omit<T, 'elements'> & {
  elements: Array<
    T['elements'][number] & {
      revealedHint: string | null
      revealedHints: string[]
    }
  >
}

export function getRevealedEscapeRoomHints(
  instanceId: number,
  options: HintOptions,
  hintsUsed: unknown
) {
  const usedHintKeys = new Set(
    Array.isArray(hintsUsed) ? hintsUsed.map(String) : []
  )
  return getEscapeRoomInstanceHints(options).flatMap((hint, index) =>
    usedHintKeys.has(getEscapeRoomHintKey(instanceId, index)) ? [hint.text] : []
  )
}

export function restoreUsedEscapeRoomHints<
  T extends {
    elements: Array<{ id: number; options: HintOptions }>
  },
>(stacks: T[], hintsUsed: unknown): StackWithRevealedHints<T>[] {
  return stacks.map((stack) => ({
    ...stack,
    elements: stack.elements.map((element) => {
      const revealedHints = getRevealedEscapeRoomHints(
        element.id,
        element.options,
        hintsUsed
      )
      return {
        ...element,
        revealedHint: revealedHints[0] ?? null,
        revealedHints,
      }
    }),
  }))
}

export function isEscapeRoomStackCleared(
  elements: Array<{
    elementType: DB.ElementType
    responses?: Array<{
      lastResponseCorrectness: DB.ResponseCorrectness | null
    }>
  }>,
  // The stack's rule state; a revealed, skipped or answered bonus stage
  // counts as cleared without a correct response.
  outcome?: Pick<EscapeRoomStageOutcomeEntry, 'outcome'>
) {
  if (isClearedWithoutAnswer(outcome) || isBonusAnswered(outcome)) return true
  return elements.every((element) =>
    element.responses?.some(
      (response) =>
        response.lastResponseCorrectness === DB.ResponseCorrectness.CORRECT
    )
  )
}

interface EscapeRoomActivityArgs {
  practiceQuizId?: string | null
  microLearningId?: string | null
  groupActivityId?: string | null
  groupId?: string | null
  elementBlockId?: number | null
}

type EscapeRoomActivityReference =
  | { kind: 'practiceQuiz'; id: string }
  | { kind: 'microLearning'; id: string }
  | { kind: 'groupActivity'; id: string }
  | { kind: 'liveQuizBlock'; id: number }

function getEscapeRoomActivityReference({
  practiceQuizId,
  microLearningId,
  groupActivityId,
  elementBlockId,
}: EscapeRoomActivityArgs): EscapeRoomActivityReference {
  const references: EscapeRoomActivityReference[] = []
  if (practiceQuizId)
    references.push({ kind: 'practiceQuiz', id: practiceQuizId })
  if (microLearningId)
    references.push({ kind: 'microLearning', id: microLearningId })
  if (groupActivityId)
    references.push({ kind: 'groupActivity', id: groupActivityId })
  if (elementBlockId != null)
    references.push({ kind: 'liveQuizBlock', id: elementBlockId })

  if (references.length !== 1) {
    throw new GraphQLError('Exactly one activity ID must be specified', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  const [reference] = references
  return reference!
}

interface ResolvedParticipantEscapeRoom {
  reference: EscapeRoomActivityReference
  groupId: string | null
  config: DB.EscapeRoomConfig
}

async function resolveParticipantEscapeRoom(
  reference: EscapeRoomActivityReference,
  participantId: string,
  requestedGroupId: string | null | undefined,
  ctx: ContextWithUser
): Promise<ResolvedParticipantEscapeRoom> {
  let courseId: string
  let config: DB.EscapeRoomConfig | null
  let groupId: string | null = null

  switch (reference.kind) {
    case 'practiceQuiz': {
      const activity = await ctx.prisma.practiceQuiz.findUnique({
        where: { id: reference.id, isDeleted: false },
        include: { escapeRoomConfig: true },
      })
      if (!activity || activity.status !== DB.PublicationStatus.PUBLISHED) {
        throw new GraphQLError('Practice quiz not found')
      }
      courseId = activity.courseId
      config = activity.escapeRoomConfig
      break
    }
    case 'microLearning': {
      const activity = await ctx.prisma.microLearning.findUnique({
        where: { id: reference.id, isDeleted: false },
        include: { escapeRoomConfig: true },
      })
      if (!activity || activity.status !== DB.PublicationStatus.PUBLISHED) {
        throw new GraphQLError('Microlearning not found')
      }
      courseId = activity.courseId
      config = activity.escapeRoomConfig
      break
    }
    case 'groupActivity': {
      if (!requestedGroupId) {
        throw new GraphQLError(
          'A group ID is required for group escape room access',
          { extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' } }
        )
      }
      const activity = await ctx.prisma.groupActivity.findUnique({
        where: { id: reference.id, isDeleted: false },
        include: { escapeRoomConfig: true },
      })
      if (!activity || activity.status !== DB.PublicationStatus.PUBLISHED) {
        throw new GraphQLError('Group activity not found')
      }
      courseId = activity.courseId
      config = activity.escapeRoomConfig
      const participantGroup = await ctx.prisma.participantGroup.findFirst({
        where: {
          id: requestedGroupId,
          courseId,
          participants: { some: { id: participantId } },
        },
        select: { id: true },
      })
      if (!participantGroup) {
        throw new GraphQLError('Participant is not in a group for this course')
      }
      groupId = participantGroup.id
      break
    }
    case 'liveQuizBlock': {
      const block = await ctx.prisma.elementBlock.findUnique({
        where: { id: reference.id },
        include: { escapeRoomConfig: true, liveQuiz: true },
      })
      if (
        !block ||
        block.status !== DB.ElementBlockStatus.ACTIVE ||
        !block.liveQuiz.courseId
      ) {
        throw new GraphQLError('Block not found')
      }
      courseId = block.liveQuiz.courseId
      config = block.escapeRoomConfig
      break
    }
  }

  if (!config) {
    throw new GraphQLError(
      'This activity is not configured for escape room mode'
    )
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: { courseId, participantId },
    },
    select: { id: true },
  })
  if (!participation) {
    throw new GraphQLError(
      'You are not enrolled in the course associated with this activity',
      { extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' } }
    )
  }

  return { reference, groupId, config }
}

function getAttemptWhere(
  activity: ResolvedParticipantEscapeRoom,
  participantId: string
): DB.Prisma.EscapeRoomAttemptWhereUniqueInput {
  switch (activity.reference.kind) {
    case 'practiceQuiz':
      return {
        participantId_practiceQuizId: {
          participantId,
          practiceQuizId: activity.reference.id,
        },
      }
    case 'microLearning':
      return {
        participantId_microLearningId: {
          participantId,
          microLearningId: activity.reference.id,
        },
      }
    case 'groupActivity':
      if (!activity.groupId) {
        throw new GraphQLError('Participant group could not be resolved')
      }
      return {
        groupId_groupActivityId: {
          groupId: activity.groupId,
          groupActivityId: activity.reference.id,
        },
      }
    case 'liveQuizBlock':
      return {
        participantId_elementBlockId: {
          participantId,
          elementBlockId: activity.reference.id,
        },
      }
  }
}

function getAttemptActivityData(
  activity: ResolvedParticipantEscapeRoom
): Pick<
  DB.Prisma.EscapeRoomAttemptUncheckedCreateInput,
  | 'practiceQuizId'
  | 'microLearningId'
  | 'groupActivityId'
  | 'elementBlockId'
  | 'groupId'
> {
  return {
    practiceQuizId:
      activity.reference.kind === 'practiceQuiz' ? activity.reference.id : null,
    microLearningId:
      activity.reference.kind === 'microLearning'
        ? activity.reference.id
        : null,
    groupActivityId:
      activity.reference.kind === 'groupActivity'
        ? activity.reference.id
        : null,
    elementBlockId:
      activity.reference.kind === 'liveQuizBlock'
        ? activity.reference.id
        : null,
    groupId: activity.groupId,
  }
}

function requireParticipant(ctx: ContextWithUser, action: string) {
  if (!ctx.user?.sub || ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw new GraphQLError(`Only participants can ${action}`, {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }
  return ctx.user.sub
}

export async function startEscapeRoomAttempt(
  args: EscapeRoomActivityArgs,
  ctx: ContextWithUser
) {
  const participantId = requireParticipant(ctx, 'start escape room attempts')
  const activity = await resolveParticipantEscapeRoom(
    getEscapeRoomActivityReference(args),
    participantId,
    args.groupId,
    ctx
  )
  const claimKey = getEscapeRoomLifecycleClaimKey(
    activity.reference.kind,
    activity.reference.id,
    activity.groupId ?? participantId
  )
  const claimToken = `start:${randomUUID()}`
  let claimed = false

  for (let attempt = 0; attempt < 40; attempt++) {
    const claimResult = await ctx.redisExec.set(
      claimKey,
      claimToken,
      'EX',
      300,
      'NX'
    )
    if (claimResult === 'OK') {
      claimed = true
      break
    }

    const claimOwner = await ctx.redisExec.get(claimKey)
    if (claimOwner != null && !claimOwner.startsWith('start:')) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  if (!claimed) {
    throw new GraphQLError(
      'The escape room lifecycle is currently being updated',
      { extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' } }
    )
  }

  try {
    const attemptWhere = getAttemptWhere(activity, participantId)
    const existingAttempt = await ctx.prisma.escapeRoomAttempt.findUnique({
      where: attemptWhere,
    })

    if (existingAttempt) {
      if (
        existingAttempt.status === DB.EscapeRoomStatus.IN_PROGRESS &&
        isEscapeRoomExpired(existingAttempt)
      ) {
        return await ctx.prisma.escapeRoomAttempt.update({
          where: { id: existingAttempt.id },
          data: { status: DB.EscapeRoomStatus.EXPIRED },
        })
      }
      return existingAttempt
    }

    try {
      return await ctx.prisma.escapeRoomAttempt.upsert({
        where: attemptWhere,
        update: {},
        create: {
          ...getAttemptActivityData(activity),
          participantId: activity.groupId ? null : participantId,
          timeLimit: activity.config.timeLimit,
          penaltySeconds: 0,
          hintsUsed: [],
          status: DB.EscapeRoomStatus.IN_PROGRESS,
        },
      })
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        return await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
          where: attemptWhere,
        })
      }
      throw error
    }
  } finally {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
  }
}

interface RequestEscapeRoomHintArgs extends EscapeRoomActivityArgs {
  instanceId: number
}

export interface EscapeRoomHintResult {
  // The hint revealed by this request (or the last one when none is left).
  hint: string
  // Every revealed hint of the instance, in order.
  hints: string[]
  hasMoreHints: boolean
  attempt: DB.EscapeRoomAttempt
}

function instanceBelongsToActivity(
  instance: {
    elementBlockId: number | null
    elementStack: {
      practiceQuizId: string | null
      microLearningId: string | null
      groupActivityId: string | null
    } | null
  },
  reference: EscapeRoomActivityReference
) {
  switch (reference.kind) {
    case 'practiceQuiz':
      return instance.elementStack?.practiceQuizId === reference.id
    case 'microLearning':
      return instance.elementStack?.microLearningId === reference.id
    case 'groupActivity':
      return instance.elementStack?.groupActivityId === reference.id
    case 'liveQuizBlock':
      return instance.elementBlockId === reference.id
  }
}

async function revealEscapeRoomHint(
  instanceId: number,
  participantId: string,
  activity: ResolvedParticipantEscapeRoom,
  ctx: ContextWithUser
): Promise<EscapeRoomHintResult> {
  const attempt = await ctx.prisma.escapeRoomAttempt.findUnique({
    where: getAttemptWhere(activity, participantId),
  })

  if (!attempt || attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS) {
    throw new GraphQLError(
      'No active escape room attempt found for this activity',
      { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
    )
  }
  if (attempt.lockoutUntil && dayjs().isBefore(dayjs(attempt.lockoutUntil))) {
    throw new GraphQLError(
      'You are locked out due to a recent incorrect attempt',
      {
        extensions: {
          code: 'ESCAPE_ROOM_LOCKOUT',
          lockoutUntil: attempt.lockoutUntil.toISOString(),
          lockoutRemainingSeconds: getRemainingSecondsUntil(
            attempt.lockoutUntil
          ),
        },
      }
    )
  }
  if (isEscapeRoomExpired(attempt)) {
    await ctx.prisma.escapeRoomAttempt.update({
      where: { id: attempt.id },
      data: { status: DB.EscapeRoomStatus.EXPIRED },
    })
    throw new GraphQLError('Escape room time has expired', {
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })
  }

  const instance = await ctx.prisma.elementInstance.findUnique({
    where: { id: instanceId },
    include: { elementStack: true },
  })
  if (!instance) throw new GraphQLError('Element instance not found')
  if (!instanceBelongsToActivity(instance, activity.reference)) {
    throw new GraphQLError('Element does not belong to this activity', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }

  if (
    activity.reference.kind === 'practiceQuiz' ||
    activity.reference.kind === 'microLearning'
  ) {
    const stacks = await ctx.prisma.elementStack.findMany({
      where:
        activity.reference.kind === 'practiceQuiz'
          ? { practiceQuizId: activity.reference.id }
          : { microLearningId: activity.reference.id },
      orderBy: { order: 'asc' },
      select: {
        id: true,
        elements: {
          select: {
            id: true,
            elementType: true,
            responses: {
              where: { participantId },
              select: { lastResponseCorrectness: true },
            },
          },
        },
      },
    })
    const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
    const currentStack = stacks.find(
      (stack) =>
        !isEscapeRoomStackCleared(
          stack.elements,
          getStageOutcome(outcomes, stack.id)
        )
    )
    if (!currentStack || instance.elementStackId !== currentStack.id) {
      throw new GraphQLError(
        'You must answer all preceding questions correctly before requesting this hint',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  } else if (activity.reference.kind === 'liveQuizBlock') {
    const blockInstances = await ctx.prisma.elementInstance.findMany({
      where: {
        elementBlockId: activity.reference.id,
        elementType: { in: [...ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES] },
      },
      orderBy: { order: 'asc' },
      select: { id: true },
    })
    const clearedInstanceIds = new Set(
      await ctx.redisExec.smembers(`escape-attempt:${attempt.id}:cleared`)
    )
    const currentInstance = getCurrentEscapeRoomInstance(
      blockInstances,
      clearedInstanceIds
    )
    if (currentInstance?.id !== instanceId) {
      throw new GraphQLError(
        'You must answer all preceding questions correctly before requesting this hint',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  }

  if (activity.reference.kind === 'groupActivity') {
    const stacks = await ctx.prisma.elementStack.findMany({
      where: { groupActivityId: activity.reference.id },
      select: {
        order: true,
        elements: { select: { id: true, elementType: true, order: true } },
      },
    })
    const clearedIds = new Set(
      parseGroupEscapeRoomStageResponses(attempt.stageResponses).map(
        (entry) => entry.instanceId
      )
    )
    const currentStage = getGroupEscapeRoomStages(stacks).find(
      (stage) => !clearedIds.has(stage.id)
    )
    if (currentStage?.id !== instanceId) {
      throw new GraphQLError(
        'Hints are only available for the current escape room stage',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  }

  const hints = getEscapeRoomInstanceHints(instance.options)
  if (hints.length === 0) {
    throw new GraphQLError('No hint available for this element', {
      extensions: { code: 'ESCAPE_ROOM_NO_HINT' },
    })
  }

  // Hints reveal in order; a request after the last hint is idempotent.
  const usedHintKeys = new Set(
    Array.isArray(attempt.hintsUsed) ? attempt.hintsUsed.map(String) : []
  )
  const hintIndex = hints.findIndex(
    (_, index) => !usedHintKeys.has(getEscapeRoomHintKey(instanceId, index))
  )
  if (hintIndex !== -1) {
    const hintKey = getEscapeRoomHintKey(instanceId, hintIndex)
    const penalty = getEscapeRoomHintPenalty(
      getEscapeRoomRules(activity.config),
      hintIndex,
      hints[hintIndex]!.penalty
    )
    await ctx.prisma.$executeRaw`
      UPDATE "EscapeRoomAttempt"
      SET "penaltySeconds" = "penaltySeconds" + ${penalty},
          "hintsUsed" = "hintsUsed" || ${JSON.stringify([hintKey])}::jsonb
      WHERE "id" = ${attempt.id}::uuid
        AND NOT ("hintsUsed" @> ${JSON.stringify([hintKey])}::jsonb)
    `
  }

  const updatedAttempt = await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
    where: { id: attempt.id },
  })
  const revealedHints = getRevealedEscapeRoomHints(
    instanceId,
    instance.options,
    updatedAttempt.hintsUsed
  )
  return {
    hint: revealedHints.at(-1) ?? hints[0]!.text,
    hints: revealedHints,
    hasMoreHints: revealedHints.length < hints.length,
    attempt: updatedAttempt,
  }
}

export async function requestEscapeRoomHint(
  { instanceId, ...args }: RequestEscapeRoomHintArgs,
  ctx: ContextWithUser
): Promise<EscapeRoomHintResult> {
  const participantId = requireParticipant(ctx, 'request escape room hints')
  const activity = await resolveParticipantEscapeRoom(
    getEscapeRoomActivityReference(args),
    participantId,
    args.groupId,
    ctx
  )
  const claimKey = getEscapeRoomLifecycleClaimKey(
    activity.reference.kind,
    activity.reference.id,
    activity.groupId ?? participantId
  )
  const claimToken = `hint:${randomUUID()}`
  let claimed = false

  // Concurrent requests for the same hint remain idempotent: wait for another
  // hint reader, then re-check the attempt and current stage. A response,
  // reset, or other lifecycle owner is not compatible and fails immediately.
  for (let attempt = 0; attempt < 40; attempt++) {
    const claimResult = await ctx.redisExec.set(
      claimKey,
      claimToken,
      'EX',
      300,
      'NX'
    )
    if (claimResult === 'OK') {
      claimed = true
      break
    }

    const claimOwner = await ctx.redisExec.get(claimKey)
    if (claimOwner != null && !claimOwner.startsWith('hint:')) {
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 25))
  }

  if (!claimed) {
    throw new GraphQLError(
      'The escape room lifecycle is currently being updated',
      { extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' } }
    )
  }

  try {
    return await revealEscapeRoomHint(instanceId, participantId, activity, ctx)
  } finally {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
  }
}

function assertSkippableAttempt(attempt: DB.EscapeRoomAttempt | null) {
  if (!attempt || attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS) {
    throw new GraphQLError(
      'No active escape room attempt found for this activity',
      { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
    )
  }
  if (isEscapeRoomExpired(attempt)) {
    throw new GraphQLError('Escape room time has expired', {
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })
  }
  return attempt
}

function skipGatedError() {
  return new GraphQLError('Only the current escape room stage can be skipped', {
    extensions: { code: 'ESCAPE_ROOM_GATED' },
  })
}

async function skipIndividualStage(
  activity: ResolvedParticipantEscapeRoom,
  participantId: string,
  rules: EscapeRoomRules,
  skipPenalty: number,
  ctx: ContextWithUser
) {
  const attempt = assertSkippableAttempt(
    await ctx.prisma.escapeRoomAttempt.findUnique({
      where: getAttemptWhere(activity, participantId),
    })
  )
  const stacks = await ctx.prisma.elementStack.findMany({
    where:
      activity.reference.kind === 'practiceQuiz'
        ? { practiceQuizId: activity.reference.id as string }
        : { microLearningId: activity.reference.id as string },
    orderBy: { order: 'asc' },
    select: {
      id: true,
      elements: {
        select: {
          elementType: true,
          responses: {
            where: { participantId },
            select: { lastResponseCorrectness: true },
          },
        },
      },
    },
  })
  const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
  const isCleared = (
    stack: (typeof stacks)[number],
    entries: EscapeRoomStageOutcomeEntry[]
  ) =>
    isEscapeRoomStackCleared(stack.elements, getStageOutcome(entries, stack.id))
  const currentIndex = stacks.findIndex((stack) => !isCleared(stack, outcomes))
  if (
    currentIndex === -1 ||
    isEscapeRoomBonusStage(rules, currentIndex, stacks.length)
  ) {
    throw skipGatedError()
  }

  const now = new Date()
  const nextOutcomes = setStageOutcome(outcomes, {
    ...getStageOutcome(outcomes, stacks[currentIndex]!.id),
    outcome: 'SKIPPED',
    at: now.toISOString(),
  })
  const completed = stacks.every(
    (stack, index) =>
      isEscapeRoomBonusStage(rules, index, stacks.length) ||
      isCleared(stack, nextOutcomes)
  )
  return ctx.prisma.escapeRoomAttempt.update({
    where: { id: attempt.id },
    data: {
      stageOutcomes: nextOutcomes as unknown as DB.Prisma.InputJsonValue,
      penaltySeconds: { increment: skipPenalty },
      ...(completed
        ? { status: DB.EscapeRoomStatus.COMPLETED, completedAt: now }
        : {}),
    },
  })
}

async function skipGroupStage(
  activity: ResolvedParticipantEscapeRoom,
  rules: EscapeRoomRules,
  skipPenalty: number,
  ctx: ContextWithUser
) {
  const groupActivityId = activity.reference.id as string
  const groupId = activity.groupId!
  return ctx.prisma.$transaction(
    async (prisma) => {
      const attempt = assertSkippableAttempt(
        await prisma.escapeRoomAttempt.findUnique({
          where: { groupId_groupActivityId: { groupId, groupActivityId } },
        })
      )
      const stacks = await prisma.elementStack.findMany({
        where: { groupActivityId },
        select: {
          order: true,
          elements: { select: { id: true, elementType: true, order: true } },
        },
      })
      const stages = getGroupEscapeRoomStages(stacks)
      const entries = parseGroupEscapeRoomStageResponses(attempt.stageResponses)
      const clearedIds = new Set(entries.map((entry) => entry.instanceId))
      const currentIndex = stages.findIndex(
        (stage) => !clearedIds.has(stage.id)
      )
      if (
        currentIndex === -1 ||
        isEscapeRoomBonusStage(rules, currentIndex, stages.length)
      ) {
        throw skipGatedError()
      }

      const now = new Date()
      const stage = stages[currentIndex]!
      const nextEntries: GroupEscapeRoomStageResponse[] = [
        ...entries,
        {
          instanceId: stage.id,
          response: null,
          clearedAt: now.toISOString(),
          outcome: 'SKIPPED',
        },
      ]
      const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
      const completed = isGroupEscapeRoomComplete(stages, nextEntries, rules)
      const updated = await prisma.escapeRoomAttempt.update({
        where: { id: attempt.id },
        data: {
          stageResponses: nextEntries as unknown as DB.Prisma.InputJsonValue,
          stageOutcomes: setStageOutcome(outcomes, {
            ...getStageOutcome(outcomes, stage.id),
            outcome: 'SKIPPED',
            at: now.toISOString(),
          }) as unknown as DB.Prisma.InputJsonValue,
          penaltySeconds: { increment: skipPenalty },
          ...(completed
            ? { status: DB.EscapeRoomStatus.COMPLETED, completedAt: now }
            : {}),
        },
      })
      if (completed) {
        const instance = await prisma.groupActivityInstance.findUnique({
          where: { groupActivityId_groupId: { groupActivityId, groupId } },
          select: { id: true },
        })
        if (instance) {
          await completeGroupEscapeRoomDecisions(
            prisma,
            instance.id,
            nextEntries
          )
        }
      }
      return updated
    },
    { isolationLevel: DB.Prisma.TransactionIsolationLevel.Serializable }
  )
}

// Clears the current stage at the configured skip penalty. Live Quiz blocks
// keep their own stage state and do not offer skipping yet.
export async function skipEscapeRoomStage(
  args: EscapeRoomActivityArgs,
  ctx: ContextWithUser
): Promise<DB.EscapeRoomAttempt> {
  const participantId = requireParticipant(ctx, 'skip escape room stages')
  const activity = await resolveParticipantEscapeRoom(
    getEscapeRoomActivityReference(args),
    participantId,
    args.groupId,
    ctx
  )
  const rules = getEscapeRoomRules(activity.config)
  const skipPenalty = getEscapeRoomSkipPenalty(rules)
  if (activity.reference.kind === 'liveQuizBlock' || skipPenalty === null) {
    throw new GraphQLError('Skipping is not enabled for this escape room', {
      extensions: { code: 'ESCAPE_ROOM_SKIP_DISABLED' },
    })
  }

  const claimKey = getEscapeRoomLifecycleClaimKey(
    activity.reference.kind,
    activity.reference.id,
    activity.groupId ?? participantId
  )
  const claimToken = randomUUID()
  const claimed = await ctx.redisExec.set(claimKey, claimToken, 'EX', 300, 'NX')
  if (claimed !== 'OK') {
    throw new GraphQLError(
      'Another escape room response is already being processed',
      { extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' } }
    )
  }

  try {
    return activity.reference.kind === 'groupActivity'
      ? await skipGroupStage(activity, rules, skipPenalty, ctx)
      : await skipIndividualStage(
          activity,
          participantId,
          rules,
          skipPenalty,
          ctx
        )
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      throw new GraphQLError('This skip conflicted with another response', {
        extensions: { code: 'ESCAPE_ROOM_CONFLICT' },
      })
    }
    throw error
  } finally {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
  }
}

interface ResetEscapeRoomAttemptArgs extends EscapeRoomActivityArgs {
  participantId?: string | null
}

async function requireResetPermission(
  reference: EscapeRoomActivityReference,
  ctx: ContextWithUser
) {
  let hasAccess: boolean
  switch (reference.kind) {
    case 'practiceQuiz':
      hasAccess = await checkAccess(
        [
          {
            practiceQuizId: reference.id,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          },
        ],
        ctx
      )
      break
    case 'microLearning':
      hasAccess = await checkAccess(
        [
          {
            microLearningId: reference.id,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          },
        ],
        ctx
      )
      break
    case 'groupActivity':
      hasAccess = await checkAccess(
        [
          {
            groupActivityId: reference.id,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          },
        ],
        ctx
      )
      break
    case 'liveQuizBlock': {
      const block = await ctx.prisma.elementBlock.findUnique({
        where: { id: reference.id },
        select: { liveQuizId: true },
      })
      if (!block) throw new GraphQLError('Block not found')
      hasAccess = await checkAccess(
        [
          {
            liveQuizId: block.liveQuizId,
            minimumPermissionLevel: DB.PermissionLevel.WRITE,
          },
        ],
        ctx
      )
      break
    }
  }
  if (!hasAccess) {
    throw new GraphQLError('You do not have write access to this activity')
  }
}

export async function resetEscapeRoomAttempt(
  { participantId, groupId, ...args }: ResetEscapeRoomAttemptArgs,
  ctx: ContextWithUser
) {
  if (
    ctx.user?.role !== DB.UserRole.USER &&
    ctx.user?.role !== DB.UserRole.ADMIN
  ) {
    throw new GraphQLError('Only lecturers can reset escape room attempts')
  }

  const activityReference = getEscapeRoomActivityReference(args)
  if (activityReference.kind === 'groupActivity') {
    if (!groupId || participantId) {
      throw new GraphQLError(
        'A group reset requires exactly one group ID and no participant ID'
      )
    }
  } else if (!participantId || groupId) {
    throw new GraphQLError(
      'An individual reset requires exactly one participant ID and no group ID'
    )
  }
  await requireResetPermission(activityReference, ctx)

  const attemptWhere: DB.Prisma.EscapeRoomAttemptWhereInput =
    activityReference.kind === 'practiceQuiz'
      ? {
          practiceQuizId: activityReference.id,
          participantId,
        }
      : activityReference.kind === 'microLearning'
        ? {
            microLearningId: activityReference.id,
            participantId,
          }
        : activityReference.kind === 'groupActivity'
          ? {
              groupActivityId: activityReference.id,
              groupId,
            }
          : {
              elementBlockId: activityReference.id,
              participantId,
            }
  const actorId =
    activityReference.kind === 'groupActivity' ? groupId! : participantId!
  const claimKey = getEscapeRoomLifecycleClaimKey(
    activityReference.kind,
    activityReference.id,
    actorId
  )
  const claimToken = randomUUID()
  const claimed = await ctx.redisExec.set(claimKey, claimToken, 'EX', 300, 'NX')
  if (claimed !== 'OK') {
    throw new GraphQLError(
      'The escape room lifecycle is currently being updated',
      { extensions: { code: 'ESCAPE_ROOM_RESPONSE_PROCESSING' } }
    )
  }

  try {
    await ctx.prisma.$transaction(async (tx) => {
      switch (activityReference.kind) {
        case 'practiceQuiz':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.questionResponse.deleteMany({
            where: {
              participantId: participantId!,
              elementInstance: {
                elementStack: { practiceQuizId: activityReference.id },
              },
            },
          })
          break
        case 'microLearning':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.questionResponse.deleteMany({
            where: {
              participantId: participantId!,
              elementInstance: {
                elementStack: { microLearningId: activityReference.id },
              },
            },
          })
          break
        case 'groupActivity':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.groupActivityInstance.deleteMany({
            where: {
              groupActivityId: activityReference.id,
              groupId: groupId!,
            },
          })
          break
        case 'liveQuizBlock':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          break
      }
    })
  } finally {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
  }

  return true
}

export { getEscapeRoomProgress } from './escapeRoomProgress.js'
export type {
  EscapeRoomAttemptProgress,
  EscapeRoomProgress,
} from './escapeRoomProgress.js'

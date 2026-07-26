import * as DB from '@klicker-uzh/prisma/client'
import {
  ESCAPE_ROOM_GRACE_SECONDS,
  ESCAPE_ROOM_SUPPORTED_ELEMENT_TYPES,
  getCurrentEscapeRoomInstance,
  getEscapeRoomLifecycleClaimKey,
  isEscapeRoomExpired,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import { checkAccess } from './sharing.js'

export { ESCAPE_ROOM_GRACE_SECONDS }

const RELEASE_ESCAPE_ROOM_CLAIM = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`

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

  const hasWriteAccess = await checkAccess(
    [
      args.practiceQuizId
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
              },
    ],
    ctx
  )
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
  if (!reference) {
    throw new GraphQLError('Exactly one activity ID must be specified')
  }
  return reference
}

interface ResolvedParticipantEscapeRoom {
  reference: EscapeRoomActivityReference
  groupId: string | null
  config: Pick<DB.EscapeRoomConfig, 'timeLimit' | 'hintPenalty'>
}

async function resolveParticipantEscapeRoom(
  reference: EscapeRoomActivityReference,
  participantId: string,
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
    await ctx.redisExec.eval(RELEASE_ESCAPE_ROOM_CLAIM, 1, claimKey, claimToken)
  }
}

interface RequestEscapeRoomHintArgs extends EscapeRoomActivityArgs {
  instanceId: number
}

export interface EscapeRoomHintResult {
  hint: string
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

export async function requestEscapeRoomHint(
  { instanceId, ...args }: RequestEscapeRoomHintArgs,
  ctx: ContextWithUser
): Promise<EscapeRoomHintResult> {
  const participantId = requireParticipant(ctx, 'request escape room hints')
  const activity = await resolveParticipantEscapeRoom(
    getEscapeRoomActivityReference(args),
    participantId,
    ctx
  )
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
    const currentStack = stacks.find(
      (stack) => !isEscapeRoomStackCleared(stack.elements)
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

  const hint = instance.options.escapeRoomHint
  if (!hint) {
    throw new GraphQLError('No hint available for this element', {
      extensions: { code: 'ESCAPE_ROOM_NO_HINT' },
    })
  }

  const hintKey = String(instanceId)
  await ctx.prisma.$executeRaw`
    UPDATE "EscapeRoomAttempt"
    SET "penaltySeconds" = "penaltySeconds" + ${activity.config.hintPenalty},
        "hintsUsed" = "hintsUsed" || ${JSON.stringify([hintKey])}::jsonb
    WHERE "id" = ${attempt.id}::uuid
      AND NOT ("hintsUsed" @> ${JSON.stringify([hintKey])}::jsonb)
  `

  return {
    hint,
    attempt: await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
      where: { id: attempt.id },
    }),
  }
}

interface ResetEscapeRoomAttemptArgs extends EscapeRoomActivityArgs {
  participantId?: string | null
  groupId?: string | null
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
  const target = (() => {
    if (activityReference.kind === 'groupActivity') {
      if (!groupId || participantId) {
        throw new GraphQLError(
          'A group reset requires exactly one group ID and no participant ID'
        )
      }
      return { reference: activityReference, groupId } as const
    }
    if (!participantId || groupId) {
      throw new GraphQLError(
        'An individual reset requires exactly one participant ID and no group ID'
      )
    }
    return { reference: activityReference, participantId } as const
  })()
  await requireResetPermission(target.reference, ctx)

  const attemptWhere: DB.Prisma.EscapeRoomAttemptWhereInput =
    target.reference.kind === 'practiceQuiz'
      ? {
          practiceQuizId: target.reference.id,
          participantId: target.participantId,
        }
      : target.reference.kind === 'microLearning'
        ? {
            microLearningId: target.reference.id,
            participantId: target.participantId,
          }
        : target.reference.kind === 'groupActivity'
          ? {
              groupActivityId: target.reference.id,
              groupId: target.groupId,
            }
          : {
              elementBlockId: target.reference.id,
              participantId: target.participantId,
            }
  const actorId = 'groupId' in target ? target.groupId : target.participantId
  if (!actorId) {
    throw new GraphQLError('The escape room reset target could not be resolved')
  }
  const claimKey = getEscapeRoomLifecycleClaimKey(
    target.reference.kind,
    target.reference.id,
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
      switch (target.reference.kind) {
        case 'practiceQuiz':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.questionResponse.deleteMany({
            where: {
              participantId: target.participantId,
              elementInstance: {
                elementStack: { practiceQuizId: target.reference.id },
              },
            },
          })
          break
        case 'microLearning':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.questionResponse.deleteMany({
            where: {
              participantId: target.participantId,
              elementInstance: {
                elementStack: { microLearningId: target.reference.id },
              },
            },
          })
          break
        case 'groupActivity':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          await tx.groupActivityInstance.deleteMany({
            where: {
              groupActivityId: target.reference.id,
              groupId: target.groupId,
            },
          })
          break
        case 'liveQuizBlock':
          await tx.escapeRoomAttempt.deleteMany({ where: attemptWhere })
          break
      }
    })
  } finally {
    await ctx.redisExec.eval(RELEASE_ESCAPE_ROOM_CLAIM, 1, claimKey, claimToken)
  }

  return true
}

export { getEscapeRoomProgress } from './escapeRoomProgress.js'
export type {
  EscapeRoomAttemptProgress,
  EscapeRoomProgress,
} from './escapeRoomProgress.js'

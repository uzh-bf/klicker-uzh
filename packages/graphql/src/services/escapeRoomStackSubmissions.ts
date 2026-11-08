import * as DB from '@klicker-uzh/prisma/client'
import type { StackResponseInput } from '@klicker-uzh/types'
import {
  getEscapeRoomLifecycleClaimKey,
  isEscapeRoomExpired,
  StackFeedbackStatus,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { GraphQLError } from 'graphql'
import { randomUUID } from 'node:crypto'
import type { Context } from '../lib/context.js'
import { hasExactEscapeRoomResponseSet } from './escapeRoomResponseValidation.js'
import {
  getRemainingSecondsUntil,
  isEscapeRoomStackCleared,
  releaseEscapeRoomLifecycleClaim,
} from './escapeRooms.js'

type ParticipantStack = DB.Prisma.ElementStackGetPayload<{
  include: {
    microLearning: { include: { escapeRoomConfig: true } }
    practiceQuiz: { include: { escapeRoomConfig: true } }
    elements: { include: { responses: true } }
  }
}>

type ActivityStack = DB.Prisma.ElementStackGetPayload<{
  include: { elements: { include: { responses: true } } }
}>

export type EscapeRoomStackSubmissionState =
  | { kind: 'skip' }
  | { kind: 'regular'; isOwner: boolean }
  | {
      kind: 'escape-room'
      isOwner: false
      attemptId: string
      stackId: number
      lockoutSeconds: number
      activityStacks: ActivityStack[]
      claimKey: string
      claimToken: string
    }

function noAttemptError() {
  return new GraphQLError(
    'No active escape room attempt found for this activity',
    { extensions: { code: 'ESCAPE_ROOM_NO_ATTEMPT' } }
  )
}

function lockoutError(attempt: DB.EscapeRoomAttempt) {
  return new GraphQLError(
    'You are locked out from submitting answers due to a recent incorrect attempt',
    {
      extensions: {
        code: 'ESCAPE_ROOM_LOCKOUT',
        lockoutUntil: attempt.lockoutUntil?.toISOString(),
        lockoutRemainingSeconds: attempt.lockoutUntil
          ? getRemainingSecondsUntil(attempt.lockoutUntil)
          : 0,
      },
    }
  )
}

async function assertActiveAttempt(
  attempt: DB.EscapeRoomAttempt | null,
  ctx: Context,
  { conditionalExpiryUpdate = false } = {}
) {
  if (!attempt || attempt.status !== DB.EscapeRoomStatus.IN_PROGRESS) {
    throw noAttemptError()
  }
  if (attempt.lockoutUntil && dayjs().isBefore(dayjs(attempt.lockoutUntil))) {
    throw lockoutError(attempt)
  }
  if (isEscapeRoomExpired(attempt)) {
    if (conditionalExpiryUpdate) {
      await ctx.prisma.escapeRoomAttempt.updateMany({
        where: {
          id: attempt.id,
          status: DB.EscapeRoomStatus.IN_PROGRESS,
        },
        data: { status: DB.EscapeRoomStatus.EXPIRED },
      })
    } else {
      await ctx.prisma.escapeRoomAttempt.update({
        where: { id: attempt.id },
        data: { status: DB.EscapeRoomStatus.EXPIRED },
      })
    }
    throw new GraphQLError('Escape room time has expired', {
      extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
    })
  }
  return attempt
}

async function loadActivityStacks(
  stack: ParticipantStack,
  participantId: string,
  ctx: Context
) {
  const where = stack.practiceQuiz
    ? { practiceQuizId: stack.practiceQuiz.id }
    : stack.microLearning
      ? { microLearningId: stack.microLearning.id }
      : null
  if (!where) {
    throw new GraphQLError('Escape room activity could not be resolved', {
      extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' },
    })
  }
  return ctx.prisma.elementStack.findMany({
    where,
    orderBy: { order: 'asc' },
    include: {
      elements: {
        include: { responses: { where: { participantId } } },
      },
    },
  })
}

function assertCurrentStack(activityStacks: ActivityStack[], stackId: number) {
  const currentStack = activityStacks.find(
    (stack) => !isEscapeRoomStackCleared(stack.elements)
  )
  if (currentStack?.id !== stackId) {
    throw new GraphQLError(
      'This escape room step has already been cleared or is no longer active',
      { extensions: { code: 'ESCAPE_ROOM_GATED' } }
    )
  }
}

export async function prepareEscapeRoomStackSubmission(
  {
    stackId,
    courseId,
    responses,
  }: {
    stackId: number
    courseId: string
    responses: StackResponseInput[]
  },
  ctx: Context
): Promise<EscapeRoomStackSubmissionState> {
  const participantId =
    ctx.user?.role === DB.UserRole.PARTICIPANT ? ctx.user.sub : null
  if (!participantId) {
    const previewStack = await ctx.prisma.elementStack.findUnique({
      where: { id: stackId },
      select: {
        practiceQuiz: {
          select: {
            ownerId: true,
            escapeRoomConfig: { select: { id: true } },
          },
        },
        microLearning: {
          select: {
            ownerId: true,
            escapeRoomConfig: { select: { id: true } },
          },
        },
      },
    })
    const isOwner = !!(
      ctx.user?.sub &&
      (ctx.user.role === DB.UserRole.USER ||
        ctx.user.role === DB.UserRole.ADMIN) &&
      (previewStack?.practiceQuiz?.ownerId === ctx.user.sub ||
        previewStack?.microLearning?.ownerId === ctx.user.sub)
    )
    if (
      !isOwner &&
      (previewStack?.practiceQuiz?.escapeRoomConfig ||
        previewStack?.microLearning?.escapeRoomConfig)
    ) {
      throw new GraphQLError(
        'Escape room activities can only be answered by an enrolled participant with an active attempt',
        { extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' } }
      )
    }
    return { kind: 'regular', isOwner }
  }

  const stack = await ctx.prisma.elementStack.findUnique({
    where: { id: stackId },
    include: {
      microLearning: { include: { escapeRoomConfig: true } },
      practiceQuiz: { include: { escapeRoomConfig: true } },
      elements: {
        include: { responses: { where: { participantId } } },
      },
    },
  })

  if (
    stack?.microLearning &&
    ((!stack.microLearning.escapeRoomConfig &&
      stack.elements.some((element) => element.responses.length > 0)) ||
      dayjs().isAfter(dayjs(stack.microLearning.scheduledEndAt)))
  ) {
    return { kind: 'skip' }
  }

  const config =
    stack?.practiceQuiz?.escapeRoomConfig ??
    stack?.microLearning?.escapeRoomConfig
  if (!stack || !config) {
    return { kind: 'regular', isOwner: false }
  }

  const activityCourseId =
    stack.practiceQuiz?.courseId ?? stack.microLearning?.courseId
  if (
    activityCourseId !== courseId ||
    !hasExactEscapeRoomResponseSet({
      instances: stack.elements,
      responses,
    })
  ) {
    throw new GraphQLError(
      'Escape room responses must exactly match the authorized stack',
      { extensions: { code: 'ESCAPE_ROOM_FORBIDDEN' } }
    )
  }

  const activityKind = stack.practiceQuiz ? 'practiceQuiz' : 'microLearning'
  const activityId = stack.practiceQuiz?.id ?? stack.microLearning!.id
  const attemptWhere: DB.Prisma.EscapeRoomAttemptWhereUniqueInput =
    stack.practiceQuiz
      ? {
          participantId_practiceQuizId: {
            participantId,
            practiceQuizId: activityId,
          },
        }
      : {
          participantId_microLearningId: {
            participantId,
            microLearningId: activityId,
          },
        }
  const attempt = await assertActiveAttempt(
    await ctx.prisma.escapeRoomAttempt.findUnique({ where: attemptWhere }),
    ctx
  )

  const initialActivityStacks = await loadActivityStacks(
    stack,
    participantId,
    ctx
  )
  for (const precedingStack of initialActivityStacks) {
    if (
      precedingStack.order < stack.order &&
      !isEscapeRoomStackCleared(precedingStack.elements)
    ) {
      throw new GraphQLError(
        'You must answer all preceding questions correctly before attempting this step',
        { extensions: { code: 'ESCAPE_ROOM_GATED' } }
      )
    }
  }

  const claimKey = getEscapeRoomLifecycleClaimKey(
    activityKind,
    activityId,
    participantId
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
    await assertActiveAttempt(
      await ctx.prisma.escapeRoomAttempt.findUnique({
        where: { id: attempt.id },
      }),
      ctx,
      { conditionalExpiryUpdate: true }
    )
    const activityStacks = await loadActivityStacks(stack, participantId, ctx)
    assertCurrentStack(activityStacks, stackId)
    return {
      kind: 'escape-room',
      isOwner: false,
      attemptId: attempt.id,
      stackId,
      lockoutSeconds: config.lockoutSeconds,
      activityStacks,
      claimKey,
      claimToken,
    }
  } catch (error) {
    await releaseEscapeRoomLifecycleClaim(ctx, claimKey, claimToken)
    throw error
  }
}

export async function finalizeEscapeRoomStackSubmission(
  state: EscapeRoomStackSubmissionState,
  stackFeedback: StackFeedbackStatus,
  ctx: Context
) {
  if (state.kind !== 'escape-room') return

  if (stackFeedback === StackFeedbackStatus.CORRECT) {
    const otherStacksCorrect = state.activityStacks
      .filter((stack) => stack.id !== state.stackId)
      .every((stack) => isEscapeRoomStackCleared(stack.elements))
    if (otherStacksCorrect) {
      await ctx.prisma.escapeRoomAttempt.update({
        where: { id: state.attemptId },
        data: {
          status: DB.EscapeRoomStatus.COMPLETED,
          completedAt: new Date(),
        },
      })
    }
    return
  }

  if (state.lockoutSeconds > 0) {
    await ctx.prisma.escapeRoomAttempt.update({
      where: { id: state.attemptId },
      data: {
        lockoutUntil: dayjs().add(state.lockoutSeconds, 'second').toDate(),
      },
    })
  }
}

export async function releaseEscapeRoomStackSubmission(
  state: EscapeRoomStackSubmissionState,
  ctx: Context
) {
  if (state.kind !== 'escape-room') return
  await releaseEscapeRoomLifecycleClaim(ctx, state.claimKey, state.claimToken)
}

import {
  applyEscapeRoomWrongAnswer,
  type EscapeRoomRules,
  getEscapeRoomBonusCredit,
  isEscapeRoomBonusStage,
} from '@klicker-uzh/grading'
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
import {
  type EscapeRoomStageOutcomeEntry,
  getEscapeRoomRules,
  getStageOutcome,
  isBonusAnswered,
  parseEscapeRoomStageOutcomes,
  setStageOutcome,
} from './escapeRoomStageOutcomes.js'

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
      rules: EscapeRoomRules
      isBonus: boolean
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

function isStackCleared(
  stack: ActivityStack,
  outcomes: EscapeRoomStageOutcomeEntry[]
) {
  return isEscapeRoomStackCleared(
    stack.elements,
    getStageOutcome(outcomes, stack.id)
  )
}

// Resolves whether the stack can be answered now: it must be the first
// uncleared stage of an in-progress attempt, or the unanswered bonus stage of
// a completed attempt whose time has not run out.
async function assertAnswerableStage(
  {
    attempt,
    activityStacks,
    rules,
    stackId,
  }: {
    attempt: DB.EscapeRoomAttempt | null
    activityStacks: ActivityStack[]
    rules: EscapeRoomRules
    stackId: number
  },
  ctx: Context,
  options?: { conditionalExpiryUpdate?: boolean }
) {
  const outcomes = parseEscapeRoomStageOutcomes(attempt?.stageOutcomes)
  const stageIndex = activityStacks.findIndex((stack) => stack.id === stackId)
  const isBonus = isEscapeRoomBonusStage(
    rules,
    stageIndex,
    activityStacks.length
  )

  if (isBonus && attempt?.status === DB.EscapeRoomStatus.COMPLETED) {
    if (isEscapeRoomExpired(attempt)) {
      throw new GraphQLError('Escape room time has expired', {
        extensions: { code: 'ESCAPE_ROOM_EXPIRED' },
      })
    }
    if (isBonusAnswered(getStageOutcome(outcomes, stackId))) {
      throw new GraphQLError('The bonus question has already been answered', {
        extensions: { code: 'ESCAPE_ROOM_GATED' },
      })
    }
  } else {
    await assertActiveAttempt(attempt, ctx, options)
  }

  const currentStack = activityStacks.find(
    (stack) => !isStackCleared(stack, outcomes)
  )
  if (currentStack?.id !== stackId) {
    const currentIndex = currentStack
      ? activityStacks.indexOf(currentStack)
      : activityStacks.length
    throw new GraphQLError(
      stageIndex > currentIndex
        ? 'You must answer all preceding questions correctly before attempting this step'
        : 'This escape room step has already been cleared or is no longer active',
      { extensions: { code: 'ESCAPE_ROOM_GATED' } }
    )
  }

  return { attempt: attempt!, isBonus }
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
  const rules = getEscapeRoomRules(config)
  const { attempt } = await assertAnswerableStage(
    {
      attempt: await ctx.prisma.escapeRoomAttempt.findUnique({
        where: attemptWhere,
      }),
      activityStacks: await loadActivityStacks(stack, participantId, ctx),
      rules,
      stackId,
    },
    ctx
  )

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
    const activityStacks = await loadActivityStacks(stack, participantId, ctx)
    const { isBonus } = await assertAnswerableStage(
      {
        attempt: await ctx.prisma.escapeRoomAttempt.findUnique({
          where: { id: attempt.id },
        }),
        activityStacks,
        rules,
        stackId,
      },
      ctx,
      { conditionalExpiryUpdate: true }
    )
    return {
      kind: 'escape-room',
      isOwner: false,
      attemptId: attempt.id,
      stackId,
      lockoutSeconds: config.lockoutSeconds,
      rules,
      isBonus,
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

  // The lifecycle claim is still held, so this read-modify-write is the only
  // writer of the attempt's stage state.
  const attempt = await ctx.prisma.escapeRoomAttempt.findUniqueOrThrow({
    where: { id: state.attemptId },
  })
  const outcomes = parseEscapeRoomStageOutcomes(attempt.stageOutcomes)
  const current = getStageOutcome(outcomes, state.stackId)
  const correct = stackFeedback === StackFeedbackStatus.CORRECT
  const now = new Date()

  if (state.isBonus) {
    await ctx.prisma.escapeRoomAttempt.update({
      where: { id: state.attemptId },
      data: {
        stageOutcomes: setStageOutcome(outcomes, {
          ...current,
          outcome: correct ? 'BONUS_CORRECT' : 'BONUS_WRONG',
          at: now.toISOString(),
          creditSeconds: getEscapeRoomBonusCredit(state.rules, correct),
        }) as unknown as DB.Prisma.InputJsonValue,
      },
    })
    return
  }

  const wrong = correct
    ? null
    : applyEscapeRoomWrongAnswer(state.rules, current.wrongAttempts)
  const nextEntry: EscapeRoomStageOutcomeEntry = correct
    ? { ...current, outcome: 'SOLVED', at: now.toISOString() }
    : {
        ...current,
        wrongAttempts: wrong!.wrongAttempts,
        ...(wrong!.revealed
          ? { outcome: 'REVEALED' as const, at: now.toISOString() }
          : {}),
      }
  const nextOutcomes = setStageOutcome(outcomes, nextEntry)
  const stageCleared = correct || wrong!.revealed
  const completed =
    stageCleared &&
    state.activityStacks.every(
      (stack, index) =>
        stack.id === state.stackId ||
        isEscapeRoomBonusStage(
          state.rules,
          index,
          state.activityStacks.length
        ) ||
        isStackCleared(stack, nextOutcomes)
    )

  await ctx.prisma.escapeRoomAttempt.update({
    where: { id: state.attemptId },
    data: {
      stageOutcomes: nextOutcomes as unknown as DB.Prisma.InputJsonValue,
      ...(wrong && wrong.penaltySeconds > 0
        ? { penaltySeconds: { increment: wrong.penaltySeconds } }
        : {}),
      ...(wrong && !wrong.revealed && state.lockoutSeconds > 0
        ? {
            lockoutUntil: dayjs(now)
              .add(state.lockoutSeconds, 'second')
              .toDate(),
          }
        : {}),
      ...(completed
        ? { status: DB.EscapeRoomStatus.COMPLETED, completedAt: now }
        : {}),
    },
  })
}

export async function releaseEscapeRoomStackSubmission(
  state: EscapeRoomStackSubmissionState,
  ctx: Context
) {
  if (state.kind !== 'escape-room') return
  await releaseEscapeRoomLifecycleClaim(ctx, state.claimKey, state.claimToken)
}

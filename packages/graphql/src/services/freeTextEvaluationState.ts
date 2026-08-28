import * as DB from '@klicker-uzh/prisma/client'
import type {
  FreeTextEvaluationResult,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import type { ContextWithUser } from '@/lib/context.js'
import {
  type FreeTextEvaluationServiceOptions,
  freeTextEvaluationError,
  getConsentDecision,
  getDisclosureVersion,
  isUniqueConstraintError,
  parseSemanticConfig,
  type SemanticInstanceAccess,
} from './freeTextEvaluationPolicy.js'

const MAX_PEER_ANSWERS = 20
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

type CycleWithAttempts = DB.FreeTextPracticeCycle & {
  attempts: DB.FreeTextAttempt[]
  elementInstance: DB.ElementInstance
}

export type FreeTextAttemptState = {
  id: string
  ordinal: number
  answer: string
  evaluationRevision: number
  evaluationStatus: DB.FreeTextEvaluationStatus
  evaluationSource: DB.FreeTextEvaluationSource | null
  retryable: boolean
  availabilityReason: string | null
  aggregateScore: number | null
  outcomeBandId: string | null
  outcomeBandLabel: string | null
  correctness: DB.FreeTextCorrectnessCategory | null
  evaluatorVersion: string | null
  modelVersion: string | null
  structuredResult: FreeTextEvaluationResult | null
  pointsAwarded: number | null
  xpAwarded: number
  createdAt: Date
  completedAt: Date | null
}

export type FreeTextPracticeState = {
  instanceId: number
  cycleId: string
  cycleOrdinal: number
  cycleStatus: DB.FreeTextPracticeCycleStatus
  attemptLimit: number
  attemptsUsed: number
  attemptsRemaining: number
  attempts: FreeTextAttemptState[]
  currentAttempt: FreeTextAttemptState | null
  canSubmitAnswer: boolean
  canRetryEvaluation: boolean
  canRevealSolution: boolean
  canPracticeAgain: boolean
  solutionAuthorized: boolean
  referenceSolution: string | null
  explanation: string | null
  peerAnswers: { value: string; count: number }[]
}

export async function createCycle({
  instance,
  practiceQuiz,
  participation,
  config,
  participantId,
  ctx,
}: SemanticInstanceAccess & {
  participantId: string
  ctx: ContextWithUser
}) {
  const [latestCycle, existingResponse] = await Promise.all([
    ctx.prisma.freeTextPracticeCycle.findFirst({
      where: { participantId, elementInstanceId: instance.id },
      orderBy: { ordinal: 'desc' },
    }),
    ctx.prisma.questionResponse.findUnique({
      where: {
        participantId_elementInstanceId: {
          participantId,
          elementInstanceId: instance.id,
        },
      },
    }),
  ])
  const pointsWindow =
    (instance.options.resetTimeDays as number | undefined) ??
    POINTS_AWARD_TIMEFRAME_DAYS
  const pointsRewardEligible =
    participation.isActive &&
    (!existingResponse?.lastAwardedAt ||
      dayjs(existingResponse.lastAwardedAt).isBefore(
        dayjs().subtract(pointsWindow, 'days')
      ))
  const xpRewardEligible =
    !existingResponse?.lastXpAwardedAt ||
    dayjs(existingResponse.lastXpAwardedAt).isBefore(
      dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
    )

  return await ctx.prisma.freeTextPracticeCycle.create({
    data: {
      ordinal: (latestCycle?.ordinal ?? 0) + 1,
      attemptLimit: config.attempt_limit,
      pointsRewardEligible,
      xpRewardEligible,
      participantId,
      participationId: participation.id,
      elementInstanceId: instance.id,
      practiceQuizId: practiceQuiz.id,
    },
  })
}

export async function getActiveOrCreateCycle(
  semanticInstance: SemanticInstanceAccess,
  ctx: ContextWithUser
) {
  const latest = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: {
      participantId: ctx.user.sub,
      elementInstanceId: semanticInstance.instance.id,
    },
    orderBy: { ordinal: 'desc' },
  })
  if (latest?.status === DB.FreeTextPracticeCycleStatus.ACTIVE) return latest
  if (latest) {
    throw freeTextEvaluationError(
      'Start a new free-text practice cycle before submitting',
      'FREE_TEXT_EVALUATION_INVALID_STATE'
    )
  }
  try {
    return await createCycle({
      ...semanticInstance,
      participantId: ctx.user.sub,
      ctx,
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const racedCycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
      where: {
        participantId: ctx.user.sub,
        elementInstanceId: semanticInstance.instance.id,
        status: DB.FreeTextPracticeCycleStatus.ACTIVE,
      },
      orderBy: { ordinal: 'desc' },
    })
    if (racedCycle) return racedCycle
    throw error
  }
}

function isSolutionAuthorized(
  status: DB.FreeTextPracticeCycleStatus,
  config: SemanticFreeTextConfig
) {
  return (
    status === DB.FreeTextPracticeCycleStatus.CORRECT ||
    status === DB.FreeTextPracticeCycleStatus.SOLUTION_REVEALED ||
    (status === DB.FreeTextPracticeCycleStatus.EXHAUSTED &&
      config.solution_reveal_enabled)
  )
}

function toAttemptState(
  attempt: DB.FreeTextAttempt,
  cycle: DB.FreeTextPracticeCycle,
  solutionAuthorized: boolean
): FreeTextAttemptState {
  return {
    id: attempt.id,
    ordinal: attempt.ordinal,
    answer: attempt.answer,
    evaluationRevision: attempt.evaluationRevision,
    evaluationStatus: attempt.evaluationStatus,
    evaluationSource: attempt.evaluationSource,
    retryable: attempt.retryable,
    availabilityReason: attempt.availabilityReason,
    aggregateScore: attempt.aggregateScore,
    outcomeBandId: attempt.outcomeBandId,
    outcomeBandLabel: attempt.outcomeBandLabel,
    correctness: attempt.correctness,
    evaluatorVersion: solutionAuthorized ? attempt.evaluatorVersion : null,
    modelVersion: solutionAuthorized ? attempt.modelVersion : null,
    structuredResult: solutionAuthorized
      ? (attempt.structuredResult as FreeTextEvaluationResult | null)
      : null,
    pointsAwarded: cycle.pointsAwarded,
    xpAwarded: cycle.xpAwarded,
    createdAt: attempt.createdAt,
    completedAt: attempt.completedAt,
  }
}

async function stateFromCycle(
  cycle: CycleWithAttempts,
  config: SemanticFreeTextConfig,
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
): Promise<FreeTextPracticeState> {
  const attempts = [...cycle.attempts].sort((a, b) => a.ordinal - b.ordinal)
  const attemptsUsed = attempts.filter(
    (attempt) =>
      attempt.evaluationStatus === DB.FreeTextEvaluationStatus.EVALUATED
  ).length
  const current = attempts.at(-1) ?? null
  const solutionAuthorized = isSolutionAuthorized(cycle.status, config)
  const consent = await getConsentDecision(
    cycle.participantId,
    getDisclosureVersion(options),
    ctx
  )
  const canRetryEvaluation =
    cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE &&
    current?.evaluationStatus === DB.FreeTextEvaluationStatus.UNAVAILABLE &&
    current.retryable &&
    consent?.decision === DB.SemanticEvaluationConsentDecision.ACCEPTED
  const peerAnswers =
    solutionAuthorized && 'responses' in cycle.elementInstance.results
      ? Object.values(cycle.elementInstance.results.responses)
          .map(({ value, count }) => ({ value, count }))
          .sort((left, right) => {
            return (
              right.count - left.count || left.value.localeCompare(right.value)
            )
          })
          .slice(0, MAX_PEER_ANSWERS)
      : []

  return {
    instanceId: cycle.elementInstanceId,
    cycleId: cycle.id,
    cycleOrdinal: cycle.ordinal,
    cycleStatus: cycle.status,
    attemptLimit: cycle.attemptLimit,
    attemptsUsed,
    attemptsRemaining: Math.max(0, cycle.attemptLimit - attemptsUsed),
    attempts: attempts.map((attempt) =>
      toAttemptState(attempt, cycle, solutionAuthorized)
    ),
    currentAttempt: current
      ? toAttemptState(current, cycle, solutionAuthorized)
      : null,
    canSubmitAnswer:
      cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE &&
      attemptsUsed < cycle.attemptLimit &&
      (!current ||
        current.evaluationStatus === DB.FreeTextEvaluationStatus.EVALUATED),
    canRetryEvaluation,
    canRevealSolution:
      (cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE ||
        cycle.status === DB.FreeTextPracticeCycleStatus.UNAVAILABLE) &&
      config.solution_reveal_enabled &&
      current !== null &&
      current.evaluationStatus !== DB.FreeTextEvaluationStatus.PENDING,
    canPracticeAgain: cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE,
    solutionAuthorized,
    referenceSolution: solutionAuthorized
      ? (config.reference_solution ?? null)
      : null,
    explanation: solutionAuthorized
      ? cycle.elementInstance.elementData.explanation
      : null,
    peerAnswers,
  }
}

export async function loadCycleState(
  cycleId: string,
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  const cycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: { id: cycleId, participantId: ctx.user.sub },
    include: {
      attempts: true,
      elementInstance: true,
    },
  })
  if (!cycle) {
    throw freeTextEvaluationError(
      'Free-text practice cycle not found',
      'NOT_FOUND'
    )
  }
  return await stateFromCycle(
    cycle,
    parseSemanticConfig(cycle.elementInstance),
    ctx,
    options
  )
}

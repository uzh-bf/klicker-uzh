import * as DB from '@klicker-uzh/prisma/client'
import type {
  FreeTextEvaluationAvailabilityReason,
  FreeTextEvaluationFeedback,
  FreeTextEvaluationResult,
  FreeTextRubricAssessment,
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
  ownerHasCatalyst,
  parseSemanticConfig,
  type SemanticInstanceAccess,
} from './freeTextEvaluationPolicy.js'
import { loadFreeTextPeerAnswers } from './freeTextPeerAnswers.js'
import { isSemanticEvaluatorConfigured } from './semanticFreeTextEvaluator.js'

const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

type CycleWithAttempts = DB.FreeTextPracticeCycle & {
  attempts: Array<
    DB.FreeTextAttempt & {
      questionResponseDetail: DB.QuestionResponseDetail | null
    }
  >
  elementInstance: DB.ElementInstance
  practiceQuiz: DB.PracticeQuiz & { owner: DB.User }
}

export type FreeTextAttemptState = {
  id: string
  ordinal: number
  answer: string
  evaluationRevision: number
  evaluationStatus: DB.FreeTextEvaluationStatus
  evaluationSource: DB.FreeTextEvaluationSource | null
  retryable: boolean
  availabilityReason: FreeTextEvaluationAvailabilityReason | null
  aggregateScore: number | null
  outcomeBandId: string | null
  outcomeBandLabel: string | null
  correctness: DB.FreeTextCorrectnessCategory | null
  evaluatorVersion: string | null
  modelVersion: string | null
  structuredResult: FreeTextEvaluationFeedback | null
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
  stateVersion: number
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

function getCriterionStatus(
  config: SemanticFreeTextConfig,
  assessment: FreeTextRubricAssessment
): DB.FreeTextCorrectnessCategory {
  const rubric = config.rubric_schema.rubrics.find(
    (candidate) => candidate.id === assessment.rubric_id
  )
  const selectedLevel = rubric?.achievement_levels.find(
    (level) => level.name === assessment.proposed_level
  )
  if (!rubric || !selectedLevel) {
    throw new Error('Validated rubric assessment no longer matches its schema')
  }

  const scores = rubric.achievement_levels.map(
    (level) => level.normalized_score
  )
  const highestScore = Math.max(...scores)
  const lowestScore = Math.min(...scores)
  if (selectedLevel.normalized_score === highestScore) {
    return DB.FreeTextCorrectnessCategory.CORRECT
  }
  if (selectedLevel.normalized_score === lowestScore) {
    return DB.FreeTextCorrectnessCategory.INCORRECT
  }
  return DB.FreeTextCorrectnessCategory.PARTIAL
}

function toAttemptState(
  attempt: CycleWithAttempts['attempts'][number],
  solutionAuthorized: boolean,
  config: SemanticFreeTextConfig
): FreeTextAttemptState {
  const result = attempt.structuredResult as FreeTextEvaluationResult | null
  return {
    id: attempt.id,
    ordinal: attempt.ordinal,
    answer: attempt.answer,
    evaluationRevision: attempt.evaluationRevision,
    evaluationStatus: attempt.evaluationStatus,
    evaluationSource: attempt.evaluationSource,
    retryable: attempt.retryable,
    availabilityReason:
      attempt.availabilityReason as FreeTextEvaluationAvailabilityReason | null,
    aggregateScore: solutionAuthorized ? attempt.aggregateScore : null,
    outcomeBandId: solutionAuthorized ? attempt.outcomeBandId : null,
    outcomeBandLabel: attempt.outcomeBandLabel,
    correctness: attempt.correctness,
    evaluatorVersion: solutionAuthorized ? attempt.evaluatorVersion : null,
    modelVersion: solutionAuthorized ? attempt.modelVersion : null,
    structuredResult:
      solutionAuthorized && result
        ? {
            rubricAssessments: result.rubric_assessments.map((assessment) => ({
              rubricId: assessment.rubric_id,
              rubricName: assessment.rubric_name,
              proposedLevel: assessment.proposed_level,
              normalizedScore: assessment.normalized_score,
              criterionStatus: getCriterionStatus(config, assessment),
              rationale: assessment.rationale,
            })),
            feedbackProposals: (result.feedback_proposals ?? []).map(
              (proposal) => ({
                rubricId: proposal.rubric_id,
                rubricName: proposal.rubric_name,
                feedback: proposal.feedback,
              })
            ),
          }
        : null,
    pointsAwarded: attempt.questionResponseDetail?.pointsAwarded ?? null,
    xpAwarded: attempt.questionResponseDetail?.xpAwarded ?? 0,
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
  const attemptsUsed = attempts.length
  const current = attempts.at(-1) ?? null
  const compatibilityExactMatch =
    current?.availabilityReason === 'CLIENT_SUBMISSION_ID_UNAVAILABLE' &&
    current.evaluationSource === DB.FreeTextEvaluationSource.EXACT_MATCH &&
    cycle.status === DB.FreeTextPracticeCycleStatus.CORRECT
  const solutionAuthorized =
    !compatibilityExactMatch && isSolutionAuthorized(cycle.status, config)
  const consent = await getConsentDecision(
    cycle.participantId,
    getDisclosureVersion(options),
    ctx
  )
  const canRetryEvaluation =
    cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE &&
    current?.evaluationStatus === DB.FreeTextEvaluationStatus.UNAVAILABLE &&
    current.retryable &&
    consent?.decision === DB.SemanticEvaluationConsentDecision.ACCEPTED &&
    cycle.practiceQuiz.status === DB.PublicationStatus.PUBLISHED &&
    !cycle.practiceQuiz.isDeleted &&
    ownerHasCatalyst(cycle.practiceQuiz) &&
    isSemanticEvaluatorConfigured()
  const peerAnswers = await loadFreeTextPeerAnswers({
    elementInstance: cycle.elementInstance,
    participantId: cycle.participantId,
    solutionAuthorized,
    ctx,
  })

  return {
    instanceId: cycle.elementInstanceId,
    cycleId: cycle.id,
    cycleOrdinal: cycle.ordinal,
    cycleStatus: cycle.status,
    stateVersion: cycle.stateVersion,
    attemptLimit: cycle.attemptLimit,
    attemptsUsed,
    attemptsRemaining: Math.max(0, cycle.attemptLimit - attemptsUsed),
    attempts: attempts.map((attempt) =>
      toAttemptState(attempt, solutionAuthorized, config)
    ),
    currentAttempt: current
      ? toAttemptState(current, solutionAuthorized, config)
      : null,
    canSubmitAnswer:
      cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE &&
      attemptsUsed < cycle.attemptLimit &&
      (!current ||
        current.evaluationStatus !== DB.FreeTextEvaluationStatus.PENDING),
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
      attempts: { include: { questionResponseDetail: true } },
      elementInstance: true,
      practiceQuiz: { include: { owner: true } },
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

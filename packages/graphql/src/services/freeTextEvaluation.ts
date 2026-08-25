import { createHash } from 'node:crypto'
import {
  computeFreeTextAggregate,
  getDefaultFreeTextOutcomeBands,
  mapFreeTextOutcome,
  matchesAcceptedExactAnswer,
  validateSemanticFreeTextConfig,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  ElementOptionsFreeText,
  EvaluateFreeTextResponseV1,
  FreeTextEvaluationResult,
  SemanticFreeTextConfig,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import type { ContextWithUser } from '@/lib/context.js'

const DEFAULT_DISCLOSURE_VERSION = '2026-08-18'
// Absolute ceiling for participant free-text answers on semantic elements,
// independent of the lecturer-configured maxLength.
const MAX_SEMANTIC_ANSWER_LENGTH = 10_000
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type SemanticInstance = DB.ElementInstance & {
  elementStack:
    | (DB.ElementStack & {
        practiceQuiz: (DB.PracticeQuiz & { owner: DB.User }) | null
      })
    | null
}

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

export type FreeTextEvaluationServiceOptions = {
  disclosureVersion?: string
}

export type SemanticFreeTextCapabilityData = {
  entitled: boolean
  availability: 'AVAILABLE' | 'DEGRADED' | 'UNAVAILABLE'
  reason: string | null
  retryable: boolean
  disclosureVersion: string
  provider: string
}

function assertParticipant(ctx: ContextWithUser) {
  if (ctx.user.role !== DB.UserRole.PARTICIPANT) {
    throw new Error('Participant authentication is required')
  }
}

function getDisclosureVersion(options?: FreeTextEvaluationServiceOptions) {
  return (
    options?.disclosureVersion ||
    process.env.SEMANTIC_EVALUATION_DISCLOSURE_VERSION ||
    DEFAULT_DISCLOSURE_VERSION
  )
}

export function getSemanticEvaluationDisclosureVersion() {
  return getDisclosureVersion()
}

export function getSemanticFreeTextCapability(
  ctx: ContextWithUser
): SemanticFreeTextCapabilityData {
  const entitled = ctx.user.catalystInstitutional || ctx.user.catalystIndividual
  const available = !!process.env.CATALYST_FORMATIVE_EVALUATOR_URL
  return {
    entitled,
    availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
    reason: available ? null : 'EVALUATOR_NOT_CONFIGURED',
    retryable: !available,
    disclosureVersion: getSemanticEvaluationDisclosureVersion(),
    provider: 'CATALYST',
  }
}

function parseSemanticConfig(instance: DB.ElementInstance) {
  if (instance.elementData.type !== DB.ElementType.FREE_TEXT) {
    throw new Error('Semantic evaluation is only available for free text')
  }

  const config = instance.elementData.options.semanticEvaluation
  if (!config || validateSemanticFreeTextConfig(config).length > 0) {
    throw new Error('Semantic free-text evaluation is not configured')
  }

  return config as SemanticFreeTextConfig
}

export function getSemanticFreeTextConfig(instance: DB.ElementInstance) {
  return parseSemanticConfig(instance)
}

function semanticConfigHash(config: SemanticFreeTextConfig) {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex')
}

export function getSemanticFreeTextConfigHash(config: SemanticFreeTextConfig) {
  return semanticConfigHash(config)
}

async function getSemanticInstance(
  instanceId: number,
  ctx: ContextWithUser
): Promise<{
  instance: SemanticInstance
  practiceQuiz: DB.PracticeQuiz & { owner: DB.User }
  participation: DB.Participation
  config: SemanticFreeTextConfig
}> {
  assertParticipant(ctx)
  const instance = await ctx.prisma.elementInstance.findUnique({
    where: { id: instanceId },
    include: {
      elementStack: {
        include: {
          practiceQuiz: { include: { owner: true } },
        },
      },
    },
  })
  const practiceQuiz = instance?.elementStack?.practiceQuiz
  if (
    !instance ||
    instance.type !== DB.ElementInstanceType.PRACTICE_QUIZ ||
    !practiceQuiz ||
    practiceQuiz.status !== DB.PublicationStatus.PUBLISHED
  ) {
    throw new Error('Published practice quiz instance not found')
  }

  const participation = await ctx.prisma.participation.findUnique({
    where: {
      courseId_participantId: {
        courseId: practiceQuiz.courseId,
        participantId: ctx.user.sub,
      },
    },
  })
  if (!participation?.isActive) {
    throw new Error('Participant does not have active access to this course')
  }

  return {
    instance,
    practiceQuiz,
    participation,
    config: parseSemanticConfig(instance),
  }
}

function ownerHasCatalyst(practiceQuiz: DB.PracticeQuiz & { owner: DB.User }) {
  return (
    practiceQuiz.owner.catalystInstitutional ||
    practiceQuiz.owner.catalystIndividual
  )
}

async function getConsentDecision(
  participantId: string,
  disclosureVersion: string,
  ctx: ContextWithUser
) {
  const latestEvent = await ctx.prisma.freeTextConsentEvent.findFirst({
    where: { participantId, disclosureVersion },
    orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
  })
  return latestEvent
}

function evaluationAvailabilityReason({
  ownerEntitled,
  consent,
}: {
  ownerEntitled: boolean
  consent: DB.SemanticEvaluationConsentDecision | null
}) {
  if (!ownerEntitled) return 'LECTURER_ENTITLEMENT_UNAVAILABLE'
  if (!process.env.CATALYST_FORMATIVE_EVALUATOR_URL) {
    return 'EVALUATOR_UNAVAILABLE'
  }
  if (consent === DB.SemanticEvaluationConsentDecision.DECLINED) {
    return 'CONSENT_DECLINED'
  }
  if (consent !== DB.SemanticEvaluationConsentDecision.ACCEPTED) {
    return 'CONSENT_REQUIRED'
  }
  return null
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  )
}

async function createCycle({
  instance,
  practiceQuiz,
  participation,
  config,
  participantId,
  ctx,
}: {
  instance: DB.ElementInstance
  practiceQuiz: DB.PracticeQuiz
  participation: DB.Participation
  config: SemanticFreeTextConfig
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

async function getActiveOrCreateCycle(
  semanticInstance: Awaited<ReturnType<typeof getSemanticInstance>>,
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
    throw new Error('Start a new free-text practice cycle before submitting')
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
      ? Object.values(cycle.elementInstance.results.responses).map(
          ({ value, count }) => ({ value, count })
        )
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
      cycle.status === DB.FreeTextPracticeCycleStatus.ACTIVE &&
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

async function loadCycleState(
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
  if (!cycle) throw new Error('Free-text practice cycle not found')
  return await stateFromCycle(
    cycle,
    parseSemanticConfig(cycle.elementInstance),
    ctx,
    options
  )
}

async function scheduleAttempt(
  attempt: DB.FreeTextAttempt,
  ctx: ContextWithUser
) {
  const run = await ctx.tasks.evaluateFreeTextAttempt.runNoWait({
    attemptId: attempt.id,
    evaluationRevision: attempt.evaluationRevision,
  })
  const workflowRunId = await run.getWorkflowRunId()
  await ctx.prisma.freeTextAttempt.updateMany({
    where: {
      id: attempt.id,
      evaluationRevision: attempt.evaluationRevision,
      workflowRunId: null,
    },
    data: { workflowRunId },
  })
}

async function schedulePendingAttempt(
  attempt: DB.FreeTextAttempt,
  ctx: ContextWithUser
) {
  try {
    await scheduleAttempt(attempt, ctx)
  } catch (error) {
    console.error(
      `Failed to schedule pending free-text attempt ${attempt.id}:`,
      error
    )
    await ctx.prisma.freeTextAttempt.updateMany({
      where: {
        id: attempt.id,
        evaluationRevision: attempt.evaluationRevision,
        evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      },
      data: {
        evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
        retryable: true,
        availabilityReason: 'SCHEDULING_FAILED',
        completedAt: new Date(),
        workflowRunId: null,
      },
    })
  }
}

export async function createFreeTextAttempt(
  {
    instanceId,
    answer,
    answerTime,
    clientSubmissionId,
  }: {
    instanceId: number
    answer: string
    answerTime: number
    clientSubmissionId: string
  },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  if (!answer.trim()) throw new Error('Answer must not be empty')
  if (!Number.isFinite(answerTime) || answerTime < 0) {
    throw new Error('Answer time must be a non-negative finite number')
  }
  if (!UUID_PATTERN.test(clientSubmissionId)) {
    throw new Error('Client submission ID must be a UUID')
  }
  const semanticInstance = await getSemanticInstance(instanceId, ctx)
  const freeTextOptions = semanticInstance.instance.elementData
    .options as ElementOptionsFreeText
  const maxLength = freeTextOptions.restrictions?.maxLength
  if (typeof maxLength === 'number' && answer.length > maxLength) {
    throw new Error('Answer exceeds the configured maximum length')
  }
  if (answer.length > MAX_SEMANTIC_ANSWER_LENGTH) {
    throw new Error('Answer exceeds the maximum allowed length')
  }
  const cycle = await getActiveOrCreateCycle(semanticInstance, ctx)
  const duplicate = await ctx.prisma.freeTextAttempt.findUnique({
    where: {
      cycleId_clientSubmissionId: { cycleId: cycle.id, clientSubmissionId },
    },
  })
  if (duplicate) {
    if (
      duplicate.workflowRunId === null &&
      (duplicate.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING ||
        (duplicate.evaluationStatus === DB.FreeTextEvaluationStatus.EVALUATED &&
          duplicate.questionResponseDetailId === null))
    ) {
      if (duplicate.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING) {
        await schedulePendingAttempt(duplicate, ctx)
      } else {
        await scheduleAttempt(duplicate, ctx)
      }
    }
    return await loadCycleState(cycle.id, ctx, options)
  }

  const currentAttempt = await ctx.prisma.freeTextAttempt.findFirst({
    where: { cycleId: cycle.id },
    orderBy: { ordinal: 'desc' },
  })
  if (
    currentAttempt &&
    currentAttempt.evaluationStatus !== DB.FreeTextEvaluationStatus.EVALUATED
  ) {
    throw new Error('Retry the current free-text evaluation before answering')
  }

  const evaluatedCount = await ctx.prisma.freeTextAttempt.count({
    where: {
      cycleId: cycle.id,
      evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
    },
  })
  if (evaluatedCount >= cycle.attemptLimit) {
    throw new Error('Free-text attempt limit reached')
  }
  const submissionCount = await ctx.prisma.freeTextAttempt.count({
    where: { cycleId: cycle.id },
  })
  const config = semanticInstance.config
  const rubricHash = semanticConfigHash(config)
  const exactMatch = matchesAcceptedExactAnswer({
    response: answer,
    acceptedExactAnswers: config.accepted_exact_answers,
  })
  const disclosureVersion = getDisclosureVersion(options)
  const consent = await getConsentDecision(ctx.user.sub, disclosureVersion, ctx)
  const unavailableReason = exactMatch
    ? null
    : evaluationAvailabilityReason({
        ownerEntitled: ownerHasCatalyst(semanticInstance.practiceQuiz),
        consent: consent?.decision ?? null,
      })
  const bands = config.outcome_bands ?? getDefaultFreeTextOutcomeBands()
  const exactBand = exactMatch
    ? mapFreeTextOutcome({ score: 100, outcomeBands: bands })
    : null

  let attempt: DB.FreeTextAttempt
  try {
    attempt = await ctx.prisma.freeTextAttempt.create({
      data: {
        cycleId: cycle.id,
        ordinal: submissionCount + 1,
        clientSubmissionId,
        answer,
        answerTime,
        rubricSchemaVersion: config.rubric_schema.schema_version,
        rubricSchemaHash: rubricHash,
        evaluationStatus: exactMatch
          ? DB.FreeTextEvaluationStatus.EVALUATED
          : unavailableReason
            ? DB.FreeTextEvaluationStatus.UNAVAILABLE
            : DB.FreeTextEvaluationStatus.PENDING,
        evaluationSource: exactMatch
          ? DB.FreeTextEvaluationSource.EXACT_MATCH
          : null,
        retryable: unavailableReason !== null,
        availabilityReason: unavailableReason,
        completedAt: exactMatch || unavailableReason ? new Date() : null,
        aggregateScore: exactMatch ? 100 : null,
        outcomeBandId: exactBand?.id,
        outcomeBandLabel: exactBand?.label,
        correctness: exactMatch ? DB.FreeTextCorrectnessCategory.CORRECT : null,
      },
    })
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error
    const racedDuplicate = await ctx.prisma.freeTextAttempt.findUnique({
      where: {
        cycleId_clientSubmissionId: {
          cycleId: cycle.id,
          clientSubmissionId,
        },
      },
    })
    if (racedDuplicate) {
      return await loadCycleState(cycle.id, ctx, options)
    }
    throw error
  }

  if (exactMatch) {
    await ctx.prisma.freeTextPracticeCycle.update({
      where: { id: cycle.id },
      data: {
        status: DB.FreeTextPracticeCycleStatus.CORRECT,
        endedAt: new Date(),
        bestScore: 100,
      },
    })
    try {
      await scheduleAttempt(attempt, ctx)
    } catch (error) {
      // The attempt is already terminal-EVALUATED and rewards are applied by
      // the scheduled handler; scheduling here is bookkeeping only. A failed
      // schedule leaves the persisted success intact — the duplicate-submission
      // heal path re-schedules on the next identical submit.
      console.error(
        `Failed to schedule exact-match free-text attempt ${attempt.id}:`,
        error
      )
    }
  } else if (!unavailableReason) {
    await schedulePendingAttempt(attempt, ctx)
  }

  return await loadCycleState(cycle.id, ctx, options)
}

export async function getFreeTextPracticeState(
  { instanceId }: { instanceId: number },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  await getSemanticInstance(instanceId, ctx)
  const cycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: { participantId: ctx.user.sub, elementInstanceId: instanceId },
    orderBy: { ordinal: 'desc' },
  })
  return cycle ? await loadCycleState(cycle.id, ctx, options) : null
}

export async function retryFreeTextEvaluation(
  { attemptId }: { attemptId: string },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertParticipant(ctx)
  const attempt = await ctx.prisma.freeTextAttempt.findFirst({
    where: { id: attemptId, cycle: { participantId: ctx.user.sub } },
    include: {
      cycle: {
        include: {
          elementInstance: true,
          practiceQuiz: { include: { owner: true } },
        },
      },
    },
  })
  if (
    !attempt ||
    attempt.cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE ||
    attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.UNAVAILABLE ||
    !attempt.retryable
  ) {
    throw new Error('Free-text evaluation cannot be retried')
  }
  const consent = await getConsentDecision(
    ctx.user.sub,
    getDisclosureVersion(options),
    ctx
  )
  const unavailableReason = evaluationAvailabilityReason({
    ownerEntitled: ownerHasCatalyst(attempt.cycle.practiceQuiz),
    consent: consent?.decision ?? null,
  })
  if (unavailableReason) {
    throw new Error(unavailableReason)
  }

  const updated = await ctx.prisma.freeTextAttempt.update({
    where: { id: attempt.id },
    data: {
      evaluationRevision: { increment: 1 },
      evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      evaluationSource: null,
      retryable: false,
      availabilityReason: null,
      completedAt: null,
      workflowRunId: null,
    },
  })
  await schedulePendingAttempt(updated, ctx)
  return await loadCycleState(attempt.cycleId, ctx, options)
}

export async function revealFreeTextSolution(
  { cycleId }: { cycleId: string },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  assertParticipant(ctx)
  const cycle = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: { id: cycleId, participantId: ctx.user.sub },
    include: {
      elementInstance: true,
      attempts: { orderBy: { ordinal: 'desc' }, take: 1 },
    },
  })
  if (!cycle) throw new Error('Free-text practice cycle not found')
  const config = parseSemanticConfig(cycle.elementInstance)
  const currentAttempt = cycle.attempts[0]
  if (
    cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE ||
    !config.solution_reveal_enabled ||
    !currentAttempt ||
    currentAttempt.evaluationStatus === DB.FreeTextEvaluationStatus.PENDING
  ) {
    throw new Error('Free-text solution cannot be revealed')
  }
  await ctx.prisma.freeTextPracticeCycle.update({
    where: { id: cycle.id },
    data: {
      status: DB.FreeTextPracticeCycleStatus.SOLUTION_REVEALED,
      solutionRevealedAt: new Date(),
      endedAt: new Date(),
    },
  })
  return await loadCycleState(cycle.id, ctx, options)
}

export async function startFreeTextPracticeCycle(
  { instanceId }: { instanceId: number },
  ctx: ContextWithUser,
  options?: FreeTextEvaluationServiceOptions
) {
  const semanticInstance = await getSemanticInstance(instanceId, ctx)
  const active = await ctx.prisma.freeTextPracticeCycle.findFirst({
    where: {
      participantId: ctx.user.sub,
      elementInstanceId: instanceId,
      status: DB.FreeTextPracticeCycleStatus.ACTIVE,
    },
  })
  if (active)
    throw new Error('An active free-text practice cycle already exists')
  const cycle = await createCycle({
    ...semanticInstance,
    participantId: ctx.user.sub,
    ctx,
  })
  return await loadCycleState(cycle.id, ctx, options)
}

export async function decideSemanticEvaluationConsent(
  {
    disclosureVersion,
    accepted,
  }: { disclosureVersion: string; accepted: boolean },
  ctx: ContextWithUser
) {
  assertParticipant(ctx)
  if (!disclosureVersion.trim()) {
    throw new Error('Disclosure version is required')
  }
  return await ctx.prisma.freeTextConsentEvent.create({
    data: {
      participantId: ctx.user.sub,
      disclosureVersion,
      decision: accepted
        ? DB.SemanticEvaluationConsentDecision.ACCEPTED
        : DB.SemanticEvaluationConsentDecision.DECLINED,
    },
  })
}

export async function completeFreeTextAttemptEvaluation(
  {
    attemptId,
    evaluationRevision,
    evaluation,
  }: {
    attemptId: string
    evaluationRevision: number
    evaluation: EvaluateFreeTextResponseV1
  },
  prisma: DB.PrismaClient
) {
  return await prisma.$transaction(async (tx) => {
    const attempt = await tx.freeTextAttempt.findUnique({
      where: { id: attemptId },
      include: {
        cycle: { include: { elementInstance: true } },
      },
    })
    if (
      !attempt ||
      attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.PENDING ||
      attempt.evaluationRevision !== evaluationRevision ||
      attempt.cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE
    ) {
      return false
    }

    const config = parseSemanticConfig(attempt.cycle.elementInstance)
    const aggregateScore = computeFreeTextAggregate({
      rubricSchema: config.rubric_schema,
      assessments: evaluation.rubric_assessments,
    })
    if (aggregateScore === null) {
      throw new Error('Validated evaluator result could not be aggregated')
    }
    const outcomeBand = mapFreeTextOutcome({
      score: aggregateScore,
      outcomeBands: config.outcome_bands ?? getDefaultFreeTextOutcomeBands(),
    })
    if (!outcomeBand) {
      throw new Error('Validated evaluator result could not be mapped')
    }

    const evaluatedCount = await tx.freeTextAttempt.count({
      where: {
        cycleId: attempt.cycleId,
        evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
      },
    })
    const isCorrect = outcomeBand.category === 'CORRECT'
    const isExhausted =
      !isCorrect && evaluatedCount + 1 >= attempt.cycle.attemptLimit
    const completedAt = new Date()
    await tx.freeTextAttempt.update({
      where: { id: attempt.id },
      data: {
        evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
        evaluationSource: DB.FreeTextEvaluationSource.SEMANTIC,
        retryable: false,
        availabilityReason: null,
        completedAt,
        evaluatorVersion: evaluation.evaluator_version,
        modelVersion: evaluation.model_version,
        aggregateScore,
        outcomeBandId: outcomeBand.id,
        outcomeBandLabel: outcomeBand.label,
        correctness: outcomeBand.category,
        structuredResult: {
          rubric_assessments: evaluation.rubric_assessments,
          ...(evaluation.feedback_proposals
            ? { feedback_proposals: evaluation.feedback_proposals }
            : {}),
        },
      },
    })
    await tx.freeTextPracticeCycle.update({
      where: { id: attempt.cycleId },
      data: {
        bestScore: Math.max(attempt.cycle.bestScore, aggregateScore),
        status: isCorrect
          ? DB.FreeTextPracticeCycleStatus.CORRECT
          : isExhausted
            ? DB.FreeTextPracticeCycleStatus.EXHAUSTED
            : DB.FreeTextPracticeCycleStatus.ACTIVE,
        endedAt: isCorrect || isExhausted ? completedAt : null,
        solutionRevealedAt:
          isExhausted && config.solution_reveal_enabled ? completedAt : null,
      },
    })
    return true
  })
}

export async function markFreeTextAttemptUnavailable(
  {
    attemptId,
    evaluationRevision,
    reason,
    retryable,
  }: {
    attemptId: string
    evaluationRevision: number
    reason: string
    retryable: boolean
  },
  prisma: DB.PrismaClient
) {
  const result = await prisma.freeTextAttempt.updateMany({
    where: {
      id: attemptId,
      evaluationRevision,
      evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      cycle: { status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    },
    data: {
      evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
      evaluationSource: null,
      availabilityReason: reason,
      retryable,
      completedAt: new Date(),
    },
  })
  return result.count === 1
}

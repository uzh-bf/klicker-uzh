import {
  computeFreeTextAggregate,
  getDefaultFreeTextOutcomeBands,
  mapFreeTextOutcome,
  matchesAcceptedExactAnswer,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type {
  EvaluateFreeTextResponseV1,
  FreeTextEvaluationAvailabilityReason,
} from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import {
  getSemanticFreeTextConfigHash,
  parseSemanticConfig,
} from './freeTextEvaluationPolicy.js'

type CompleteFreeTextAttemptEvaluationArgs = {
  attemptId: string
  evaluationRevision: number
  evaluation: EvaluateFreeTextResponseV1
}

export async function completeFreeTextAttemptEvaluationInTransaction(
  {
    attemptId,
    evaluationRevision,
    evaluation,
  }: CompleteFreeTextAttemptEvaluationArgs,
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT cycle."id"
    FROM "FreeTextPracticeCycle" AS cycle
    INNER JOIN "FreeTextAttempt" AS attempt
      ON attempt."cycleId" = cycle."id"
    WHERE attempt."id" = ${attemptId}
    FOR UPDATE OF cycle
  `
  const attempt = await prisma.freeTextAttempt.findUnique({
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
    outcomeBands:
      config.outcome_bands ??
      getDefaultFreeTextOutcomeBands(config.question_language),
  })
  if (!outcomeBand) {
    throw new Error('Validated evaluator result could not be mapped')
  }

  const evaluatedCount = await prisma.freeTextAttempt.count({
    where: {
      cycleId: attempt.cycleId,
      evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
    },
  })
  const isCorrect = outcomeBand.category === 'CORRECT'
  const isExhausted =
    !isCorrect && evaluatedCount + 1 >= attempt.cycle.attemptLimit
  const completedAt = new Date()
  const transitioned = await prisma.freeTextAttempt.updateMany({
    where: {
      id: attempt.id,
      evaluationRevision,
      evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      cycle: { status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    },
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
  if (transitioned.count !== 1) return false

  const cycleTransitioned = await prisma.freeTextPracticeCycle.updateMany({
    where: {
      id: attempt.cycleId,
      status: DB.FreeTextPracticeCycleStatus.ACTIVE,
    },
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
      stateVersion: { increment: 1 },
    },
  })
  if (cycleTransitioned.count !== 1) {
    throw new Error('Free-text practice cycle changed during evaluation')
  }
  return true
}

export async function completeFreeTextAttemptExactFallbackInTransaction(
  {
    attemptId,
    evaluationRevision,
    reason,
  }: {
    attemptId: string
    evaluationRevision: number
    reason: FreeTextEvaluationAvailabilityReason
  },
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT cycle."id"
    FROM "FreeTextPracticeCycle" AS cycle
    INNER JOIN "FreeTextAttempt" AS attempt
      ON attempt."cycleId" = cycle."id"
    WHERE attempt."id" = ${attemptId}
    FOR UPDATE OF cycle
  `
  const attempt = await prisma.freeTextAttempt.findUnique({
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

  let config: ReturnType<typeof parseSemanticConfig>
  try {
    config = parseSemanticConfig(attempt.cycle.elementInstance)
  } catch {
    return false
  }
  if (
    attempt.rubricSchemaVersion !== config.rubric_schema.schema_version ||
    attempt.rubricSchemaHash !== getSemanticFreeTextConfigHash(config)
  ) {
    return false
  }
  const exactMatch = matchesAcceptedExactAnswer({
    response: attempt.answer,
    acceptedExactAnswers: config.accepted_exact_answers,
  })
  const aggregateScore = exactMatch ? 100 : 0
  const outcomeBand = mapFreeTextOutcome({
    score: aggregateScore,
    outcomeBands:
      config.outcome_bands ??
      getDefaultFreeTextOutcomeBands(config.question_language),
  })
  if (!outcomeBand) {
    throw new Error('Exact fallback could not be mapped')
  }

  const evaluatedCount = await prisma.freeTextAttempt.count({
    where: {
      cycleId: attempt.cycleId,
      evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
    },
  })
  const exhausted =
    !exactMatch && evaluatedCount + 1 >= attempt.cycle.attemptLimit
  const completedAt = new Date()
  const transitioned = await prisma.freeTextAttempt.updateMany({
    where: {
      id: attempt.id,
      evaluationRevision,
      evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      cycle: { status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    },
    data: {
      evaluationStatus: DB.FreeTextEvaluationStatus.EVALUATED,
      evaluationSource: DB.FreeTextEvaluationSource.EXACT_MATCH,
      retryable: false,
      availabilityReason: reason,
      completedAt,
      evaluatorVersion: null,
      modelVersion: null,
      aggregateScore,
      outcomeBandId: outcomeBand.id,
      outcomeBandLabel: outcomeBand.label,
      correctness: outcomeBand.category,
      structuredResult: DB.Prisma.DbNull,
    },
  })
  if (transitioned.count !== 1) return false

  const cycleTransitioned = await prisma.freeTextPracticeCycle.updateMany({
    where: {
      id: attempt.cycleId,
      status: DB.FreeTextPracticeCycleStatus.ACTIVE,
    },
    data: {
      bestScore: Math.max(attempt.cycle.bestScore, aggregateScore),
      status: exactMatch
        ? DB.FreeTextPracticeCycleStatus.CORRECT
        : exhausted
          ? DB.FreeTextPracticeCycleStatus.EXHAUSTED
          : DB.FreeTextPracticeCycleStatus.ACTIVE,
      endedAt: exactMatch || exhausted ? completedAt : null,
      solutionRevealedAt:
        exhausted && config.solution_reveal_enabled ? completedAt : null,
      stateVersion: { increment: 1 },
    },
  })
  if (cycleTransitioned.count !== 1) {
    throw new Error('Free-text practice cycle changed during exact fallback')
  }
  return true
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
    reason: FreeTextEvaluationAvailabilityReason
    retryable: boolean
  },
  prisma: DB.PrismaClient
) {
  return await prisma.$transaction(async (tx) => {
    const lockedCycles = await tx.$queryRaw<{ id: string }[]>`
      SELECT cycle."id"
      FROM "FreeTextPracticeCycle" AS cycle
      INNER JOIN "FreeTextAttempt" AS attempt
        ON attempt."cycleId" = cycle."id"
      WHERE attempt."id" = ${attemptId}
      FOR UPDATE OF cycle
    `
    const cycleId = lockedCycles[0]?.id
    if (!cycleId) return false

    const completedAt = new Date()
    const result = await tx.freeTextAttempt.updateMany({
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
        completedAt,
      },
    })
    if (result.count !== 1) return false

    const cycleTransitioned = await tx.freeTextPracticeCycle.updateMany({
      where: {
        id: cycleId,
        status: DB.FreeTextPracticeCycleStatus.ACTIVE,
      },
      data: {
        ...(retryable
          ? {}
          : {
              status: DB.FreeTextPracticeCycleStatus.UNAVAILABLE,
              endedAt: completedAt,
            }),
        stateVersion: { increment: 1 },
      },
    })
    if (cycleTransitioned.count !== 1) {
      throw new Error(
        'Free-text practice cycle changed while evaluation became unavailable'
      )
    }

    return true
  })
}

export async function retryFreeTextAttemptInTransaction(
  {
    attemptId,
    cycleId,
    evaluationRevision,
  }: { attemptId: string; cycleId: string; evaluationRevision: number },
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "FreeTextPracticeCycle"
    WHERE "id" = ${cycleId}
    FOR UPDATE
  `
  const transitioned = await prisma.freeTextAttempt.updateMany({
    where: {
      id: attemptId,
      evaluationRevision,
      evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
      retryable: true,
      cycle: { status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    },
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
  if (transitioned.count !== 1) return false

  const cycleTransitioned = await prisma.freeTextPracticeCycle.updateMany({
    where: { id: cycleId, status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    data: { stateVersion: { increment: 1 } },
  })
  if (cycleTransitioned.count !== 1) {
    throw new Error('Free-text practice cycle changed during retry')
  }
  return true
}

export async function revealFreeTextSolutionInTransaction(
  {
    cycleId,
    attemptId,
    evaluationRevision,
    evaluationStatus,
  }: {
    cycleId: string
    attemptId: string
    evaluationRevision: number
    evaluationStatus: DB.FreeTextEvaluationStatus
  },
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "FreeTextPracticeCycle"
    WHERE "id" = ${cycleId}
    FOR UPDATE
  `
  return await prisma.freeTextPracticeCycle.updateMany({
    where: {
      id: cycleId,
      status: {
        in: [
          DB.FreeTextPracticeCycleStatus.ACTIVE,
          DB.FreeTextPracticeCycleStatus.UNAVAILABLE,
        ],
      },
      attempts: {
        some: {
          id: attemptId,
          evaluationRevision,
          evaluationStatus,
        },
      },
    },
    data: {
      status: DB.FreeTextPracticeCycleStatus.SOLUTION_REVEALED,
      solutionRevealedAt: new Date(),
      endedAt: new Date(),
      stateVersion: { increment: 1 },
    },
  })
}

export async function markConsentRequiredAttemptsDeclinedInTransaction(
  participantId: string,
  prisma: PrismaTransactionClient
) {
  await prisma.$queryRaw`
    SELECT "id"
    FROM "FreeTextPracticeCycle"
    WHERE "participantId" = ${participantId}
      AND "status" = 'ACTIVE'
    ORDER BY "id"
    FOR UPDATE
  `
  const affectedCycles = await prisma.freeTextAttempt.findMany({
    where: {
      cycle: {
        participantId,
        status: DB.FreeTextPracticeCycleStatus.ACTIVE,
      },
      evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
      availabilityReason: 'CONSENT_REQUIRED',
    },
    select: { cycleId: true },
    distinct: ['cycleId'],
  })
  if (affectedCycles.length === 0) return 0

  const cycleIds = affectedCycles.map(({ cycleId }) => cycleId)
  const transitioned = await prisma.freeTextAttempt.updateMany({
    where: {
      cycleId: { in: cycleIds },
      evaluationStatus: DB.FreeTextEvaluationStatus.UNAVAILABLE,
      availabilityReason: 'CONSENT_REQUIRED',
    },
    data: { availabilityReason: 'CONSENT_DECLINED' },
  })
  if (transitioned.count === 0) return 0

  await prisma.freeTextPracticeCycle.updateMany({
    where: {
      id: { in: cycleIds },
      status: DB.FreeTextPracticeCycleStatus.ACTIVE,
    },
    data: { stateVersion: { increment: 1 } },
  })
  return transitioned.count
}

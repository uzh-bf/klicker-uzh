import {
  computeFreeTextAggregate,
  getDefaultFreeTextOutcomeBands,
  mapFreeTextOutcome,
} from '@klicker-uzh/grading'
import * as DB from '@klicker-uzh/prisma/client'
import type { EvaluateFreeTextResponseV1 } from '@klicker-uzh/types'
import type { PrismaTransactionClient } from '@klicker-uzh/util'
import { parseSemanticConfig } from './freeTextEvaluationPolicy.js'

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
    outcomeBands: config.outcome_bands ?? getDefaultFreeTextOutcomeBands(),
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
    },
  })
  if (cycleTransitioned.count !== 1) {
    throw new Error('Free-text practice cycle changed during evaluation')
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

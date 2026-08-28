import type { Context } from '@hatchet-dev/typescript-sdk/index.js'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlerGlobalContext } from '@klicker-uzh/types'
import {
  completeFreeTextAttemptEvaluationInTransaction,
  getSemanticEvaluationDisclosureVersion,
  getSemanticFreeTextConfig,
  getSemanticFreeTextConfigHash,
} from './freeTextEvaluation.js'
import { resolveFreeTextAttemptUnavailability } from './freeTextEvaluationFallback.js'
import { markFreeTextAttemptUnavailable } from './freeTextEvaluationTransitions.js'
import {
  applyEvaluatedFreeTextAttempt,
  applyEvaluatedFreeTextAttemptInTransaction,
} from './freeTextPracticeResponseApplication.js'
import {
  RetryableSemanticEvaluatorError,
  requestSemanticFreeTextEvaluation,
} from './semanticFreeTextEvaluator.js'

export async function handleEvaluateFreeTextAttempt(
  {
    attemptId,
    evaluationRevision,
  }: { attemptId: string; evaluationRevision: number },
  globalCtx: HatchetHandlerGlobalContext,
  _executionCtx: Context<unknown>
) {
  const attempt = await globalCtx.prisma.freeTextAttempt.findUnique({
    where: { id: attemptId },
    include: {
      cycle: {
        include: {
          elementInstance: true,
          practiceQuiz: { include: { owner: true } },
        },
      },
    },
  })
  if (!attempt || attempt.evaluationRevision !== evaluationRevision) {
    return { success: true, applied: false }
  }
  if (
    attempt.evaluationStatus === DB.FreeTextEvaluationStatus.EVALUATED &&
    attempt.questionResponseDetailId === null
  ) {
    const applied = await applyEvaluatedFreeTextAttempt(
      { attemptId },
      globalCtx.prisma
    )
    if (!applied) {
      throw new Error(
        'Evaluated free-text attempt could not apply its response'
      )
    }
    return { success: true, applied }
  }
  if (
    attempt.evaluationStatus !== DB.FreeTextEvaluationStatus.PENDING ||
    attempt.cycle.status !== DB.FreeTextPracticeCycleStatus.ACTIVE
  ) {
    return { success: true, applied: false }
  }

  const config = getSemanticFreeTextConfig(attempt.cycle.elementInstance)
  if (
    attempt.rubricSchemaVersion !== config.rubric_schema.schema_version ||
    attempt.rubricSchemaHash !== getSemanticFreeTextConfigHash(config)
  ) {
    await markFreeTextAttemptUnavailable(
      {
        attemptId,
        evaluationRevision,
        reason: 'CONFIGURATION_CHANGED',
        retryable: false,
      },
      globalCtx.prisma
    )
    return { success: true, applied: true }
  }

  const latestConsentEvent =
    await globalCtx.prisma.freeTextConsentEvent.findFirst({
      where: {
        participantId: attempt.cycle.participantId,
        disclosureVersion: getSemanticEvaluationDisclosureVersion(),
      },
      orderBy: [{ decidedAt: 'desc' }, { id: 'desc' }],
    })
  if (
    latestConsentEvent?.decision !==
    DB.SemanticEvaluationConsentDecision.ACCEPTED
  ) {
    await resolveFreeTextAttemptUnavailability(
      {
        attemptId,
        evaluationRevision,
        reason:
          latestConsentEvent?.decision ===
          DB.SemanticEvaluationConsentDecision.DECLINED
            ? 'CONSENT_DECLINED'
            : 'CONSENT_REQUIRED',
        retryable: true,
      },
      globalCtx.prisma
    )
    return { success: true, applied: true }
  }

  const ownerEntitled =
    attempt.cycle.practiceQuiz.owner.catalystInstitutional ||
    attempt.cycle.practiceQuiz.owner.catalystIndividual
  if (!ownerEntitled) {
    await resolveFreeTextAttemptUnavailability(
      {
        attemptId,
        evaluationRevision,
        reason: 'LECTURER_ENTITLEMENT_UNAVAILABLE',
        retryable: true,
      },
      globalCtx.prisma
    )
    return { success: true, applied: true }
  }

  const evaluatorResult = await requestSemanticFreeTextEvaluation({
    request: {
      contract_version: '1',
      task_bundle_id: attempt.id,
      question: {
        content: attempt.cycle.elementInstance.elementData.content,
        language: config.question_language,
      },
      response: { text: attempt.answer },
      ...(config.reference_solution
        ? { reference_solution: config.reference_solution }
        : {}),
      rubric_schema: config.rubric_schema,
    },
    rubricSchema: config.rubric_schema,
  })
  if (!evaluatorResult.ok) {
    await resolveFreeTextAttemptUnavailability(
      {
        attemptId,
        evaluationRevision,
        reason: evaluatorResult.reason,
        retryable: evaluatorResult.retryable,
      },
      globalCtx.prisma
    )
    return { success: true, applied: true }
  }

  const applied = await globalCtx.prisma.$transaction(async (tx) => {
    const evaluationApplied =
      await completeFreeTextAttemptEvaluationInTransaction(
        {
          attemptId,
          evaluationRevision,
          evaluation: evaluatorResult.response,
        },
        tx
      )
    if (!evaluationApplied) return false

    const responseApplied = await applyEvaluatedFreeTextAttemptInTransaction(
      { attemptId, bumpStateVersion: false },
      tx
    )
    if (!responseApplied) {
      throw new Error(
        'Free-text evaluation could not apply its response atomically'
      )
    }
    return true
  })
  return { success: true, applied }
}

export async function handleEvaluateFreeTextAttemptFailure(
  {
    attemptId,
    evaluationRevision,
  }: { attemptId: string; evaluationRevision: number },
  globalCtx: HatchetHandlerGlobalContext,
  _executionCtx: Context<unknown>
) {
  const applied = await resolveFreeTextAttemptUnavailability(
    {
      attemptId,
      evaluationRevision,
      reason: 'EVALUATOR_FAILED',
      retryable: true,
    },
    globalCtx.prisma
  )
  if (!applied) {
    console.warn(
      JSON.stringify({
        service: 'semantic-free-text-evaluator',
        attemptId,
        reasonClass: 'FAILURE_HANDLER_NOOP',
        detail: 'mark-free-text-attempt-unavailable matched no PENDING attempt',
      })
    )
  }
  return { success: true, applied }
}

const REAP_STALLED_AFTER_MINUTES = 10

export async function handleReapStalledFreeTextAttempts(
  _input: Record<string, never>,
  globalCtx: HatchetHandlerGlobalContext,
  _executionCtx: Context<unknown>
) {
  const stalledBefore = new Date(
    Date.now() - REAP_STALLED_AFTER_MINUTES * 60 * 1000
  )
  const stalledAttempts = await globalCtx.prisma.freeTextAttempt.findMany({
    where: {
      evaluationStatus: DB.FreeTextEvaluationStatus.PENDING,
      updatedAt: { lt: stalledBefore },
      cycle: { status: DB.FreeTextPracticeCycleStatus.ACTIVE },
    },
    select: { id: true, evaluationRevision: true },
    orderBy: { updatedAt: 'asc' },
    take: 100,
  })
  const applied = await Promise.all(
    stalledAttempts.map((attempt) =>
      resolveFreeTextAttemptUnavailability(
        {
          attemptId: attempt.id,
          evaluationRevision: attempt.evaluationRevision,
          reason: 'EVALUATION_STALLED',
          retryable: true,
        },
        globalCtx.prisma
      )
    )
  )
  const appliedCount = applied.filter(Boolean).length
  if (appliedCount > 0) {
    console.warn(
      JSON.stringify({
        service: 'semantic-free-text-evaluator',
        reasonClass: 'STALLED_ATTEMPTS_REAPED',
        count: appliedCount,
      })
    )
  }
  return true
}

export { RetryableSemanticEvaluatorError }

import type { Context } from '@hatchet-dev/typescript-sdk/index.js'
import * as DB from '@klicker-uzh/prisma/client'
import type { HatchetHandlerGlobalContext } from '@klicker-uzh/types'
import {
  completeFreeTextAttemptEvaluation,
  getSemanticEvaluationDisclosureVersion,
  getSemanticFreeTextConfig,
  getSemanticFreeTextConfigHash,
  markFreeTextAttemptUnavailable,
} from './freeTextEvaluation.js'
import {
  RetryableSemanticEvaluatorError,
  requestSemanticFreeTextEvaluation,
} from './semanticFreeTextEvaluator.js'
import { applyFreeTextAttemptResponse } from './stacks.js'

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
    const applied = await applyFreeTextAttemptResponse(
      { attemptId },
      globalCtx.prisma
    )
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

  const ownerEntitled =
    attempt.cycle.practiceQuiz.owner.catalystInstitutional ||
    attempt.cycle.practiceQuiz.owner.catalystIndividual
  if (!ownerEntitled) {
    await markFreeTextAttemptUnavailable(
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

  const consent =
    await globalCtx.prisma.participantSemanticEvaluationConsent.findUnique({
      where: {
        participantId_disclosureVersion: {
          participantId: attempt.cycle.participantId,
          disclosureVersion: getSemanticEvaluationDisclosureVersion(),
        },
      },
    })
  if (consent?.decision !== DB.SemanticEvaluationConsentDecision.ACCEPTED) {
    await markFreeTextAttemptUnavailable(
      {
        attemptId,
        evaluationRevision,
        reason:
          consent?.decision === DB.SemanticEvaluationConsentDecision.DECLINED
            ? 'CONSENT_DECLINED'
            : 'CONSENT_REQUIRED',
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
    await markFreeTextAttemptUnavailable(
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

  const applied = await completeFreeTextAttemptEvaluation(
    {
      attemptId,
      evaluationRevision,
      evaluation: evaluatorResult.response,
    },
    globalCtx.prisma
  )
  const responseApplied = applied
    ? await applyFreeTextAttemptResponse({ attemptId }, globalCtx.prisma)
    : false
  return { success: true, applied: applied && responseApplied }
}

export async function handleEvaluateFreeTextAttemptFailure(
  {
    attemptId,
    evaluationRevision,
  }: { attemptId: string; evaluationRevision: number },
  globalCtx: HatchetHandlerGlobalContext,
  _executionCtx: Context<unknown>
) {
  const applied = await markFreeTextAttemptUnavailable(
    {
      attemptId,
      evaluationRevision,
      reason: 'EVALUATOR_FAILED',
      retryable: true,
    },
    globalCtx.prisma
  )
  return { success: true, applied }
}

export { RetryableSemanticEvaluatorError }

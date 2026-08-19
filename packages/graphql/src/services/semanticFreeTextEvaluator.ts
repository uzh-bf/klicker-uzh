import { validateEvaluateFreeTextResponse } from '@klicker-uzh/grading'
import type {
  EvaluateFreeTextRequestV1,
  EvaluateFreeTextResponseV1,
  FreeTextRubricSchema,
} from '@klicker-uzh/types'

const DEFAULT_TIMEOUT_MS = 30_000

export class RetryableSemanticEvaluatorError extends Error {
  constructor() {
    super('Semantic evaluator request failed')
    this.name = 'RetryableSemanticEvaluatorError'
  }
}

export type SemanticEvaluatorResult =
  | { ok: true; response: EvaluateFreeTextResponseV1 }
  | {
      ok: false
      reason: 'EVALUATOR_REJECTED_REQUEST' | 'EVALUATOR_RESULT_UNAVAILABLE'
      retryable: boolean
    }

export async function requestSemanticFreeTextEvaluation({
  request,
  rubricSchema,
}: {
  request: EvaluateFreeTextRequestV1
  rubricSchema: FreeTextRubricSchema
}): Promise<SemanticEvaluatorResult> {
  const endpoint = process.env.CATALYST_FORMATIVE_EVALUATOR_URL
  if (!endpoint) {
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: true,
    }
  }

  const timeout = Number(
    process.env.CATALYST_FORMATIVE_EVALUATOR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS
  )
  let response: Response
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.CATALYST_FORMATIVE_EVALUATOR_TOKEN
          ? {
              authorization: `Bearer ${process.env.CATALYST_FORMATIVE_EVALUATOR_TOKEN}`,
            }
          : {}),
      },
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(Number.isFinite(timeout) ? timeout : 30_000),
    })
  } catch {
    throw new RetryableSemanticEvaluatorError()
  }

  if (!response.ok) {
    if (
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      throw new RetryableSemanticEvaluatorError()
    }
    return {
      ok: false,
      reason: 'EVALUATOR_REJECTED_REQUEST',
      retryable: false,
    }
  }

  let value: unknown
  try {
    value = await response.json()
  } catch {
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: true,
    }
  }
  const errors = validateEvaluateFreeTextResponse({
    value,
    taskBundleId: request.task_bundle_id,
    rubricSchema,
  })
  if (errors.length > 0) {
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: true,
    }
  }

  return { ok: true, response: value as EvaluateFreeTextResponseV1 }
}

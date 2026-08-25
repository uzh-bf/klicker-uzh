import { validateEvaluateFreeTextResponse } from '@klicker-uzh/grading'
import type {
  EvaluateFreeTextRequestV1,
  EvaluateFreeTextResponseV1,
  FreeTextRubricSchema,
} from '@klicker-uzh/types'

const DEFAULT_TIMEOUT_MS = 30_000

// Structured boundary logging: reason class and correlation ids only. Never
// log answer text, rubric content, tokens, or full payloads.
function logEvaluatorEvent(
  level: 'warn' | 'error',
  taskBundleId: string,
  reasonClass: string,
  extra?: Record<string, unknown>
) {
  const entry = {
    service: 'semantic-free-text-evaluator',
    attemptId: taskBundleId,
    reasonClass,
    ...extra,
  }
  if (level === 'error') {
    console.error(JSON.stringify(entry))
  } else {
    console.warn(JSON.stringify(entry))
  }
}

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

  const configuredTimeout = Number(
    process.env.CATALYST_FORMATIVE_EVALUATOR_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS
  )
  const timeout =
    Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : DEFAULT_TIMEOUT_MS
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
      signal: AbortSignal.timeout(timeout),
    })
  } catch (error) {
    logEvaluatorEvent('warn', request.task_bundle_id, 'RETRYABLE_NETWORK', {
      detail: error instanceof Error ? error.name : 'unknown',
    })
    throw new RetryableSemanticEvaluatorError()
  }

  if (!response.ok) {
    if (
      response.status === 408 ||
      response.status === 429 ||
      response.status >= 500
    ) {
      logEvaluatorEvent('warn', request.task_bundle_id, 'HTTP_RETRYABLE', {
        status: response.status,
      })
      throw new RetryableSemanticEvaluatorError()
    }
    logEvaluatorEvent(
      'error',
      request.task_bundle_id,
      'EVALUATOR_REJECTED_REQUEST',
      { status: response.status }
    )
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
    logEvaluatorEvent('error', request.task_bundle_id, 'INVALID_JSON_PAYLOAD')
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
    logEvaluatorEvent('error', request.task_bundle_id, 'INVALID_PAYLOAD', {
      validationErrors: errors.length,
    })
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: true,
    }
  }

  return { ok: true, response: value as EvaluateFreeTextResponseV1 }
}

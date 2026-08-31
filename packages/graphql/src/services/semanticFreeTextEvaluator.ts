import {
  MAX_FREE_TEXT_EVALUATOR_RESPONSE_BYTES,
  validateEvaluateFreeTextResponse,
} from '@klicker-uzh/grading'
import type {
  EvaluateFreeTextRequestV1,
  EvaluateFreeTextResponseV1,
  FreeTextEvaluationAvailabilityReason,
  FreeTextRubricSchema,
} from '@klicker-uzh/types'

const DEFAULT_TIMEOUT_MS = 30_000
const LOCAL_EVALUATOR_HOSTS = new Set([
  '127.0.0.1',
  '[::1]',
  'localhost',
  'host.docker.internal',
])

class EvaluatorResponseTooLargeError extends Error {}

async function readEvaluatorResponse(response: Response): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_FREE_TEXT_EVALUATOR_RESPONSE_BYTES
  ) {
    throw new EvaluatorResponseTooLargeError()
  }
  if (!response.body) return ''

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  const chunks: string[] = []
  let bytesRead = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytesRead += value.byteLength
    if (bytesRead > MAX_FREE_TEXT_EVALUATOR_RESPONSE_BYTES) {
      await reader.cancel().catch(() => undefined)
      throw new EvaluatorResponseTooLargeError()
    }
    chunks.push(decoder.decode(value, { stream: true }))
  }
  chunks.push(decoder.decode())
  return chunks.join('')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function resolveSemanticEvaluatorEndpoint(value: string): string | null {
  let endpoint: URL
  try {
    endpoint = new URL(value)
  } catch {
    return null
  }

  if (endpoint.username || endpoint.password || endpoint.hash) return null
  const localHttpAllowed =
    process.env.NODE_ENV !== 'production' &&
    (process.env.NODE_ENV === 'test' ||
      process.env.CATALYST_FORMATIVE_EVALUATOR_ALLOW_INSECURE_LOCAL ===
        'true') &&
    endpoint.protocol === 'http:' &&
    LOCAL_EVALUATOR_HOSTS.has(endpoint.hostname)
  if (endpoint.protocol !== 'https:' && !localHttpAllowed) return null

  return endpoint.toString()
}

export function isSemanticEvaluatorConfigured(): boolean {
  const endpoint = process.env.CATALYST_FORMATIVE_EVALUATOR_URL
  return !!endpoint && resolveSemanticEvaluatorEndpoint(endpoint) !== null
}

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
      reason: Extract<
        FreeTextEvaluationAvailabilityReason,
        'EVALUATOR_REJECTED_REQUEST' | 'EVALUATOR_RESULT_UNAVAILABLE'
      >
      retryable: boolean
    }

function evaluatorRequestedHumanReview(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.rubric_assessments)) {
    return false
  }

  return value.rubric_assessments.some(
    (assessment) => isRecord(assessment) && assessment.needs_review === true
  )
}

function canonicalizeEvaluatorResponse(
  value: EvaluateFreeTextResponseV1
): EvaluateFreeTextResponseV1 {
  return {
    contract_version: value.contract_version,
    task_bundle_id: value.task_bundle_id,
    evaluator_version: value.evaluator_version,
    model_version: value.model_version,
    rubric_assessments: value.rubric_assessments.map((assessment) => ({
      task_bundle_id: assessment.task_bundle_id,
      rubric_id: assessment.rubric_id,
      rubric_name: assessment.rubric_name,
      proposed_level: assessment.proposed_level,
      normalized_score: assessment.normalized_score,
      justification: assessment.justification,
      evidence_ids: [...assessment.evidence_ids],
      confidence: assessment.confidence,
      needs_review: assessment.needs_review,
      review_flags: [...assessment.review_flags],
      used_evidence_ids: [...assessment.used_evidence_ids],
      unsupported_claims: [...assessment.unsupported_claims],
      ...(assessment.evidence_sufficiency !== undefined
        ? { evidence_sufficiency: assessment.evidence_sufficiency }
        : {}),
      ...(assessment.uncertainty_reason !== undefined
        ? { uncertainty_reason: assessment.uncertainty_reason }
        : {}),
      rationale: assessment.rationale,
    })),
    ...(value.feedback_proposals !== undefined
      ? {
          feedback_proposals: value.feedback_proposals.map((proposal) => ({
            task_bundle_id: proposal.task_bundle_id,
            rubric_id: proposal.rubric_id,
            rubric_name: proposal.rubric_name,
            feedback: proposal.feedback,
            strengths: [...proposal.strengths],
            improvements: [...proposal.improvements],
            action_items: [...proposal.action_items],
            evidence_ids: [...proposal.evidence_ids],
            confidence: proposal.confidence,
          })),
        }
      : {}),
  }
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
  const resolvedEndpoint = resolveSemanticEvaluatorEndpoint(endpoint)
  if (!resolvedEndpoint) {
    logEvaluatorEvent(
      'error',
      request.task_bundle_id,
      'INVALID_EVALUATOR_ENDPOINT'
    )
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: false,
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
    response = await fetch(resolvedEndpoint, {
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
      redirect: 'error',
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
    value = JSON.parse(await readEvaluatorResponse(response))
  } catch (error) {
    if (error instanceof EvaluatorResponseTooLargeError) {
      logEvaluatorEvent('error', request.task_bundle_id, 'RESPONSE_TOO_LARGE')
      return {
        ok: false,
        reason: 'EVALUATOR_RESULT_UNAVAILABLE',
        retryable: true,
      }
    }
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
    const requiresHumanReview = evaluatorRequestedHumanReview(value)
    logEvaluatorEvent(
      requiresHumanReview ? 'warn' : 'error',
      request.task_bundle_id,
      requiresHumanReview ? 'EVALUATOR_REQUIRES_REVIEW' : 'INVALID_PAYLOAD',
      { validationErrors: errors.length }
    )
    return {
      ok: false,
      reason: 'EVALUATOR_RESULT_UNAVAILABLE',
      retryable: !requiresHumanReview,
    }
  }

  return {
    ok: true,
    response: canonicalizeEvaluatorResponse(
      value as EvaluateFreeTextResponseV1
    ),
  }
}

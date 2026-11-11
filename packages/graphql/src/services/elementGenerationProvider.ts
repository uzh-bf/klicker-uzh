import type { QuestionGenerationArtifactRef } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { isFeatureFlagEnabled } from '../lib/featureFlags.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import {
  assertQuestionGenerationGraphEligible,
  QuestionGenerationGraphError,
} from './questionGenerationGraph.js'
import type { QuestionGenerationRuntime } from './questionGenerationRuntime.js'

const IDEMPOTENCY_KEY_MAX_LENGTH = 200

export async function assertElementGenerationAdmission(ctx: ContextWithUser) {
  if (!(await isFeatureFlagEnabled(ctx, 'question-generation-admission'))) {
    throw questionGenerationServiceError(
      'QUESTION_GENERATION_UNAVAILABLE',
      'New element generation is currently unavailable'
    )
  }
}

// The slot-revision worker is deployed separately from this backend and the
// worker rejects unknown start-input fields, so everything that reaches it
// stays off until the switch is set: the slot-specification request on build
// starts, the revision start event and the per-type revision capability.
export function isElementRevisionWorkerEnabled(
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return env.ELEMENT_REVISION_WORKER_ENABLED?.trim().toLowerCase() === 'true'
}

export function elementTypeSupportsRevision(
  elementType: string,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  return (
    isElementRevisionWorkerEnabled(env) &&
    (elementType === 'SC' || elementType === 'MC' || elementType === 'KPRIM')
  )
}

export function normalizeElementGenerationIdempotencyKey(
  value: string
): string {
  const normalized = value.trim()
  if (!normalized || normalized.length > IDEMPOTENCY_KEY_MAX_LENGTH) {
    throw questionGenerationServiceError(
      'CONFIGURATION_INVALID',
      `Idempotency key must contain 1-${IDEMPOTENCY_KEY_MAX_LENGTH} characters`
    )
  }
  return normalized
}

export function elementGenerationArtifactPayload(
  ref: QuestionGenerationArtifactRef
) {
  return {
    container_name: ref.containerName,
    blob_name: ref.blobName,
    sha256: ref.sha256,
  }
}

export function canonicalElementGenerationJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalElementGenerationJson)
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalElementGenerationJson(entry)])
    )
  }
  return value
}

export function elementGenerationOutputBlobName(
  runtime: QuestionGenerationRuntime,
  buildId: string,
  suffix: string
) {
  return `${runtime.questionOutputPrefix}/${buildId}/${suffix}`
}

export async function loadReadyElementGenerationGraph(
  graphBuildId: string,
  ctx: ContextWithUser
) {
  try {
    const graph = await assertQuestionGenerationGraphEligible(graphBuildId, ctx)
    if (graph.manifestSchemaVersion !== 2) {
      throw questionGenerationServiceError(
        'KB_GRAPH_NOT_FOUND',
        'Ready manifest-pinned knowledge graph build not found'
      )
    }
    return graph
  } catch (error) {
    if (error instanceof QuestionGenerationGraphError) {
      if (error.code === 'KB_GRAPH_SOURCE_MISMATCH') {
        throw questionGenerationServiceError(
          'KB_GRAPH_STALE',
          'Knowledge graph build no longer matches the active sources'
        )
      }
      throw questionGenerationServiceError(
        'KB_GRAPH_NOT_FOUND',
        'Ready knowledge graph build not found'
      )
    }
    throw error
  }
}

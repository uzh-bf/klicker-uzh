import type { QuestionGenerationArtifactRef } from '@klicker-uzh/types'
import type { ContextWithUser } from '../lib/context.js'
import { questionGenerationServiceError } from './questionGenerationErrors.js'
import {
  assertQuestionGenerationGraphEligible,
  QuestionGenerationGraphError,
} from './questionGenerationGraph.js'
import type { QuestionGenerationRuntime } from './questionGenerationRuntime.js'

const IDEMPOTENCY_KEY_MAX_LENGTH = 200

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

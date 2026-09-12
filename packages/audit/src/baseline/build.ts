import {
  canonicalByteLength,
  canonicalizeJson,
} from '../canonical/canonicalize.js'
import type {
  BaselinePartPayload,
  BaselineRootPayload,
} from '../contract/payloads/coverage.js'
import { baselineRootPayloadSchema } from '../contract/payloads/coverage.js'
import {
  type AssessmentBaselineContent,
  aggregateAssessmentBaselineParts,
  buildAssessmentBaselinePart,
  compareAssessmentBaselineParts,
} from './parts.js'

export type { AssessmentBaselineContent } from './parts.js'

export type BuiltAssessmentBaseline = {
  root: BaselineRootPayload
  parts: BaselinePartPayload[]
}

// Baselines are assembled before their parts are written to the transactional
// outbox. Keep the construction bounded so a malformed or unexpectedly large
// assessment fails closed instead of exhausting the GraphQL worker.
export const ASSESSMENT_BASELINE_MAX_PARTS = 100_000
// Keep the materialized representation below the worker's launch memory
// budget. This is a conservative payload budget; the outbox still chunks each
// emitted event independently.
export const ASSESSMENT_BASELINE_MAX_CANONICAL_BYTES = 64 * 1024 * 1024

export function buildAssessmentBaseline(input: {
  baselineId: string
  baselineKind: BaselineRootPayload['baselineKind']
  capturedAt: string
  contents: readonly AssessmentBaselineContent[]
}): BuiltAssessmentBaseline {
  if (input.contents.length > ASSESSMENT_BASELINE_MAX_PARTS) {
    throw new Error(
      `Assessment baseline exceeds the maximum of ${ASSESSMENT_BASELINE_MAX_PARTS} parts`
    )
  }
  const parts = input.contents.map((content) =>
    buildAssessmentBaselinePart({
      baselineId: input.baselineId,
      baselineKind: input.baselineKind,
      capturedAt: input.capturedAt,
      content,
    })
  )

  const canonicalBytes = parts.reduce(
    (total, part) => total + canonicalByteLength(canonicalizeJson(part)),
    0
  )
  if (canonicalBytes > ASSESSMENT_BASELINE_MAX_CANONICAL_BYTES) {
    throw new Error(
      `Assessment baseline exceeds the maximum of ${ASSESSMENT_BASELINE_MAX_CANONICAL_BYTES} canonical bytes`
    )
  }
  parts.sort(compareAssessmentBaselineParts)

  const uniquePartKeys = new Set<string>()
  for (const part of parts) {
    if (uniquePartKeys.has(part.partKey)) {
      throw new Error(`Duplicate assessment baseline part key ${part.partKey}`)
    }
    uniquePartKeys.add(part.partKey)
  }

  const expectedPartCounts = {
    configuration: 0,
    blocks: 0,
    elementInstances: 0,
    solutionsAndScoring: 0,
    participantEligibility: 0,
    lecturerPermissions: 0,
    mediaReferences: 0,
    limitations: 0,
  }
  for (const part of parts) {
    switch (part.content.kind) {
      case 'ASSESSMENT_CONFIGURATION':
        expectedPartCounts.configuration++
        break
      case 'BLOCK':
        expectedPartCounts.blocks++
        break
      case 'ELEMENT_INSTANCE':
        expectedPartCounts.elementInstances++
        break
      case 'SOLUTION_AND_SCORING':
        expectedPartCounts.solutionsAndScoring++
        break
      case 'PARTICIPANT_ELIGIBILITY':
        expectedPartCounts.participantEligibility++
        break
      case 'LECTURER_PERMISSION':
        expectedPartCounts.lecturerPermissions++
        break
      case 'MEDIA_REFERENCE':
        expectedPartCounts.mediaReferences++
        break
      case 'LIMITATION':
        expectedPartCounts.limitations++
        break
    }
  }

  if (expectedPartCounts.configuration !== 1) {
    throw new Error(
      'Assessment baseline requires exactly one configuration part'
    )
  }

  const root = baselineRootPayloadSchema.parse({
    baselineId: input.baselineId,
    baselineKind: input.baselineKind,
    baselineSchemaVersion: 1,
    capturedAt: input.capturedAt,
    expectedPartCounts,
    aggregateHash: aggregateAssessmentBaselineParts(parts),
  })

  return { root, parts }
}

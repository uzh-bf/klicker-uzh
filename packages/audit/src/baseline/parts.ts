import { createHash } from 'node:crypto'
import { canonicalizeJson } from '../canonical/canonicalize.js'
import { hashCanonicalValue } from '../canonical/hash.js'
import {
  type BaselinePartPayload,
  baselinePartContentSchema,
  baselinePartPayloadSchema,
} from '../contract/payloads/coverage.js'

export type AssessmentBaselineContent = BaselinePartPayload['content']

const PART_KIND_ORDER: Record<AssessmentBaselineContent['kind'], number> = {
  ASSESSMENT_CONFIGURATION: 0,
  BLOCK: 1,
  ELEMENT_INSTANCE: 2,
  SOLUTION_AND_SCORING: 3,
  PARTICIPANT_ELIGIBILITY: 4,
  LECTURER_PERMISSION: 5,
  MEDIA_REFERENCE: 6,
  LIMITATION: 7,
}

function integerKey(value: number): string {
  return String(value).padStart(12, '0')
}

export function assessmentBaselinePartKey(
  content: AssessmentBaselineContent
): string {
  switch (content.kind) {
    case 'ASSESSMENT_CONFIGURATION':
      return 'ASSESSMENT_CONFIGURATION|ROOT'
    case 'BLOCK':
      return `BLOCK|${integerKey(content.block.blockId)}`
    case 'ELEMENT_INSTANCE':
      return `ELEMENT_INSTANCE|${integerKey(content.elementInstanceId)}`
    case 'SOLUTION_AND_SCORING':
      return `SOLUTION_AND_SCORING|${integerKey(content.elementInstanceId)}`
    case 'PARTICIPANT_ELIGIBILITY':
      return `PARTICIPANT_ELIGIBILITY|${content.participantId}`
    case 'LECTURER_PERMISSION':
      return `LECTURER_PERMISSION|${content.userId}`
    case 'MEDIA_REFERENCE':
      return `MEDIA_REFERENCE|${content.media.mediaId}`
    case 'LIMITATION':
      return `LIMITATION|${hashCanonicalValue(content)}`
  }
}

export function buildAssessmentBaselinePart(input: {
  baselineId: string
  baselineKind: BaselinePartPayload['baselineKind']
  capturedAt: string
  content: AssessmentBaselineContent
}): BaselinePartPayload {
  const content = baselinePartContentSchema.parse(input.content)
  return baselinePartPayloadSchema.parse({
    baselineId: input.baselineId,
    baselineKind: input.baselineKind,
    baselineSchemaVersion: 1,
    capturedAt: input.capturedAt,
    partKey: assessmentBaselinePartKey(content),
    content,
    contentHash: hashCanonicalValue(content),
  })
}

export function compareAssessmentBaselineParts(
  left: BaselinePartPayload,
  right: BaselinePartPayload
): number {
  return (
    PART_KIND_ORDER[left.content.kind] - PART_KIND_ORDER[right.content.kind] ||
    left.partKey.localeCompare(right.partKey)
  )
}

export function aggregateAssessmentBaselineParts(
  parts: Iterable<Pick<BaselinePartPayload, 'partKey' | 'contentHash'>>
): string {
  const hash = createHash('sha256')
  for (const part of parts) {
    hash.update(canonicalizeJson([part.partKey, part.contentHash]))
    hash.update('\n')
  }
  return hash.digest('hex')
}

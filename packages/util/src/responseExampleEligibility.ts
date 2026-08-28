import { hasExactCitationIndexes } from './citations.js'

export interface ResponseExampleCurrentResource {
  id: string
  activeContentSha256: string | null
  deletedAt: Date | null
}

export interface ResponseExampleEvidenceEligibilityInput {
  sourceId: string
  contentHash: string
  citationIndex: number
}

export interface ResponseExampleCitationParityInput {
  referenceAnswer: string
  evidenceReferences: readonly { citationIndex: number }[]
}

export interface ResponseExampleEligibilityInput {
  referenceAnswer: string
  evidenceReferences: readonly ResponseExampleEvidenceEligibilityInput[]
}

export interface ResponseExampleCurrentEligibility {
  eligible: boolean
  evidenceEligibility: readonly boolean[]
}

export function hasCompleteResponseExampleCitationParity(
  example: ResponseExampleCitationParityInput
): boolean {
  return (
    example.evidenceReferences.length > 0 &&
    example.evidenceReferences.every(
      (reference) =>
        Number.isInteger(reference.citationIndex) && reference.citationIndex > 0
    ) &&
    hasExactCitationIndexes(
      example.referenceAnswer,
      example.evidenceReferences.map((reference) => reference.citationIndex)
    )
  )
}

/**
 * Validate response-example lineage against the resources currently served by
 * the chatbot's one enabled knowledge base. This verifies identity, activity,
 * content hash, and renderer-visible citation parity only.
 */
export function evaluateResponseExampleCurrentEligibility(
  example: ResponseExampleEligibilityInput,
  resources: readonly ResponseExampleCurrentResource[]
): ResponseExampleCurrentEligibility {
  const resourcesById = new Map(
    resources.map((resource) => [resource.id, resource])
  )
  const evidenceEligibility = example.evidenceReferences.map((reference) => {
    const resource = resourcesById.get(reference.sourceId)
    return (
      resource?.deletedAt === null &&
      resource.activeContentSha256 !== null &&
      resource.activeContentSha256 === reference.contentHash
    )
  })

  return {
    eligible:
      hasCompleteResponseExampleCitationParity(example) &&
      evidenceEligibility.every((current) => current),
    evidenceEligibility,
  }
}

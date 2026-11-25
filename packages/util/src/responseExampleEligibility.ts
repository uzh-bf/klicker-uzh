import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  Prisma as PrismaRuntime,
  ResponseExampleStatus,
} from '@klicker-uzh/prisma/client'
import { hasExactCitationIndexes } from './citations.js'

export interface ResponseExampleCurrentResource {
  linkId?: string
  linkCreatedAt?: Date
  chatModes?: string[]
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
  chatMode?: string
  sourceKbLinkId?: string | null
  createdAt?: Date
  referenceAnswer: string
  evidenceReferences: readonly ResponseExampleEvidenceEligibilityInput[]
}

export interface ResponseExampleCurrentEligibility {
  eligible: boolean
  evidenceEligibility: readonly boolean[]
}

export interface StoredResponseExampleEligibilityInput
  extends ResponseExampleEligibilityInput {
  id: string
  status: string
  evidenceReferences: readonly (ResponseExampleEvidenceEligibilityInput & {
    id: string
    evidenceEligible: boolean
  })[]
}

export interface ResponseExampleEligibilityReconciliation {
  currentEligibility: ReadonlyMap<string, ResponseExampleCurrentEligibility>
  eligibleReferenceIds: readonly string[]
  ineligibleReferenceIds: readonly string[]
  exampleIdsNeedingReview: readonly string[]
  changed: boolean
}

type ResponseExampleEligibilityPrisma = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'responseExample' | 'responseExampleEvidenceReference'
>

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
 * the knowledge base selected for the example’s mode. This verifies identity, activity,
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
      (!resource.chatModes ||
        (example.chatMode !== undefined &&
          resource.chatModes.includes(example.chatMode))) &&
      (example.sourceKbLinkId
        ? resource.linkId === example.sourceKbLinkId
        : !resource.linkCreatedAt ||
          (example.createdAt !== undefined &&
            resource.linkCreatedAt <= example.createdAt)) &&
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

export async function loadCurrentResponseExampleResources(
  prisma: Pick<Prisma.TransactionClient, '$queryRaw'>,
  chatbotId: string,
  sourceIds: readonly string[],
  chatModes: readonly string[]
) {
  if (sourceIds.length === 0 || chatModes.length === 0) return []

  return await prisma.$queryRaw<ResponseExampleCurrentResource[]>(
    PrismaRuntime.sql`
      SELECT resource."id", resource."activeContentSha256", resource."deletedAt",
             binding."id" AS "linkId", binding."createdAt" AS "linkCreatedAt", array_agg(mode.key) AS "chatModes"
      FROM "public"."Chatbot" AS bot
      JOIN "public"."KBChatbot" AS binding ON binding."chatbotId" = bot.id AND binding."isEnabled"
      JOIN "public"."KB" AS kb ON kb.id = binding."kbId" AND kb."deletedAt" IS NULL AND kb."ownerId" = bot."ownerId"
      JOIN "public"."KBResource" AS resource ON resource."kbId" = kb.id
      CROSS JOIN unnest(ARRAY[${PrismaRuntime.join([...new Set(chatModes)])}]::text[]) AS mode(key)
      LEFT JOIN LATERAL (
        SELECT entry->>'knowledgeBaseLinkId' AS link_id
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(bot."customModeConfig"->'modes') = 'array'
               THEN bot."customModeConfig"->'modes' ELSE '[]'::jsonb END
        ) AS entry
        WHERE entry->>'key' = mode.key
        LIMIT 1
      ) AS selection ON true
      WHERE bot.id = ${chatbotId}::uuid
        AND CASE WHEN selection.link_id IS NULL THEN binding."isDefault"
                 ELSE binding.id::text = selection.link_id END
        AND resource.id IN (${PrismaRuntime.join([...sourceIds])})
      GROUP BY resource.id, binding.id
    `
  )
}

export function buildResponseExampleEligibilityReconciliation(
  examples: readonly StoredResponseExampleEligibilityInput[],
  resources: readonly ResponseExampleCurrentResource[]
): ResponseExampleEligibilityReconciliation {
  const currentEligibility = new Map(
    examples.map((example) => [
      example.id,
      evaluateResponseExampleCurrentEligibility(example, resources),
    ])
  )
  const eligibleReferenceIds: string[] = []
  const ineligibleReferenceIds: string[] = []
  const exampleIdsNeedingReview: string[] = []

  for (const example of examples) {
    const current = currentEligibility.get(example.id)!
    for (const [index, reference] of example.evidenceReferences.entries()) {
      const evidenceEligible = current.evidenceEligibility[index] ?? false
      if (reference.evidenceEligible === evidenceEligible) continue
      if (evidenceEligible) {
        eligibleReferenceIds.push(reference.id)
      } else {
        ineligibleReferenceIds.push(reference.id)
      }
    }

    if (
      example.status === ResponseExampleStatus.APPROVED &&
      !current.eligible
    ) {
      exampleIdsNeedingReview.push(example.id)
    }
  }

  return {
    currentEligibility,
    eligibleReferenceIds,
    ineligibleReferenceIds,
    exampleIdsNeedingReview,
    changed:
      eligibleReferenceIds.length > 0 ||
      ineligibleReferenceIds.length > 0 ||
      exampleIdsNeedingReview.length > 0,
  }
}

export async function applyResponseExampleEligibilityReconciliation(
  prisma: ResponseExampleEligibilityPrisma,
  reconciliation: ResponseExampleEligibilityReconciliation
) {
  if (reconciliation.eligibleReferenceIds.length > 0) {
    await prisma.responseExampleEvidenceReference.updateMany({
      where: { id: { in: [...reconciliation.eligibleReferenceIds] } },
      data: { evidenceEligible: true },
    })
  }
  if (reconciliation.ineligibleReferenceIds.length > 0) {
    await prisma.responseExampleEvidenceReference.updateMany({
      where: { id: { in: [...reconciliation.ineligibleReferenceIds] } },
      data: { evidenceEligible: false },
    })
  }
  if (reconciliation.exampleIdsNeedingReview.length > 0) {
    await prisma.responseExample.updateMany({
      where: {
        id: { in: [...reconciliation.exampleIdsNeedingReview] },
        status: ResponseExampleStatus.APPROVED,
      },
      data: {
        status: ResponseExampleStatus.NEEDS_REVIEW,
        reviewedById: null,
        reviewedAt: null,
      },
    })
  }
}

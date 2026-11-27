import type { Prisma } from '@klicker-uzh/prisma/client'
import {
  Prisma as PrismaRuntime,
  ResponseExampleStatus,
} from '@klicker-uzh/prisma/client'
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
 * the chatbot's one enabled knowledge base. This verifies identity, activity,
 * content hash, current owner access, and renderer-visible citation parity.
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

export async function loadCurrentResponseExampleResources(
  prisma: Pick<Prisma.TransactionClient, '$queryRaw'>,
  chatbotId: string,
  sourceIds: readonly string[]
) {
  if (sourceIds.length === 0) return []

  return await prisma.$queryRaw<ResponseExampleCurrentResource[]>(
    PrismaRuntime.sql`
      WITH enabled_kb_bindings AS (
        SELECT binding."kbId"
        FROM "public"."KBChatbot" AS binding
        WHERE binding."chatbotId" = ${chatbotId}::uuid
          AND binding."isEnabled" = true
        ORDER BY binding."id" ASC
        LIMIT 2
      ), chatbot_owner AS (
        SELECT "ownerId"
        FROM "public"."Chatbot"
        WHERE "id" = ${chatbotId}::uuid
      ), current_kb AS (
        SELECT binding."kbId"
        FROM enabled_kb_bindings AS binding
        CROSS JOIN chatbot_owner AS owner
        WHERE (SELECT COUNT(*) FROM enabled_kb_bindings) = 1
          AND EXISTS (
            SELECT 1
            FROM "public"."KB" AS kb
            WHERE kb."id" = binding."kbId"
              AND kb."deletedAt" IS NULL
              AND (
                kb."ownerId" = owner."ownerId"
                OR EXISTS (
                  SELECT 1
                  FROM "public"."Permission" AS permission
                  WHERE permission."kbId" = binding."kbId"
                    AND permission."permissionLevel" IN (
                      'READ',
                      'WRITE',
                      'ADMIN'
                    )
                    AND (
                      permission."userId" = owner."ownerId"
                      OR EXISTS (
                        SELECT 1
                        FROM "public"."UserGroup" AS user_group
                        WHERE user_group."id" = permission."userGroupId"
                          AND (
                            user_group."ownerId" = owner."ownerId"
                            OR EXISTS (
                              SELECT 1
                              FROM "public"."_UserGroupMembers" AS membership
                              WHERE membership."A" = owner."ownerId"
                                AND membership."B" = user_group."id"
                            )
                            OR EXISTS (
                              SELECT 1
                              FROM "public"."_UserGroupAdmins" AS admin
                              WHERE admin."A" = owner."ownerId"
                                AND admin."B" = user_group."id"
                            )
                          )
                      )
                    )
                )
              )
          )
      )
      SELECT
        resource."id",
        resource."activeContentSha256",
        resource."deletedAt"
      FROM current_kb
      INNER JOIN "public"."KBResource" AS resource
        ON resource."kbId" = current_kb."kbId"
      WHERE resource."id" IN (${PrismaRuntime.join([...sourceIds])})
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

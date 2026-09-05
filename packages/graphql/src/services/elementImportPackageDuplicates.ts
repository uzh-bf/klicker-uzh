import * as DB from '@klicker-uzh/prisma/client'
import type { ContextWithUser } from '../lib/context.js'
import { IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import {
  MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS,
  MAX_IMPORT_EXPORT_ELEMENTS,
} from '../lib/importExportPackageConfig.js'
import type { NormalizedImportPackage } from './elementImportPackageParser.js'
import {
  createElementImportPreviewModel,
  decorateElementImportPreviewWithDuplicateMatches,
  type ElementImportPackageDuplicateMatches,
  type ElementImportPreviewModel,
} from './elementImportPreviewModel.js'

type ImportPackageDuplicateFingerprintCandidates = {
  elementFingerprints: readonly string[]
  answerCollectionFingerprints: readonly string[]
}

function createFingerprintCandidateValues(fingerprints: readonly string[]) {
  return DB.Prisma.join(
    fingerprints.map((fingerprint) => DB.Prisma.sql`(${fingerprint}::text)`)
  )
}

export async function findImportPackageDuplicateMatchesByFingerprint(
  candidates: ImportPackageDuplicateFingerprintCandidates,
  ctx: Pick<ContextWithUser, 'prisma' | 'user'>
): Promise<ElementImportPackageDuplicateMatches> {
  if (
    candidates.elementFingerprints.length > MAX_IMPORT_EXPORT_ELEMENTS ||
    candidates.answerCollectionFingerprints.length >
      MAX_IMPORT_EXPORT_ANSWER_COLLECTIONS
  ) {
    throw new Error('Duplicate-match candidate count exceeds package limits.')
  }

  const elementFingerprints = Array.from(
    new Set(candidates.elementFingerprints)
  )
  const answerCollectionFingerprints = Array.from(
    new Set(candidates.answerCollectionFingerprints)
  )

  type ExistingFingerprintMatch = {
    id: number
    name: string
    importFingerprint: string
  }

  // ORDER BY id alone lets PostgreSQL choose the primary key and filter an
  // unbounded table prefix per candidate. The false-inclusive/true-exclusive
  // full-key range selects exactly the active composite-index prefix.
  const [existingElements, existingAnswerCollections] = await Promise.all([
    elementFingerprints.length === 0
      ? []
      : ctx.prisma.$queryRaw<ExistingFingerprintMatch[]>`
          WITH candidates("importFingerprint") AS (
            VALUES ${createFingerprintCandidateValues(elementFingerprints)}
          )
          SELECT matched."id", matched."name", matched."importFingerprint"
          FROM candidates
          CROSS JOIN LATERAL (
            SELECT "id", "name", "importFingerprint"
            FROM "public"."Element"
            WHERE ROW(
              "ownerId",
              "importFingerprintVersion",
              "importFingerprint",
              "isDeleted",
              "id"
            ) >= ROW(
              ${ctx.user.sub}::uuid,
              ${IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION}::integer,
              candidates."importFingerprint",
              false,
              '-2147483648'::integer
            )
              AND ROW(
                "ownerId",
                "importFingerprintVersion",
                "importFingerprint",
                "isDeleted",
                "id"
              ) < ROW(
                ${ctx.user.sub}::uuid,
                ${IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION}::integer,
                candidates."importFingerprint",
                true,
                '-2147483648'::integer
              )
            ORDER BY
              "ownerId",
              "importFingerprintVersion",
              "importFingerprint",
              "isDeleted",
              "id"
            LIMIT 1
          ) AS matched
          LIMIT ${elementFingerprints.length}
        `,
    answerCollectionFingerprints.length === 0
      ? []
      : ctx.prisma.$queryRaw<ExistingFingerprintMatch[]>`
          WITH candidates("importFingerprint") AS (
            VALUES ${createFingerprintCandidateValues(
              answerCollectionFingerprints
            )}
          )
          SELECT matched."id", matched."name", matched."importFingerprint"
          FROM candidates
          CROSS JOIN LATERAL (
            SELECT "id", "name", "importFingerprint"
            FROM "public"."AnswerCollection"
            WHERE ROW(
              "ownerId",
              "importFingerprintVersion",
              "importFingerprint",
              "isDeleted",
              "id"
            ) >= ROW(
              ${ctx.user.sub}::uuid,
              ${IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION}::integer,
              candidates."importFingerprint",
              false,
              '-2147483648'::integer
            )
              AND ROW(
                "ownerId",
                "importFingerprintVersion",
                "importFingerprint",
                "isDeleted",
                "id"
              ) < ROW(
                ${ctx.user.sub}::uuid,
                ${IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION}::integer,
                candidates."importFingerprint",
                true,
                '-2147483648'::integer
              )
            ORDER BY
              "ownerId",
              "importFingerprintVersion",
              "importFingerprint",
              "isDeleted",
              "id"
            LIMIT 1
          ) AS matched
          LIMIT ${answerCollectionFingerprints.length}
        `,
  ])

  const elementMatchByFingerprint = new Map<
    string,
    { id: number; name: string }
  >()
  for (const element of existingElements) {
    if (
      element.importFingerprint &&
      !elementMatchByFingerprint.has(element.importFingerprint)
    ) {
      elementMatchByFingerprint.set(element.importFingerprint, {
        id: element.id,
        name: element.name,
      })
    }
  }

  const answerCollectionMatchByFingerprint = new Map<
    string,
    { id: number; name: string }
  >()
  for (const collection of existingAnswerCollections) {
    if (
      collection.importFingerprint &&
      !answerCollectionMatchByFingerprint.has(collection.importFingerprint)
    ) {
      answerCollectionMatchByFingerprint.set(collection.importFingerprint, {
        id: collection.id,
        name: collection.name,
      })
    }
  }

  return {
    elementMatchByFingerprint,
    answerCollectionMatchByFingerprint,
  }
}

async function findImportPackageDuplicateMatches(
  previewModel: ElementImportPreviewModel,
  ctx: ContextWithUser
): Promise<ElementImportPackageDuplicateMatches> {
  return await findImportPackageDuplicateMatchesByFingerprint(
    {
      elementFingerprints: previewModel.elementFingerprintCandidates.flat(),
      answerCollectionFingerprints:
        previewModel.answerCollectionFingerprints.filter(
          (fingerprint): fingerprint is string => fingerprint !== null
        ),
    },
    ctx
  )
}

export async function buildPreviewWithDuplicateWarnings(
  normalizedPackage: NormalizedImportPackage,
  ctx: ContextWithUser
) {
  const previewModel = createElementImportPreviewModel(normalizedPackage)
  const duplicateMatches = await findImportPackageDuplicateMatches(
    previewModel,
    ctx
  )

  return decorateElementImportPreviewWithDuplicateMatches(
    previewModel,
    duplicateMatches
  )
}

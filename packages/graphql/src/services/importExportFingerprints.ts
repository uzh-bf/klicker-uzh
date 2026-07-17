import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import type { ContextWithUser } from '../lib/context.js'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_FINGERPRINT_VERSION,
  type FingerprintMediaContext,
} from '../lib/importExportFingerprintCanonicalization.js'
import { isSupportedPackageMediaContentType } from '../lib/importExportPackageContract.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  computeAnswerCollectionDidacticFingerprintFromDbV1,
  computeElementDidacticFingerprintFromDbV1,
  refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprintV1,
  type FingerprintPrisma,
} from './importExportFingerprintPersistence.js'
import { downloadKlickerMediaFile } from './mediaStorage.js'

type JsonRecord = Record<string, unknown>

type UploadedMediaFingerprintFinalizationInput = {
  mediaFileId: string
  ownerId: string
}

type ElementFingerprintInvalidationPrisma = Pick<DB.PrismaClient, '$executeRaw'>

type FingerprintRefreshTarget =
  | { elementId: number; answerCollectionId?: never }
  | { answerCollectionId: number; elementId?: never }

export function enqueueImportExportFingerprintRefresh(
  target: FingerprintRefreshTarget,
  ctx: Pick<ContextWithUser, 'tasks'>
) {
  const reportFailure = () =>
    console.warn('[ImportExportFingerprint] REFRESH_ENQUEUE_FAILED')

  try {
    void ctx.tasks.refreshImportExportFingerprints
      .runNoWait(target)
      .catch(reportFailure)
  } catch {
    reportFailure()
  }
}

export async function invalidateElementFingerprintsForFinalizedMediaV1(
  input: { href: string; ownerId: string },
  prisma: ElementFingerprintInvalidationPrisma
) {
  // Incrementing the authored row version fences any refresh snapshot that
  // observed the media before finalization. NULL remains the database-valid,
  // durable stale marker consumed by scheduled repair.
  return await prisma.$executeRaw`
    UPDATE "public"."Element"
    SET "version" = "version" + 1,
        "importFingerprint" = NULL,
        "importFingerprintVersion" = NULL
    WHERE "ownerId" = ${input.ownerId}::uuid
      AND "isDeleted" = false
      AND (
        "importFingerprintVersion" IS NULL
        OR "importFingerprintVersion" = ${IMPORT_EXPORT_FINGERPRINT_VERSION}
      )
      AND (
        strpos("content", ${input.href}) > 0
        OR strpos(COALESCE("explanation", ''), ${input.href}) > 0
        OR strpos("options"::text, ${input.href}) > 0
      )
  `
}

export type FingerprintAnswerCollectionPayload = {
  // Retained for compatibility with existing callers; metadata/history are not
  // part of version-1 didactic identity.
  name?: string
  description?: string
  version?: number | null
  entries: readonly { value: string }[]
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

export type FingerprintElementPayload = {
  // Retained for compatibility with existing callers; names and workflow state
  // are intentionally excluded from version-1 didactic identity.
  name?: string
  content: string
  type: DB.ElementType
  options: JsonRecord
  pointsMultiplier: number
  basePoints: boolean
  explanation?: string | null
  status?: DB.ElementStatus
  answerCollection?: FingerprintAnswerCollectionPayload | null
  selectedAnswerCollectionValues?: readonly string[] | null
  entryValueById?: ReadonlyMap<number, string>
  entryValueByRef?: ReadonlyMap<string, string>
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

const IMPORT_MEDIA_IDENTITY_PATTERN = /^import-media:([a-f0-9]{64})$/

function toMediaContext(
  identityByUrl: ReadonlyMap<string, string> | undefined
): FingerprintMediaContext | undefined {
  if (!identityByUrl || identityByUrl.size === 0) return undefined

  const verifiedByHref = new Map<string, { sha256: string }>()
  const unresolvedHrefs = new Set<string>()

  for (const [href, identity] of identityByUrl) {
    const match = IMPORT_MEDIA_IDENTITY_PATTERN.exec(identity)
    if (match?.[1]) {
      verifiedByHref.set(href, { sha256: match[1] })
    } else {
      unresolvedHrefs.add(href)
    }
  }

  return { verifiedByHref, unresolvedHrefs }
}

export function computeAnswerCollectionImportFingerprint(
  collection: FingerprintAnswerCollectionPayload
) {
  return (
    computeAnswerCollectionDidacticFingerprint({
      entries: collection.entries,
    })?.fingerprint ?? null
  )
}

export function computeElementImportFingerprint(
  element: FingerprintElementPayload
) {
  return (
    computeElementDidacticFingerprint({
      type: element.type,
      content: element.content,
      explanation: element.explanation,
      options: element.options,
      pointsMultiplier: element.pointsMultiplier,
      basePoints: element.basePoints,
      answerPoolValues: element.answerCollection?.entries.map(
        (entry) => entry.value
      ),
      selectedAnswerValues: element.selectedAnswerCollectionValues,
      relationValueById: element.entryValueById,
      relationValueByRef: element.entryValueByRef,
      media: toMediaContext(element.mediaIdentityByUrl),
    })?.fingerprint ?? null
  )
}

export async function computeElementImportFingerprintFromDb(
  elementId: number,
  prisma: FingerprintPrisma
) {
  const snapshot = await computeElementDidacticFingerprintFromDbV1(
    elementId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshElementImportFingerprint(
  elementId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshElementDidacticFingerprintV1(elementId, prisma)
  return result.computed?.fingerprint ?? null
}

export async function computeAnswerCollectionImportFingerprintFromDb(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const snapshot = await computeAnswerCollectionDidacticFingerprintFromDbV1(
    answerCollectionId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshAnswerCollectionImportFingerprint(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshAnswerCollectionDidacticFingerprintV1(
    answerCollectionId,
    prisma
  )
  return result.computed?.fingerprint ?? null
}

export async function finalizeUploadedMediaFingerprintV1(
  input: UploadedMediaFingerprintFinalizationInput,
  prisma: DB.PrismaClient
) {
  const mediaFile = await prisma.mediaFile.findFirst({
    where: { id: input.mediaFileId, ownerId: input.ownerId },
    select: {
      id: true,
      href: true,
      contentHash: true,
      importFingerprintVersion: true,
    },
  })
  if (!mediaFile) return false

  let downloaded: Awaited<ReturnType<typeof downloadKlickerMediaFile>> = null
  let persistOmission = false
  if (
    mediaFile.importFingerprintVersion !== IMPORT_EXPORT_FINGERPRINT_VERSION ||
    mediaFile.contentHash === null
  ) {
    try {
      downloaded = await downloadKlickerMediaFile(mediaFile.href, { prisma })
    } catch (error) {
      if (!(error instanceof MediaExportOmissionError)) throw error
      persistOmission = true
    }

    // A missing blob can still be an upload visibility race. Do not accept or
    // rewrite the snapshot; an idempotent client retry must recheck storage.
    if (!downloaded && !persistOmission) return false
  }

  const contentHash =
    downloaded && isSupportedPackageMediaContentType(downloaded.contentType)
      ? createHash('sha256').update(downloaded.buffer).digest('hex')
      : mediaFile.importFingerprintVersion ===
            IMPORT_EXPORT_FINGERPRINT_VERSION && mediaFile.contentHash !== null
        ? mediaFile.contentHash
        : null
  return await prisma.$transaction(async (tx) => {
    const shouldUpdate =
      mediaFile.importFingerprintVersion !==
        IMPORT_EXPORT_FINGERPRINT_VERSION ||
      (mediaFile.contentHash === null && contentHash !== null)
    const updated = shouldUpdate
      ? await tx.mediaFile.updateMany({
          where: {
            id: mediaFile.id,
            ownerId: input.ownerId,
            href: mediaFile.href,
            OR: [
              { importFingerprintVersion: null },
              {
                importFingerprintVersion: {
                  not: IMPORT_EXPORT_FINGERPRINT_VERSION,
                },
              },
              ...(contentHash === null
                ? []
                : [
                    {
                      importFingerprintVersion:
                        IMPORT_EXPORT_FINGERPRINT_VERSION,
                      contentHash: null,
                    },
                  ]),
            ],
          },
          data: {
            contentHash,
            importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
          },
        })
      : { count: 0 }
    if (updated.count !== 1) {
      const exactTargetAlreadyPersisted =
        (await tx.mediaFile.count({
          where: {
            id: mediaFile.id,
            ownerId: input.ownerId,
            href: mediaFile.href,
            importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
            contentHash,
          },
        })) === 1
      if (!exactTargetAlreadyPersisted) return false

      // A genuinely idempotent rerun observed the current target before any
      // work and must not bump referencing element versions again. When this
      // invocation did need an update, however, an exact concurrent writer
      // won the compare-and-set and this transaction still owns the required
      // fingerprint invalidation.
      if (!shouldUpdate) return true
    }

    // The media transition and invalidation are one transaction. A retry that
    // observes an already-current media row skips this update, keeping the
    // element version bump idempotent.
    await invalidateElementFingerprintsForFinalizedMediaV1(
      { href: mediaFile.href, ownerId: input.ownerId },
      tx
    )

    return true
  })
}

import * as DB from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import {
  computeAnswerCollectionDidacticFingerprint,
  computeElementDidacticFingerprint,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
  type FingerprintMediaContext,
  type VersionedDidacticFingerprint,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  createPendingDirectUploadOriginalId,
  hasDirectUploadLifecycleMarker,
  isPendingDirectUploadMedia,
  resolveKlickerMediaHref,
} from '../lib/importExportMediaIdentity.js'
import {
  collectElementMediaHrefs,
  MediaReferenceKind,
} from '../lib/importExportMediaReferences.js'
import { MAX_DIRECT_MEDIA_UPLOAD_BYTES } from '../lib/importExportPackageConfig.js'
import { isSupportedPackageMediaContentType } from '../lib/importExportPackageContract.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  computeAnswerCollectionDidacticFingerprintFromDb,
  computeElementDidacticFingerprintFromDb,
  refreshAnswerCollectionDidacticFingerprint,
  refreshElementDidacticFingerprint,
  refreshLinkedElementDidacticFingerprintPages,
  type FingerprintBatchPrisma,
  type FingerprintPrisma,
} from './importExportFingerprintPersistence.js'
import { downloadKlickerMediaFile } from './mediaStorageTargets.js'

type JsonRecord = Record<string, unknown>

type UploadedMediaFingerprintFinalizationInput = {
  mediaFileId: string
  ownerId: string
}

type ElementFingerprintInvalidationPrisma = Pick<DB.PrismaClient, '$queryRaw'>

type FinalizedMediaFingerprintPrisma = FingerprintPrisma &
  Pick<DB.PrismaClient, '$executeRaw' | '$queryRaw'>

type ElementFingerprintDependencyPrisma = Pick<DB.PrismaClient, '$queryRaw'>

export async function lockElementFingerprintDependencies(
  input: {
    answerCollectionId?: number | null
    type: DB.ElementType
    content: string
    explanation?: string | null
    options: unknown
    requireVerifiedMedia?: boolean
  },
  prisma: ElementFingerprintDependencyPrisma
) {
  if (typeof input.answerCollectionId === 'number') {
    await prisma.$queryRaw`
      SELECT "id"
      FROM "public"."AnswerCollection"
      WHERE "id" = ${input.answerCollectionId}
      FOR SHARE
    `
  }

  const resolvedMedia = Array.from(
    new Map(
      collectElementMediaHrefs(input, MediaReferenceKind.AUTO_LOAD).flatMap(
        (href) => {
          const resolved = resolveKlickerMediaHref(href)
          return resolved ? [[resolved.canonicalHref, resolved] as const] : []
        }
      )
    ).values()
  ).sort((left, right) => left.canonicalHref.localeCompare(right.canonicalHref))
  if (resolvedMedia.length === 0) return

  const mediaFiles = await prisma.$queryRaw<
    Array<{
      id: string
      href: string
      ownerId: string
      originalId: string | null
      contentHash: string | null
      importFingerprintVersion: number | null
    }>
  >`
    SELECT "id", "href", "ownerId", "originalId", "contentHash",
           "importFingerprintVersion"
    FROM "public"."MediaFile"
    WHERE "href" IN (${DB.Prisma.join(
      resolvedMedia.map(({ canonicalHref }) => canonicalHref)
    )})
    ORDER BY "id" ASC
    FOR SHARE
  `
  const mediaFileByHref = new Map(
    mediaFiles.map((mediaFile) => [mediaFile.href, mediaFile])
  )
  const unresolved = resolvedMedia.some((resolved) => {
    const mediaFile = mediaFileByHref.get(resolved.canonicalHref)
    if (!mediaFile) return input.requireVerifiedMedia !== false
    if (hasDirectUploadLifecycleMarker(mediaFile.originalId)) return true
    if (input.requireVerifiedMedia === false) return false
    return (
      mediaFile.ownerId !== resolved.ownerId ||
      mediaFile.importFingerprintVersion !==
        IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION ||
      (mediaFile.contentHash !== null &&
        !/^[a-f0-9]{64}$/.test(mediaFile.contentHash))
    )
  })
  if (unresolved) {
    throw new Error(
      'Element references first-party media that has not been finalized.'
    )
  }
}

export async function invalidateElementFingerprintsForFinalizedMediaV1(
  input: { href: string },
  prisma: ElementFingerprintInvalidationPrisma
) {
  // The transaction ID is a monotonic, epoch-extended value. Encoding it as a
  // fingerprint-shaped token makes every committed invalidation a new CAS
  // state without mutating the authored revision or modification timestamp.
  return await prisma.$queryRaw<Array<{ id: number }>>`
    UPDATE "public"."Element"
    SET "importFingerprint" = lpad(to_hex(txid_current()), 64, '0'),
        "importFingerprintVersion" = NULL
    WHERE "isDeleted" = false
      AND (
        strpos("content", ${input.href}) > 0
        OR strpos(COALESCE("explanation", ''), ${input.href}) > 0
        OR strpos("options"::text, ${input.href}) > 0
      )
    RETURNING "id"
  `
}

const ENSURE_FINGERPRINT_MAX_ATTEMPTS = 3
const LINKED_ELEMENT_FINGERPRINT_BATCH_SIZE = 100

async function ensureFingerprintCurrent(
  resource: 'answer collection' | 'element',
  id: number,
  refresh: () => Promise<
    | {
        status: 'updated' | 'unchanged' | 'stale'
        computed: VersionedDidacticFingerprint
      }
    | { status: 'missing'; computed: null }
  >
) {
  for (let attempt = 0; attempt < ENSURE_FINGERPRINT_MAX_ATTEMPTS; attempt++) {
    const result = await refresh()
    if (result.status === 'missing') {
      throw new Error(`Cannot fingerprint missing ${resource} ${id}.`)
    }
    if (result.status !== 'stale') return result.computed
  }

  throw new Error(
    `Could not persist a current import/export fingerprint for ${resource} ${id}.`
  )
}

export async function ensureElementFingerprintCurrent(
  elementId: number,
  prisma: FingerprintPrisma
) {
  return await ensureFingerprintCurrent('element', elementId, () =>
    refreshElementDidacticFingerprint(elementId, prisma)
  )
}

export async function ensureAnswerCollectionFingerprintCurrent(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  return await ensureFingerprintCurrent(
    'answer collection',
    answerCollectionId,
    () => refreshAnswerCollectionDidacticFingerprint(answerCollectionId, prisma)
  )
}

export async function ensureAnswerCollectionAndLinkedElementFingerprintsCurrent(
  answerCollectionId: number,
  prisma: FingerprintBatchPrisma
) {
  await ensureAnswerCollectionFingerprintCurrent(answerCollectionId, prisma)

  const result = await refreshLinkedElementDidacticFingerprintPages(
    answerCollectionId,
    prisma
  )
  if (!result) {
    throw new Error(
      `Cannot fingerprint missing answer collection ${answerCollectionId}.`
    )
  }
  for (const elementId of result.staleElementIds) {
    await ensureElementFingerprintCurrent(elementId, prisma)
  }
}

export async function invalidateAndRefreshElementFingerprintsForFinalizedMediaV1(
  input: { href: string },
  prisma: FinalizedMediaFingerprintPrisma
) {
  const invalidated = await invalidateElementFingerprintsForFinalizedMediaV1(
    input,
    prisma
  )
  for (
    let offset = 0;
    offset < invalidated.length;
    offset += LINKED_ELEMENT_FINGERPRINT_BATCH_SIZE
  ) {
    for (const element of invalidated.slice(
      offset,
      offset + LINKED_ELEMENT_FINGERPRINT_BATCH_SIZE
    )) {
      await ensureElementFingerprintCurrent(element.id, prisma)
    }
  }

  return invalidated.length
}

export type FingerprintAnswerCollectionPayload = {
  // Retained for compatibility with existing callers; metadata/history are not
  // part of didactic identity.
  name?: string
  description?: string
  version?: number | null
  entries: readonly { value: string }[]
  mediaIdentityByUrl?: ReadonlyMap<string, string>
}

export type FingerprintElementPayload = {
  // Retained for compatibility with existing callers; names and workflow state
  // are intentionally excluded from didactic identity.
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

  for (const [href, identity] of identityByUrl) {
    const match = IMPORT_MEDIA_IDENTITY_PATTERN.exec(identity)
    if (match?.[1]) {
      verifiedByHref.set(href, { sha256: match[1] })
    }
  }

  return { verifiedByHref }
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
  const snapshot = await computeElementDidacticFingerprintFromDb(
    elementId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshElementImportFingerprint(
  elementId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshElementDidacticFingerprint(elementId, prisma)
  return result.computed?.fingerprint ?? null
}

export async function computeAnswerCollectionImportFingerprintFromDb(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const snapshot = await computeAnswerCollectionDidacticFingerprintFromDb(
    answerCollectionId,
    prisma
  )
  return snapshot?.computed?.fingerprint ?? null
}

export async function refreshAnswerCollectionImportFingerprint(
  answerCollectionId: number,
  prisma: FingerprintPrisma
) {
  const result = await refreshAnswerCollectionDidacticFingerprint(
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
      originalId: true,
      contentHash: true,
      importFingerprintVersion: true,
    },
  })
  if (!mediaFile) return false
  const pendingOriginalId = createPendingDirectUploadOriginalId(mediaFile.id)
  const isPendingDirectUpload = isPendingDirectUploadMedia(mediaFile)
  if (
    hasDirectUploadLifecycleMarker(mediaFile.originalId) &&
    !isPendingDirectUpload
  ) {
    return false
  }

  let downloaded: Awaited<ReturnType<typeof downloadKlickerMediaFile>> = null
  let persistOmission = false
  if (
    mediaFile.importFingerprintVersion !==
      IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION ||
    mediaFile.contentHash === null
  ) {
    try {
      downloaded = await downloadKlickerMediaFile(mediaFile.href, { prisma })
    } catch (error) {
      if (!(error instanceof MediaExportOmissionError)) throw error
      // A pending zero/indeterminate-length object is not a valid completed
      // upload. Keep its marker so the client can report failure and bounded
      // cleanup can remove the abandoned row/blob. An object above the export
      // limit but within the absolute direct-upload limit is valid authored
      // media with a deterministic export omission.
      if (
        isPendingDirectUpload &&
        (error.kind === 'unknown-size' ||
          typeof error.contentLength !== 'number' ||
          !Number.isSafeInteger(error.contentLength) ||
          error.contentLength > MAX_DIRECT_MEDIA_UPLOAD_BYTES)
      ) {
        return false
      }
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
            IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION &&
          mediaFile.contentHash !== null
        ? mediaFile.contentHash
        : null
  return await prisma.$transaction(
    async (tx) => {
      const shouldUpdate =
        isPendingDirectUpload ||
        mediaFile.importFingerprintVersion !==
          IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION ||
        (mediaFile.contentHash === null && contentHash !== null)
      const updated = shouldUpdate
        ? await tx.mediaFile.updateMany({
            where: {
              id: mediaFile.id,
              ownerId: input.ownerId,
              href: mediaFile.href,
              originalId: mediaFile.originalId,
              OR: [
                ...(isPendingDirectUpload
                  ? [{ originalId: pendingOriginalId }]
                  : []),
                { importFingerprintVersion: null },
                {
                  importFingerprintVersion: {
                    not: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
                  },
                },
                ...(contentHash === null
                  ? []
                  : [
                      {
                        importFingerprintVersion:
                          IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
                        contentHash: null,
                      },
                    ]),
              ],
            },
            data: {
              ...(isPendingDirectUpload ? { originalId: null } : {}),
              contentHash,
              importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
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
              originalId: isPendingDirectUpload ? null : mediaFile.originalId,
              importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
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

      // New direct uploads cannot have been referenced by a persisted element:
      // element writes lock and reject their pending media row. Historical or
      // previously classified rows lack the one-shot marker, so a late change
      // from omission to verified bytes must refresh existing references.
      if (!isPendingDirectUpload) {
        await invalidateAndRefreshElementFingerprintsForFinalizedMediaV1(
          { href: mediaFile.href },
          tx
        )
      }

      return true
    },
    { timeout: 60_000 }
  )
}

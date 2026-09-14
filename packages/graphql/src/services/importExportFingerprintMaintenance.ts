import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlers,
  ImportExportFingerprintRefreshResult,
  ImportExportFingerprintRepairResult,
  RefreshImportExportFingerprintsInput,
} from '@klicker-uzh/types'
import { createHash } from 'node:crypto'
import {
  IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
  IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
} from '../lib/importExportFingerprintCanonicalization.js'
import {
  DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
  DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
} from '../lib/importExportMediaIdentity.js'
import { isSupportedPackageMediaContentType } from '../lib/importExportPackageContract.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  refreshAnswerCollectionDidacticFingerprint,
  refreshElementDidacticFingerprint,
  type FingerprintPrisma,
} from './importExportFingerprintPersistence.js'
import { downloadKlickerMediaFile } from './mediaStorageTargets.js'

const FINGERPRINT_BATCH_SIZE = 100
const FINGERPRINT_REPAIR_MAX_BATCHES_PER_RESOURCE = 5
const MEDIA_HASH_BATCH_SIZE = 50
const CONCURRENCY = 10
const FINGERPRINT_PERSISTENCE_MAX_ATTEMPTS = 3
export const SEED_FINGERPRINT_BOOTSTRAP_MAX_PASSES = 10
export const SEED_FINGERPRINT_BOOTSTRAP_RUNTIME_BUDGET_MS = 4 * 60 * 1000
export const IMPORT_EXPORT_FINGERPRINT_REFRESH_RUNTIME_BUDGET_MS = 4 * 60 * 1000
export const IMPORT_EXPORT_FINGERPRINT_REPAIR_RUNTIME_BUDGET_MS = 8 * 60 * 1000
export type ImportExportFingerprintStopReason = 'budget' | 'cancelled'

type FingerprintBackfillInput = {
  resource: 'ANSWER_COLLECTION' | 'ELEMENT'
  afterId?: number
}

type FingerprintBackfillResult = {
  processed: number
  nextAfterId?: number
}

type FingerprintWhere = {
  OR: Array<
    | { importFingerprint: null }
    | { importFingerprintVersion: null }
    | { importFingerprintVersion: { not: number } }
  >
}

type MediaHashBackfillInput = {
  afterId?: string
}

type MediaHashBackfillResult = {
  processed: number
  nextAfterId?: string
}

function staleFingerprintWhere(): FingerprintWhere {
  return {
    OR: [
      { importFingerprint: null },
      { importFingerprintVersion: null },
      {
        importFingerprintVersion: {
          not: IMPORT_EXPORT_DIDACTIC_FINGERPRINT_VERSION,
        },
      },
    ],
  }
}

async function refreshFingerprintUntilCurrent(
  resource: FingerprintBackfillInput['resource'],
  id: number,
  prisma: FingerprintPrisma,
  assertCanPersist: () => void = () => undefined
) {
  for (
    let attempt = 0;
    attempt < FINGERPRINT_PERSISTENCE_MAX_ATTEMPTS;
    attempt += 1
  ) {
    assertCanPersist()
    const result =
      resource === 'ANSWER_COLLECTION'
        ? await refreshAnswerCollectionDidacticFingerprint(id, prisma)
        : await refreshElementDidacticFingerprint(id, prisma)
    if (result.status === 'missing' || result.status !== 'stale') return
  }

  throw new Error(
    `Could not persist a current import/export fingerprint for ${resource.toLowerCase()} ${id}.`
  )
}

async function hasStaleFingerprints(
  resource: FingerprintBackfillInput['resource'],
  prisma: FingerprintPrisma
) {
  const where = { isDeleted: false, ...staleFingerprintWhere() }
  const stale =
    resource === 'ANSWER_COLLECTION'
      ? await prisma.answerCollection.findFirst({ where, select: { id: true } })
      : await prisma.element.findFirst({ where, select: { id: true } })

  return stale !== null
}

async function repairFingerprintResource(
  resource: FingerprintBackfillInput['resource'],
  prisma: FingerprintPrisma,
  shouldStop: () => boolean,
  assertCanPersist: () => void
) {
  let processed = 0
  let afterId: number | undefined

  for (
    let batch = 0;
    batch < FINGERPRINT_REPAIR_MAX_BATCHES_PER_RESOURCE;
    batch += 1
  ) {
    if (shouldStop()) break
    const result = await processFingerprintBatch(
      { resource, afterId },
      prisma,
      staleFingerprintWhere(),
      shouldStop,
      assertCanPersist
    )
    processed += result.processed

    if (shouldStop()) break
    if (typeof result.nextAfterId !== 'number') {
      break
    }
    afterId = result.nextAfterId
  }

  return processed
}

async function runInChunks<T>(
  values: readonly T[],
  operation: (value: T) => Promise<unknown>,
  shouldStop: () => boolean = () => false
) {
  let processed = 0
  for (let index = 0; index < values.length; index += CONCURRENCY) {
    if (shouldStop()) break
    const chunk = values.slice(index, index + CONCURRENCY)
    const results = await Promise.allSettled(chunk.map(operation))
    const failure = results.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    )
    if (failure) throw failure.reason
    processed += chunk.length
  }
  return processed
}

export async function refreshImportExportFingerprintBatch(
  input: RefreshImportExportFingerprintsInput,
  prisma: FingerprintPrisma,
  shouldStop: () => boolean = () => false
): Promise<ImportExportFingerprintRefreshResult> {
  let processed = 0

  if (shouldStop()) return { processed: 0, stoppedEarly: true }

  if ('elementId' in input) {
    await refreshFingerprintUntilCurrent('ELEMENT', input.elementId, prisma)
    return { processed: 1 }
  }

  if (typeof input.afterElementId === 'undefined') {
    await refreshFingerprintUntilCurrent(
      'ANSWER_COLLECTION',
      input.answerCollectionId,
      prisma
    )
    processed += 1
  }

  if (shouldStop()) return { processed, stoppedEarly: true }

  const elements = await prisma.element.findMany({
    where: {
      answerCollectionId: input.answerCollectionId,
      isDeleted: false,
      id:
        typeof input.afterElementId === 'number'
          ? { gt: input.afterElementId }
          : undefined,
      ...staleFingerprintWhere(),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: FINGERPRINT_BATCH_SIZE,
  })

  const processedElements = await runInChunks(
    elements,
    ({ id }) => refreshFingerprintUntilCurrent('ELEMENT', id, prisma),
    shouldStop
  )
  processed += processedElements

  const stoppedEarly = processedElements < elements.length || shouldStop()

  return {
    processed,
    ...(stoppedEarly ? { stoppedEarly: true as const } : {}),
    nextAfterElementId:
      !stoppedEarly && elements.length === FINGERPRINT_BATCH_SIZE
        ? elements.at(-1)?.id
        : undefined,
  }
}

async function processFingerprintBatch(
  input: FingerprintBackfillInput,
  prisma: FingerprintPrisma,
  fingerprintWhere: FingerprintWhere | Record<string, never>,
  shouldStop: () => boolean = () => false,
  assertCanPersist: () => void = () => undefined
): Promise<FingerprintBackfillResult> {
  if (shouldStop()) return { processed: 0 }

  if (input.resource === 'ANSWER_COLLECTION') {
    const collections = await prisma.answerCollection.findMany({
      where: {
        isDeleted: false,
        id:
          typeof input.afterId === 'number' ? { gt: input.afterId } : undefined,
        ...fingerprintWhere,
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: FINGERPRINT_BATCH_SIZE,
    })
    const processed = await runInChunks(
      collections,
      ({ id }) =>
        refreshFingerprintUntilCurrent(
          'ANSWER_COLLECTION',
          id,
          prisma,
          assertCanPersist
        ),
      shouldStop
    )
    return {
      processed,
      nextAfterId:
        processed > 0 &&
        (processed < collections.length ||
          collections.length === FINGERPRINT_BATCH_SIZE)
          ? collections[processed - 1]?.id
          : undefined,
    }
  }

  const elements = await prisma.element.findMany({
    where: {
      isDeleted: false,
      id: typeof input.afterId === 'number' ? { gt: input.afterId } : undefined,
      ...fingerprintWhere,
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: FINGERPRINT_BATCH_SIZE,
  })
  const processed = await runInChunks(
    elements,
    ({ id }) =>
      refreshFingerprintUntilCurrent('ELEMENT', id, prisma, assertCanPersist),
    shouldStop
  )
  return {
    processed,
    nextAfterId:
      processed > 0 &&
      (processed < elements.length ||
        elements.length === FINGERPRINT_BATCH_SIZE)
        ? elements[processed - 1]?.id
        : undefined,
  }
}

export async function backfillFingerprintBatch(
  input: FingerprintBackfillInput,
  prisma: FingerprintPrisma,
  assertCanPersist: () => void = () => undefined
): Promise<FingerprintBackfillResult> {
  // The one-time rollout deliberately revisits every active row after media
  // classification. A concurrent repair may already have stored a current
  // omission fingerprint before the media hash became available; filtering by
  // stale markers would otherwise preserve that obsolete identity.
  return await processFingerprintBatch(
    input,
    prisma,
    {},
    () => false,
    assertCanPersist
  )
}

export async function repairStaleImportExportFingerprints(
  prisma: FingerprintPrisma,
  getStopReason: () => ImportExportFingerprintStopReason | null = () => null,
  assertCanPersist: () => void = () => undefined
): Promise<ImportExportFingerprintRepairResult> {
  let stopReason: ImportExportFingerprintStopReason | null = null
  const shouldStop = () => {
    const reason = getStopReason()
    if (reason && stopReason === null) stopReason = reason
    return stopReason !== null
  }
  const processedAnswerCollections = await repairFingerprintResource(
    'ANSWER_COLLECTION',
    prisma,
    shouldStop,
    assertCanPersist
  )
  const processedElements = shouldStop()
    ? 0
    : await repairFingerprintResource(
        'ELEMENT',
        prisma,
        shouldStop,
        assertCanPersist
      )
  shouldStop()
  const [answerCollectionBacklogRemaining, elementBacklogRemaining] =
    stopReason === 'cancelled'
      ? [true, true]
      : await Promise.all([
          hasStaleFingerprints('ANSWER_COLLECTION', prisma),
          hasStaleFingerprints('ELEMENT', prisma),
        ])
  const stoppedEarly = shouldStop()

  return {
    processedAnswerCollections,
    processedElements,
    answerCollectionBacklogRemaining,
    elementBacklogRemaining,
    ...(stoppedEarly ? { stoppedEarly: true as const } : {}),
  }
}

export async function bootstrapSeededImportExportFingerprints(
  prisma: FingerprintPrisma,
  {
    maxPasses = SEED_FINGERPRINT_BOOTSTRAP_MAX_PASSES,
    runtimeBudgetMs = SEED_FINGERPRINT_BOOTSTRAP_RUNTIME_BUDGET_MS,
    now = Date.now,
    assertCanPersist = () => undefined,
  }: {
    maxPasses?: number
    runtimeBudgetMs?: number
    now?: () => number
    assertCanPersist?: () => void
  } = {}
) {
  if (!Number.isSafeInteger(maxPasses) || maxPasses <= 0) {
    throw new Error('Seed fingerprint bootstrap maxPasses must be positive.')
  }
  if (!Number.isSafeInteger(runtimeBudgetMs) || runtimeBudgetMs <= 0) {
    throw new Error(
      'Seed fingerprint bootstrap runtimeBudgetMs must be positive.'
    )
  }

  const deadline = now() + runtimeBudgetMs
  let repairPasses = 0
  let processedAnswerCollections = 0
  let processedElements = 0
  while (repairPasses < maxPasses) {
    const repair = await repairStaleImportExportFingerprints(
      prisma,
      () => (now() >= deadline ? 'budget' : null),
      assertCanPersist
    )
    repairPasses += 1
    processedAnswerCollections += repair.processedAnswerCollections
    processedElements += repair.processedElements

    if (
      !repair.answerCollectionBacklogRemaining &&
      !repair.elementBacklogRemaining
    ) {
      return {
        repairPasses,
        processedAnswerCollections,
        processedElements,
      }
    }

    if (
      repair.stoppedEarly ||
      (repair.processedAnswerCollections === 0 &&
        repair.processedElements === 0)
    ) {
      break
    }
  }

  throw new Error(
    'Seed fingerprint repair reached its bounded limit. Run the guarded import/export rollout backfill before retrying the seed.'
  )
}

export async function backfillMediaHashBatch(
  input: MediaHashBackfillInput,
  prisma: PrismaClient,
  assertCanPersist: () => void = () => undefined
): Promise<MediaHashBackfillResult> {
  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      AND: [
        {
          OR: [
            { importFingerprintVersion: null },
            {
              importFingerprintVersion: {
                not: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
              },
            },
          ],
        },
        {
          OR: [
            { originalId: null },
            {
              AND: [
                {
                  NOT: {
                    originalId: {
                      startsWith: DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
                    },
                  },
                },
                {
                  NOT: {
                    originalId: {
                      startsWith: DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
      id: input.afterId ? { gt: input.afterId } : undefined,
    },
    select: { id: true, href: true, originalId: true },
    orderBy: { id: 'asc' },
    take: MEDIA_HASH_BATCH_SIZE,
  })

  if (typeof input.afterId === 'undefined' && mediaFiles.length > 0) {
    assertCanPersist()
    await prisma.$executeRaw`
      UPDATE "public"."Element"
      SET "importFingerprint" = lpad(to_hex(txid_current()), 64, '0'),
          "importFingerprintVersion" = NULL
      WHERE "isDeleted" = false
    `
  }

  await runInChunks(mediaFiles, async (mediaFile) => {
    let downloaded: Awaited<ReturnType<typeof downloadKlickerMediaFile>> = null
    try {
      downloaded = await downloadKlickerMediaFile(mediaFile.href, { prisma })
    } catch (error) {
      if (!(error instanceof MediaExportOmissionError)) throw error
    }

    const contentHash =
      downloaded && isSupportedPackageMediaContentType(downloaded.contentType)
        ? createHash('sha256').update(downloaded.buffer).digest('hex')
        : null
    assertCanPersist()
    await prisma.mediaFile.updateMany({
      where: {
        id: mediaFile.id,
        href: mediaFile.href,
        originalId: mediaFile.originalId,
        OR: [
          { importFingerprintVersion: null },
          {
            importFingerprintVersion: {
              not: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
            },
          },
        ],
      },
      data: {
        contentHash,
        importFingerprintVersion: IMPORT_EXPORT_MEDIA_FINGERPRINT_VERSION,
      },
    })
  })

  return {
    processed: mediaFiles.length,
    nextAfterId:
      mediaFiles.length === MEDIA_HASH_BATCH_SIZE
        ? mediaFiles.at(-1)?.id
        : undefined,
  }
}

export const handleRefreshImportExportFingerprints: HatchetHandlers['handleRefreshImportExportFingerprints'] =
  async (input, globalCtx, executionCtx) => {
    const deadline =
      Date.now() + IMPORT_EXPORT_FINGERPRINT_REFRESH_RUNTIME_BUDGET_MS
    const result = await refreshImportExportFingerprintBatch(
      input,
      globalCtx.prisma,
      () =>
        executionCtx.abortController.signal.aborted || Date.now() >= deadline
    )
    if (executionCtx.abortController.signal.aborted) {
      throw new Error('Import/export fingerprint refresh was cancelled.')
    }
    return result
  }

export const handleRepairImportExportFingerprints: HatchetHandlers['handleRepairImportExportFingerprints'] =
  async (_, globalCtx, executionCtx) => {
    const deadline =
      Date.now() + IMPORT_EXPORT_FINGERPRINT_REPAIR_RUNTIME_BUDGET_MS
    const result = await repairStaleImportExportFingerprints(
      globalCtx.prisma,
      () =>
        executionCtx.abortController.signal.aborted
          ? 'cancelled'
          : Date.now() >= deadline
            ? 'budget'
            : null
    )
    if (executionCtx.abortController.signal.aborted) {
      throw new Error('Import/export fingerprint repair was cancelled.')
    }
    await executionCtx.logger.info(
      result.stoppedEarly
        ? 'Import/export fingerprint repair reached its work budget'
        : 'Import/export fingerprint repair completed',
      result
    )
    return result
  }

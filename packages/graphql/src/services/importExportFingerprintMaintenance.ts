import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  HatchetHandlerGlobalContext,
  ImportExportFingerprintRefreshResult,
  RefreshImportExportFingerprintsInput,
} from '@klicker-uzh/types'
import { createHash } from 'node:crypto'
import { IMPORT_EXPORT_FINGERPRINT_VERSION } from '../lib/importExportFingerprintCanonicalization.js'
import { isSupportedPackageMediaContentType } from '../lib/importExportPackageContract.js'
import { MediaExportOmissionError } from '../lib/mediaErrors.js'
import {
  refreshAnswerCollectionDidacticFingerprintV1,
  refreshElementDidacticFingerprintV1,
  type FingerprintPrisma,
} from './importExportFingerprintPersistence.js'
import { downloadKlickerMediaFile } from './mediaStorage.js'

const FINGERPRINT_BATCH_SIZE = 100
const MEDIA_HASH_BATCH_SIZE = 50
const CONCURRENCY = 10

type FingerprintBackfillInput = {
  resource: 'ANSWER_COLLECTION' | 'ELEMENT'
  afterId?: number
}

type FingerprintBackfillResult = {
  processed: number
  nextAfterId?: number
}

type MediaHashBackfillInput = {
  afterId?: string
}

type MediaHashBackfillResult = {
  processed: number
  nextAfterId?: string
}

function staleFingerprintWhere() {
  return {
    OR: [
      { importFingerprint: null },
      { importFingerprintVersion: null },
      {
        importFingerprintVersion: {
          not: IMPORT_EXPORT_FINGERPRINT_VERSION,
        },
      },
    ],
  }
}

async function runInChunks<T>(
  values: readonly T[],
  operation: (value: T) => Promise<unknown>
) {
  for (let index = 0; index < values.length; index += CONCURRENCY) {
    await Promise.all(values.slice(index, index + CONCURRENCY).map(operation))
  }
}

export async function refreshAnswerCollectionFingerprintBatch(
  input: RefreshImportExportFingerprintsInput,
  prisma: FingerprintPrisma
): Promise<ImportExportFingerprintRefreshResult> {
  let processed = 0

  if (typeof input.afterElementId === 'undefined') {
    await refreshAnswerCollectionDidacticFingerprintV1(
      input.answerCollectionId,
      prisma
    )
    processed += 1
  }

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

  await runInChunks(elements, ({ id }) =>
    refreshElementDidacticFingerprintV1(id, prisma)
  )
  processed += elements.length

  return {
    processed,
    nextAfterElementId:
      elements.length === FINGERPRINT_BATCH_SIZE
        ? elements.at(-1)?.id
        : undefined,
  }
}

export async function backfillFingerprintBatch(
  input: FingerprintBackfillInput,
  prisma: FingerprintPrisma
): Promise<FingerprintBackfillResult> {
  if (input.resource === 'ANSWER_COLLECTION') {
    const collections = await prisma.answerCollection.findMany({
      where: {
        isDeleted: false,
        id:
          typeof input.afterId === 'number' ? { gt: input.afterId } : undefined,
        ...staleFingerprintWhere(),
      },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: FINGERPRINT_BATCH_SIZE,
    })
    await runInChunks(collections, ({ id }) =>
      refreshAnswerCollectionDidacticFingerprintV1(id, prisma)
    )
    return {
      processed: collections.length,
      nextAfterId:
        collections.length === FINGERPRINT_BATCH_SIZE
          ? collections.at(-1)?.id
          : undefined,
    }
  }

  const elements = await prisma.element.findMany({
    where: {
      isDeleted: false,
      id: typeof input.afterId === 'number' ? { gt: input.afterId } : undefined,
      ...staleFingerprintWhere(),
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: FINGERPRINT_BATCH_SIZE,
  })
  await runInChunks(elements, ({ id }) =>
    refreshElementDidacticFingerprintV1(id, prisma)
  )
  return {
    processed: elements.length,
    nextAfterId:
      elements.length === FINGERPRINT_BATCH_SIZE
        ? elements.at(-1)?.id
        : undefined,
  }
}

export async function backfillMediaHashBatch(
  input: MediaHashBackfillInput,
  prisma: PrismaClient
): Promise<MediaHashBackfillResult> {
  const mediaFiles = await prisma.mediaFile.findMany({
    where: {
      OR: [
        { importFingerprintVersion: null },
        {
          importFingerprintVersion: {
            not: IMPORT_EXPORT_FINGERPRINT_VERSION,
          },
        },
      ],
      id: input.afterId ? { gt: input.afterId } : undefined,
    },
    select: { id: true, href: true },
    orderBy: { id: 'asc' },
    take: MEDIA_HASH_BATCH_SIZE,
  })

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
    await prisma.mediaFile.updateMany({
      where: {
        id: mediaFile.id,
        href: mediaFile.href,
        OR: [
          { importFingerprintVersion: null },
          {
            importFingerprintVersion: {
              not: IMPORT_EXPORT_FINGERPRINT_VERSION,
            },
          },
        ],
      },
      data: {
        contentHash,
        importFingerprintVersion: IMPORT_EXPORT_FINGERPRINT_VERSION,
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

export async function handleRefreshImportExportFingerprints(
  input: RefreshImportExportFingerprintsInput,
  globalCtx: HatchetHandlerGlobalContext
) {
  return await refreshAnswerCollectionFingerprintBatch(input, globalCtx.prisma)
}

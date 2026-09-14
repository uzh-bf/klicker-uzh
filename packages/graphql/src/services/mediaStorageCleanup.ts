import {
  ImportMediaStagingState,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  createDirectUploadCleanupOriginalId,
  DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
  DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
  isDirectUploadCleanupMedia,
  isPendingDirectUploadMedia,
} from '../lib/importExportMediaIdentity.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { isCanonicalImportedMediaTarget } from './importExportMediaBlobStore.js'
import { findExpiredImportMediaStagingForCleanup } from './importExportPersistence.js'
import { withLiveImportMediaLease } from './mediaStorageStaging.js'
import {
  deleteImportedMediaFile,
  deleteImportedMediaTarget,
  isImportExportMediaStorageConfigured,
  resolveKlickerMediaHref,
} from './mediaStorageTargets.js'

export const ABANDONED_DIRECT_UPLOAD_MIN_AGE_MS = 60 * 60 * 1000
const DIRECT_UPLOAD_CLEANUP_BATCH_SIZE = 100
const DIRECT_UPLOAD_MAX_CLEANUP_BATCHES = 10

export async function cleanupAbandonedDirectMediaUploads({
  prisma,
  now = new Date(),
  dryRun = false,
  shouldStop = () => false,
}: {
  prisma: PrismaClient
  now?: Date
  dryRun?: boolean
  shouldStop?: () => boolean
}) {
  const createdBefore = new Date(
    now.getTime() - ABANDONED_DIRECT_UPLOAD_MIN_AGE_MS
  )
  let deletedDirectUploadBlobs = 0
  let deletedDirectUploadRows = 0
  let wouldDeleteDirectUploads = 0
  let failedDirectUploadCleanups = 0
  let unsafeDirectUploadTargets = 0
  let directUploadCleanupBatches = 0
  let directUploadCleanupStoppedEarly = false
  const attemptedIds: string[] = []

  const findCandidates = async (take: number) =>
    await prisma.mediaFile.findMany({
      where: {
        createdAt: { lte: createdBefore },
        id: attemptedIds.length > 0 ? { notIn: attemptedIds } : undefined,
        OR: [
          {
            originalId: {
              startsWith: DIRECT_UPLOAD_PENDING_ORIGINAL_ID_PREFIX,
            },
          },
          {
            originalId: {
              startsWith: DIRECT_UPLOAD_CLEANUP_ORIGINAL_ID_PREFIX,
            },
          },
        ],
      },
      select: {
        id: true,
        href: true,
        ownerId: true,
        originalId: true,
        createdAt: true,
      },
      orderBy: { id: 'asc' },
      take,
    })

  for (let batch = 0; batch < DIRECT_UPLOAD_MAX_CLEANUP_BATCHES; batch++) {
    if (shouldStop()) {
      directUploadCleanupStoppedEarly = true
      break
    }
    const candidates = await findCandidates(DIRECT_UPLOAD_CLEANUP_BATCH_SIZE)
    if (candidates.length === 0) break
    directUploadCleanupBatches++

    for (const candidate of candidates) {
      if (shouldStop()) {
        directUploadCleanupStoppedEarly = true
        break
      }
      attemptedIds.push(candidate.id)
      const isPending = isPendingDirectUploadMedia(candidate)
      const isClaimed = isDirectUploadCleanupMedia(candidate)
      const target = resolveKlickerMediaHref(candidate.href)
      if (
        (!isPending && !isClaimed) ||
        !target ||
        target.storage !== 'azure' ||
        target.canonicalHref !== candidate.href ||
        target.ownerId !== candidate.ownerId
      ) {
        unsafeDirectUploadTargets++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'rejected',
          code: 'UNSAFE_DIRECT_UPLOAD_CLEANUP_TARGET',
        })
        continue
      }

      wouldDeleteDirectUploads++
      if (dryRun) continue

      try {
        const cleanupOriginalId = createDirectUploadCleanupOriginalId(
          candidate.id
        )
        if (isPending) {
          const claimed = await prisma.mediaFile.updateMany({
            where: {
              id: candidate.id,
              href: candidate.href,
              ownerId: candidate.ownerId,
              originalId: candidate.originalId,
              createdAt: { lte: createdBefore },
            },
            data: { originalId: cleanupOriginalId },
          })
          if (claimed.count !== 1) continue
        }

        const deletedBlob = await deleteImportedMediaFile(candidate.href)
        if (typeof deletedBlob !== 'boolean') {
          throw new Error('Claimed direct upload target became noncanonical.')
        }
        if (deletedBlob) {
          deletedDirectUploadBlobs++
        }
        const deleted = await prisma.mediaFile.deleteMany({
          where: {
            id: candidate.id,
            href: candidate.href,
            ownerId: candidate.ownerId,
            originalId: cleanupOriginalId,
            createdAt: { lte: createdBefore },
          },
        })
        if (deleted.count !== 1) {
          throw new Error('Claimed direct upload row could not be deleted.')
        }
        deletedDirectUploadRows++
      } catch {
        failedDirectUploadCleanups++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'failure',
          code: 'DIRECT_UPLOAD_CLEANUP_FAILED',
        })
      }
    }

    if (directUploadCleanupStoppedEarly) break
    if (candidates.length < DIRECT_UPLOAD_CLEANUP_BATCH_SIZE) break
  }

  const directUploadCleanupBacklogRemaining =
    directUploadCleanupStoppedEarly ||
    (attemptedIds.length ===
      DIRECT_UPLOAD_CLEANUP_BATCH_SIZE * DIRECT_UPLOAD_MAX_CLEANUP_BATCHES &&
      (await findCandidates(1)).length > 0)

  return {
    deletedDirectUploadBlobs,
    deletedDirectUploadRows,
    wouldDeleteDirectUploads,
    failedDirectUploadCleanups,
    unsafeDirectUploadTargets,
    directUploadCleanupBatches,
    directUploadCleanupBacklogRemaining,
    directUploadCleanupStoppedEarly,
    attemptedCount: attemptedIds.length,
  }
}

export async function cleanupPendingImportedMediaFile({
  stagingId,
  ownerId,
  prisma,
}: {
  stagingId: string
  ownerId: string
  prisma: PrismaClient
}) {
  const staging = await prisma.importMediaStaging.findFirst({
    where: {
      id: stagingId,
      ownerId,
      state: ImportMediaStagingState.CLEANUP_PENDING,
    },
  })
  if (!staging) return true

  if (
    !isCanonicalImportedMediaTarget({
      ownerId,
      storageContainer: staging.storageContainer,
      storageBlob: staging.storageBlob,
    })
  ) {
    return false
  }

  await deleteImportedMediaTarget({
    containerName: staging.storageContainer,
    blobName: staging.storageBlob,
  })
  const deleted = await prisma.importMediaStaging.deleteMany({
    where: {
      id: staging.id,
      ownerId,
      state: ImportMediaStagingState.CLEANUP_PENDING,
    },
  })

  return deleted.count === 1
}

export async function reconcileAbandonedImportMediaStaging({
  receiptId,
  ownerId,
  operationId,
  prisma,
}: {
  receiptId: string
  ownerId: string
  operationId: string
  prisma: PrismaClient
}) {
  await withLiveImportMediaLease(
    prisma,
    {
      receiptId,
      operationId,
    },
    ownerId,
    async (tx) => {
      const abandoned = await tx.importMediaStaging.findMany({
        where: {
          receiptId,
          ownerId,
          operationId: { not: operationId },
          state: {
            in: [
              ImportMediaStagingState.RESERVED,
              ImportMediaStagingState.COPIED,
              ImportMediaStagingState.CLEANUP_PENDING,
            ],
          },
        },
        select: { id: true, operationId: true },
      })

      for (const staging of abandoned) {
        const reconciled = await tx.importMediaStaging.updateMany({
          where: {
            id: staging.id,
            receiptId,
            ownerId,
            operationId: staging.operationId,
            state: {
              in: [
                ImportMediaStagingState.RESERVED,
                ImportMediaStagingState.COPIED,
                ImportMediaStagingState.CLEANUP_PENDING,
              ],
            },
          },
          data: {
            // Free the receipt/ref uniqueness key for the new fenced attempt
            // while retaining this exact target as a cleanup ledger.
            packageMediaRef: `orphan:${staging.id}`,
            state: ImportMediaStagingState.CLEANUP_PENDING,
            mediaFileId: null,
          },
        })
        if (reconciled.count !== 1) {
          throw new Error('Abandoned import media staging could not be fenced.')
        }
      }
    }
  )
}

export async function cleanupOrphanedImportedMediaFiles({
  prisma,
  now = new Date(),
  dryRun = false,
  shouldStop = () => false,
}: {
  prisma: PrismaClient
  now?: Date
  dryRun?: boolean
  shouldStop?: () => boolean
}) {
  const cleanupBatchSize = 100
  const maxCleanupBatches = 10
  let deletedMediaFiles = 0
  let deletedStagingRecords = 0
  let wouldDeleteMediaFiles = 0
  let failedMediaCleanups = 0
  let unsafeMediaTargets = 0
  let cleanupBatches = 0
  let cleanupStoppedEarly = false
  const attemptedIds: string[] = []

  for (let batch = 0; batch < maxCleanupBatches; batch++) {
    if (shouldStop()) {
      cleanupStoppedEarly = true
      break
    }
    const candidates = await findExpiredImportMediaStagingForCleanup({
      prisma,
      now,
      batchSize: cleanupBatchSize,
      excludeIds: attemptedIds,
    })
    if (candidates.length === 0) break

    cleanupBatches++

    for (const candidate of candidates) {
      if (shouldStop()) {
        cleanupStoppedEarly = true
        break
      }
      attemptedIds.push(candidate.id)
      const canonicalTarget = isCanonicalImportedMediaTarget({
        ownerId: candidate.ownerId,
        storageContainer: candidate.storageContainer,
        storageBlob: candidate.storageBlob,
      })
      if (!canonicalTarget) {
        unsafeMediaTargets++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'rejected',
          code: 'UNSAFE_MEDIA_CLEANUP_TARGET',
        })
        continue
      }

      // A RESERVED row may already have a blob when the process crashed after
      // Azure accepted the upload but before COPIED was recorded. The exact
      // target is owned by this ledger, so cleanup must always deleteIfExists.
      wouldDeleteMediaFiles++
      if (dryRun) continue

      try {
        if (!isImportExportMediaStorageConfigured()) {
          throw new Error('Imported media storage is unavailable.')
        }

        if (candidate.state !== ImportMediaStagingState.CLEANUP_PENDING) {
          const claimed = await prisma.importMediaStaging.updateMany({
            where: {
              id: candidate.id,
              expiresAt: { lte: now },
              state: candidate.state,
              receipt: {
                NOT: {
                  state: 'PENDING',
                  leaseExpiresAt: { gt: now },
                },
              },
            },
            data: { state: ImportMediaStagingState.CLEANUP_PENDING },
          })
          if (claimed.count !== 1) continue
        }

        const deletedBlob = await deleteImportedMediaTarget({
          containerName: candidate.storageContainer,
          blobName: candidate.storageBlob,
        })
        if (deletedBlob) deletedMediaFiles++

        const deleted = await prisma.importMediaStaging.deleteMany({
          where: {
            id: candidate.id,
            expiresAt: { lte: now },
            state: ImportMediaStagingState.CLEANUP_PENDING,
          },
        })
        deletedStagingRecords += deleted.count
      } catch {
        failedMediaCleanups++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'failure',
          code: 'MEDIA_CLEANUP_FAILED',
        })
      }
    }

    if (cleanupStoppedEarly) break
    if (candidates.length < cleanupBatchSize) break
  }

  const cleanupBacklogRemaining =
    cleanupStoppedEarly ||
    (attemptedIds.length === cleanupBatchSize * maxCleanupBatches &&
      (
        await findExpiredImportMediaStagingForCleanup({
          prisma,
          now,
          batchSize: 1,
          excludeIds: attemptedIds,
        })
      ).length > 0)

  return {
    deletedMediaFiles,
    deletedStagingRecords,
    wouldDeleteMediaFiles,
    failedMediaCleanups,
    unsafeMediaTargets,
    cleanupBatches,
    cleanupBacklogRemaining,
    cleanupStoppedEarly,
  }
}

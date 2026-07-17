import {
  ImportMediaStagingState,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { isCanonicalImportedMediaTarget } from './importExportMediaBlobStore.js'
import { findExpiredImportMediaStagingForCleanup } from './importExportPersistence.js'
import { withLiveImportMediaLease } from './mediaStorageStaging.js'
import {
  deleteImportedMediaTarget,
  isImportExportMediaStorageConfigured,
} from './mediaStorageTargets.js'

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

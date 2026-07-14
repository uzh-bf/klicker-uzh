import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { HatchetHandlers } from '@klicker-uzh/types'
import { isCanonicalImportExportArtifactStorageTarget } from '../lib/importExportCapabilities.js'
import { emitImportExportTelemetry } from '../lib/importExportTelemetry.js'
import { deletePackageArtifactBlobIfExists } from './importExportPackageBlobStore.js'
import {
  claimExpiredPackageArtifactForCleanup,
  deleteExpiredPendingImportReceipt,
  findExpiredCompletedImportReceiptsForCleanup,
  findExpiredPackageArtifactsForCleanup,
  findExpiredPendingImportReceiptsForCleanup,
} from './importExportPersistence.js'
import { cleanupOrphanedImportedMediaFiles } from './mediaStorage.js'

const CLEANUP_BATCH_SIZE = 100
const MAX_CLEANUP_BATCHES = 10

export async function cleanupImportExportPackages({
  now = new Date(),
  prisma,
  dryRun = false,
}: {
  now?: Date
  prisma: PrismaClient
  dryRun?: boolean
}) {
  let deletedPackages = 0
  let wouldDeletePackages = 0
  let unsafePackageTargets = 0
  let failedPackageCleanups = 0
  let packageCleanupBatches = 0
  const attemptedPackageIds: string[] = []

  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    const candidates = await findExpiredPackageArtifactsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedPackageIds,
    })
    if (candidates.length === 0) break

    packageCleanupBatches++
    attemptedPackageIds.push(...candidates.map((artifact) => artifact.id))

    for (const artifact of candidates) {
      if (
        !isCanonicalImportExportArtifactStorageTarget({
          storageContainer: artifact.storageContainer,
          storageBlob: artifact.storageBlob,
          direction: artifact.direction,
          ownerId: artifact.ownerId,
          artifactId: artifact.id,
        })
      ) {
        unsafePackageTargets++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'rejected',
          code: 'NONCANONICAL_PACKAGE_TARGET',
          unsafeTargetCount: 1,
        })
        continue
      }

      wouldDeletePackages++
      if (dryRun) continue

      try {
        const claimed = await claimExpiredPackageArtifactForCleanup({
          prisma,
          artifactId: artifact.id,
          now,
        })
        if (!claimed) continue
        if (
          !isCanonicalImportExportArtifactStorageTarget({
            storageContainer: claimed.storageContainer,
            storageBlob: claimed.storageBlob,
            direction: claimed.direction,
            ownerId: claimed.ownerId,
            artifactId: claimed.id,
          })
        ) {
          unsafePackageTargets++
          emitImportExportTelemetry({
            operation: 'cleanup',
            outcome: 'rejected',
            code: 'NONCANONICAL_CLAIMED_PACKAGE_TARGET',
            unsafeTargetCount: 1,
          })
          continue
        }

        await deletePackageArtifactBlobIfExists(claimed.storageBlob)
        const deleted = await prisma.importExportPackageArtifact.deleteMany({
          where: {
            id: claimed.id,
            state: 'FAILED',
            expiresAt: { lte: now },
          },
        })
        deletedPackages += deleted.count
      } catch {
        failedPackageCleanups++
        emitImportExportTelemetry({
          operation: 'cleanup',
          outcome: 'failure',
          code: 'PACKAGE_CLEANUP_FAILED',
          cleanupFailureCount: 1,
        })
      }
    }

    if (candidates.length < CLEANUP_BATCH_SIZE) break
  }

  const packageCleanupBacklogRemaining =
    attemptedPackageIds.length === CLEANUP_BATCH_SIZE * MAX_CLEANUP_BATCHES &&
    (
      await findExpiredPackageArtifactsForCleanup({
        prisma,
        now,
        batchSize: 1,
        excludeIds: attemptedPackageIds,
      })
    ).length > 0

  let mediaCleanup = {
    deletedMediaFiles: 0,
    deletedStagingRecords: 0,
    wouldDeleteMediaFiles: 0,
    failedMediaCleanups: 0,
    unsafeMediaTargets: 0,
    cleanupBatches: 0,
    cleanupBacklogRemaining: false,
  }
  try {
    mediaCleanup = await cleanupOrphanedImportedMediaFiles({
      prisma,
      now,
      dryRun,
    })
  } catch {
    mediaCleanup.failedMediaCleanups++
    emitImportExportTelemetry({
      operation: 'cleanup',
      outcome: 'failure',
      code: 'MEDIA_CLEANUP_QUERY_FAILED',
      cleanupFailureCount: 1,
    })
  }

  let deletedReceipts = 0
  let wouldDeleteReceipts = 0
  let failedReceiptCleanups = 0
  let receiptCleanupBatches = 0
  const attemptedPendingReceiptIds: string[] = []

  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    const receipts = await findExpiredPendingImportReceiptsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedPendingReceiptIds,
    })
    if (receipts.length === 0) break

    receiptCleanupBatches++
    wouldDeleteReceipts += receipts.length
    attemptedPendingReceiptIds.push(...receipts.map((receipt) => receipt.id))

    if (!dryRun) {
      for (const receipt of receipts) {
        try {
          if (
            await deleteExpiredPendingImportReceipt({
              prisma,
              receiptId: receipt.id,
              now,
            })
          ) {
            deletedReceipts++
          }
        } catch {
          failedReceiptCleanups++
          emitImportExportTelemetry({
            operation: 'cleanup',
            outcome: 'failure',
            code: 'PENDING_RECEIPT_CLEANUP_FAILED',
            cleanupFailureCount: 1,
          })
        }
      }
    }

    if (receipts.length < CLEANUP_BATCH_SIZE) break
  }

  const pendingReceiptCleanupBacklogRemaining =
    attemptedPendingReceiptIds.length ===
      CLEANUP_BATCH_SIZE * MAX_CLEANUP_BATCHES &&
    (
      await findExpiredPendingImportReceiptsForCleanup({
        prisma,
        now,
        batchSize: 1,
        excludeIds: attemptedPendingReceiptIds,
      })
    ).length > 0

  const attemptedCompletedReceiptIds: string[] = []

  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    const receipts = await findExpiredCompletedImportReceiptsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedCompletedReceiptIds,
    })
    if (receipts.length === 0) break

    receiptCleanupBatches++
    wouldDeleteReceipts += receipts.length
    attemptedCompletedReceiptIds.push(...receipts.map((receipt) => receipt.id))

    if (!dryRun) {
      for (const receipt of receipts) {
        try {
          deletedReceipts += await prisma.$transaction(async (tx) => {
            await tx.importMediaStaging.deleteMany({
              where: {
                receiptId: receipt.id,
                state: 'FINALIZED',
              },
            })
            const deleted = await tx.elementImportReceipt.deleteMany({
              where: {
                id: receipt.id,
                state: 'COMPLETE',
                retentionExpiresAt: { lte: now },
                mediaStaging: { none: {} },
              },
            })
            return deleted.count
          })
        } catch {
          failedReceiptCleanups++
          emitImportExportTelemetry({
            operation: 'cleanup',
            outcome: 'failure',
            code: 'COMPLETED_RECEIPT_CLEANUP_FAILED',
            cleanupFailureCount: 1,
          })
        }
      }
    }

    if (receipts.length < CLEANUP_BATCH_SIZE) break
  }

  const receiptCleanupBacklogRemaining =
    pendingReceiptCleanupBacklogRemaining ||
    (attemptedCompletedReceiptIds.length ===
      CLEANUP_BATCH_SIZE * MAX_CLEANUP_BATCHES &&
      (
        await findExpiredCompletedImportReceiptsForCleanup({
          prisma,
          now,
          batchSize: 1,
          excludeIds: attemptedCompletedReceiptIds,
        })
      ).length > 0)
  const cleanupFailures =
    failedPackageCleanups +
    mediaCleanup.failedMediaCleanups +
    failedReceiptCleanups +
    unsafePackageTargets +
    mediaCleanup.unsafeMediaTargets

  emitImportExportTelemetry({
    service: 'worker',
    operation: 'cleanup',
    outcome: cleanupFailures > 0 ? 'failure' : 'success',
    code: dryRun ? 'DRY_RUN_COMPLETED' : 'CLEANUP_COMPLETED',
    attemptedCount:
      attemptedPackageIds.length +
      attemptedPendingReceiptIds.length +
      attemptedCompletedReceiptIds.length,
    deletedCount:
      deletedPackages + deletedReceipts + mediaCleanup.deletedMediaFiles,
    wouldDeleteCount:
      wouldDeletePackages +
      wouldDeleteReceipts +
      mediaCleanup.wouldDeleteMediaFiles,
    cleanupFailureCount: cleanupFailures,
    unsafeTargetCount: unsafePackageTargets + mediaCleanup.unsafeMediaTargets,
    batchCount:
      packageCleanupBatches +
      receiptCleanupBatches +
      mediaCleanup.cleanupBatches,
    backlogRemaining:
      packageCleanupBacklogRemaining ||
      receiptCleanupBacklogRemaining ||
      mediaCleanup.cleanupBacklogRemaining,
  })

  return {
    deletedPackages,
    wouldDeletePackages,
    unsafePackageTargets,
    failedPackageCleanups,
    packageCleanupBatches,
    packageCleanupBacklogRemaining,
    deletedReceipts,
    wouldDeleteReceipts,
    failedReceiptCleanups,
    receiptCleanupBatches,
    receiptCleanupBacklogRemaining,
    cleanupFailures,
    ...mediaCleanup,
  }
}

export const handleCleanupImportExportPackages: HatchetHandlers['handleCleanupImportExportPackages'] =
  async (_, globalCtx, executionCtx) => {
    const result = await cleanupImportExportPackages({
      prisma: globalCtx.prisma,
    })
    executionCtx.logger.info(
      `[INFO] [CleanupImportExportPackages] Deleted ${result.deletedPackages}/${result.wouldDeletePackages} recorded package artifacts, ${result.deletedMediaFiles}/${result.wouldDeleteMediaFiles} recorded imported media blobs, and ${result.deletedReceipts}/${result.wouldDeleteReceipts} retained receipts; failures=${result.cleanupFailures}; unsafeTargets=${result.unsafePackageTargets + result.unsafeMediaTargets}; backlog=${result.packageCleanupBacklogRemaining || result.cleanupBacklogRemaining || result.receiptCleanupBacklogRemaining}`
    )

    if (result.cleanupFailures > 0) {
      throw new Error('Import/export cleanup completed with hard failures.')
    }

    return true
  }

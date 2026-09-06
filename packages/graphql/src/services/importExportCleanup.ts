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
import {
  cleanupAbandonedDirectMediaUploads,
  cleanupOrphanedImportedMediaFiles,
} from './mediaStorage.js'

const CLEANUP_BATCH_SIZE = 100
const MAX_CLEANUP_BATCHES = 10
export const IMPORT_EXPORT_CLEANUP_RUNTIME_BUDGET_MS = 40 * 60 * 1000
export type ImportExportCleanupStopReason = 'budget' | 'cancelled'

type CleanupStopController = {
  shouldStop: () => boolean
  readonly reason: ImportExportCleanupStopReason | null
}

type PackageCleanupSummary = {
  deletedPackages: number
  wouldDeletePackages: number
  unsafePackageTargets: number
  failedPackageCleanups: number
  packageCleanupBatches: number
  packageCleanupBacklogRemaining: boolean
  cleanupStoppedEarly: boolean
  attemptedCount: number
}

type ReceiptCleanupSummary = {
  deletedReceipts: number
  wouldDeleteReceipts: number
  failedReceiptCleanups: number
  receiptCleanupBatches: number
  receiptCleanupBacklogRemaining: boolean
  cleanupStoppedEarly: boolean
  attemptedCount: number
}

type MediaCleanupSummary = Awaited<
  ReturnType<typeof cleanupOrphanedImportedMediaFiles>
>
type DirectUploadCleanupSummary = Awaited<
  ReturnType<typeof cleanupAbandonedDirectMediaUploads>
>

function createCleanupStopController(
  getStopReason: () => ImportExportCleanupStopReason | null
): CleanupStopController {
  let reason: ImportExportCleanupStopReason | null = null

  return {
    shouldStop: () => {
      const currentReason = getStopReason()
      if (currentReason && reason === null) reason = currentReason
      return reason !== null
    },
    get reason() {
      return reason
    },
  }
}

function emptyMediaCleanupSummary(
  cleanupStoppedEarly: boolean
): MediaCleanupSummary {
  return {
    deletedMediaFiles: 0,
    deletedStagingRecords: 0,
    wouldDeleteMediaFiles: 0,
    failedMediaCleanups: 0,
    unsafeMediaTargets: 0,
    cleanupBatches: 0,
    cleanupBacklogRemaining: cleanupStoppedEarly,
    cleanupStoppedEarly,
  }
}

function emptyDirectUploadCleanupSummary(
  cleanupStoppedEarly: boolean
): DirectUploadCleanupSummary {
  return {
    deletedDirectUploadBlobs: 0,
    deletedDirectUploadRows: 0,
    wouldDeleteDirectUploads: 0,
    failedDirectUploadCleanups: 0,
    unsafeDirectUploadTargets: 0,
    directUploadCleanupBatches: 0,
    directUploadCleanupBacklogRemaining: cleanupStoppedEarly,
    directUploadCleanupStoppedEarly: cleanupStoppedEarly,
    attemptedCount: 0,
  }
}

async function cleanupExpiredPackageArtifacts({
  now = new Date(),
  prisma,
  dryRun = false,
  shouldStop,
}: {
  now?: Date
  prisma: PrismaClient
  dryRun?: boolean
  shouldStop: () => boolean
}): Promise<PackageCleanupSummary> {
  let deletedPackages = 0
  let wouldDeletePackages = 0
  let unsafePackageTargets = 0
  let failedPackageCleanups = 0
  let packageCleanupBatches = 0
  let cleanupStoppedEarly = false
  const attemptedPackageIds: string[] = []

  for (let batch = 0; batch < MAX_CLEANUP_BATCHES; batch++) {
    if (shouldStop()) {
      cleanupStoppedEarly = true
      break
    }
    const candidates = await findExpiredPackageArtifactsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedPackageIds,
    })
    if (candidates.length === 0) break

    packageCleanupBatches++

    for (const artifact of candidates) {
      if (shouldStop()) {
        cleanupStoppedEarly = true
        break
      }
      attemptedPackageIds.push(artifact.id)
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

    if (cleanupStoppedEarly) break
    if (candidates.length < CLEANUP_BATCH_SIZE) break
  }

  const packageCleanupBacklogRemaining =
    cleanupStoppedEarly ||
    (attemptedPackageIds.length === CLEANUP_BATCH_SIZE * MAX_CLEANUP_BATCHES &&
      (
        await findExpiredPackageArtifactsForCleanup({
          prisma,
          now,
          batchSize: 1,
          excludeIds: attemptedPackageIds,
        })
      ).length > 0)

  return {
    deletedPackages,
    wouldDeletePackages,
    unsafePackageTargets,
    failedPackageCleanups,
    packageCleanupBatches,
    packageCleanupBacklogRemaining,
    cleanupStoppedEarly,
    attemptedCount: attemptedPackageIds.length,
  }
}

async function cleanupExpiredReceipts({
  now,
  prisma,
  dryRun,
  shouldStop,
}: {
  now: Date
  prisma: PrismaClient
  dryRun: boolean
  shouldStop: () => boolean
}): Promise<ReceiptCleanupSummary> {
  let deletedReceipts = 0
  let wouldDeleteReceipts = 0
  let failedReceiptCleanups = 0
  let receiptCleanupBatches = 0
  let cleanupStoppedEarly = false
  const attemptedPendingReceiptIds: string[] = []

  for (
    let batch = 0;
    !cleanupStoppedEarly && batch < MAX_CLEANUP_BATCHES;
    batch++
  ) {
    if (shouldStop()) {
      cleanupStoppedEarly = true
      break
    }
    const receipts = await findExpiredPendingImportReceiptsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedPendingReceiptIds,
    })
    if (receipts.length === 0) break

    receiptCleanupBatches++
    wouldDeleteReceipts += receipts.length

    if (!dryRun) {
      for (const receipt of receipts) {
        if (shouldStop()) {
          cleanupStoppedEarly = true
          break
        }
        attemptedPendingReceiptIds.push(receipt.id)
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
    } else {
      attemptedPendingReceiptIds.push(...receipts.map((receipt) => receipt.id))
    }

    if (cleanupStoppedEarly) break
    if (receipts.length < CLEANUP_BATCH_SIZE) break
  }

  const pendingReceiptCleanupBacklogRemaining =
    cleanupStoppedEarly ||
    (attemptedPendingReceiptIds.length ===
      CLEANUP_BATCH_SIZE * MAX_CLEANUP_BATCHES &&
      (
        await findExpiredPendingImportReceiptsForCleanup({
          prisma,
          now,
          batchSize: 1,
          excludeIds: attemptedPendingReceiptIds,
        })
      ).length > 0)

  const attemptedCompletedReceiptIds: string[] = []

  for (
    let batch = 0;
    !cleanupStoppedEarly && batch < MAX_CLEANUP_BATCHES;
    batch++
  ) {
    if (shouldStop()) {
      cleanupStoppedEarly = true
      break
    }
    const receipts = await findExpiredCompletedImportReceiptsForCleanup({
      prisma,
      now,
      batchSize: CLEANUP_BATCH_SIZE,
      excludeIds: attemptedCompletedReceiptIds,
    })
    if (receipts.length === 0) break

    receiptCleanupBatches++
    wouldDeleteReceipts += receipts.length

    if (!dryRun) {
      for (const receipt of receipts) {
        if (shouldStop()) {
          cleanupStoppedEarly = true
          break
        }
        attemptedCompletedReceiptIds.push(receipt.id)
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
    } else {
      attemptedCompletedReceiptIds.push(
        ...receipts.map((receipt) => receipt.id)
      )
    }

    if (cleanupStoppedEarly) break
    if (receipts.length < CLEANUP_BATCH_SIZE) break
  }

  const receiptCleanupBacklogRemaining =
    cleanupStoppedEarly ||
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

  return {
    deletedReceipts,
    wouldDeleteReceipts,
    failedReceiptCleanups,
    receiptCleanupBatches,
    receiptCleanupBacklogRemaining,
    cleanupStoppedEarly,
    attemptedCount:
      attemptedPendingReceiptIds.length + attemptedCompletedReceiptIds.length,
  }
}

export async function cleanupImportExportPackages({
  now = new Date(),
  prisma,
  dryRun = false,
  getStopReason = () => null,
}: {
  now?: Date
  prisma: PrismaClient
  dryRun?: boolean
  getStopReason?: () => ImportExportCleanupStopReason | null
}) {
  const stopController = createCleanupStopController(getStopReason)
  const packageCleanup = await cleanupExpiredPackageArtifacts({
    prisma,
    now,
    dryRun,
    shouldStop: stopController.shouldStop,
  })

  let mediaCleanup = emptyMediaCleanupSummary(
    packageCleanup.cleanupStoppedEarly
  )
  if (!packageCleanup.cleanupStoppedEarly) {
    try {
      mediaCleanup = await cleanupOrphanedImportedMediaFiles({
        prisma,
        now,
        dryRun,
        shouldStop: stopController.shouldStop,
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
  }

  let directUploadCleanup = emptyDirectUploadCleanupSummary(
    packageCleanup.cleanupStoppedEarly || mediaCleanup.cleanupStoppedEarly
  )
  if (
    !packageCleanup.cleanupStoppedEarly &&
    !mediaCleanup.cleanupStoppedEarly
  ) {
    try {
      directUploadCleanup = await cleanupAbandonedDirectMediaUploads({
        prisma,
        now,
        dryRun,
        shouldStop: stopController.shouldStop,
      })
    } catch {
      directUploadCleanup.failedDirectUploadCleanups++
      emitImportExportTelemetry({
        operation: 'cleanup',
        outcome: 'failure',
        code: 'DIRECT_UPLOAD_CLEANUP_QUERY_FAILED',
        cleanupFailureCount: 1,
      })
    }
  }

  const receiptCleanup = await cleanupExpiredReceipts({
    prisma,
    now,
    dryRun,
    shouldStop: stopController.shouldStop,
  })
  const stoppedAfterCleanup = stopController.shouldStop()
  const cleanupStoppedEarly =
    packageCleanup.cleanupStoppedEarly ||
    mediaCleanup.cleanupStoppedEarly ||
    directUploadCleanup.directUploadCleanupStoppedEarly ||
    receiptCleanup.cleanupStoppedEarly ||
    stoppedAfterCleanup
  const cleanupFailures =
    packageCleanup.failedPackageCleanups +
    mediaCleanup.failedMediaCleanups +
    directUploadCleanup.failedDirectUploadCleanups +
    receiptCleanup.failedReceiptCleanups +
    packageCleanup.unsafePackageTargets +
    mediaCleanup.unsafeMediaTargets +
    directUploadCleanup.unsafeDirectUploadTargets

  emitImportExportTelemetry({
    service: 'worker',
    operation: 'cleanup',
    outcome:
      cleanupFailures > 0 || stopController.reason === 'cancelled'
        ? 'failure'
        : 'success',
    code:
      stopController.reason === 'cancelled'
        ? 'CLEANUP_CANCELLED'
        : stopController.reason === 'budget'
          ? 'CLEANUP_BUDGET_REACHED'
          : dryRun
            ? 'DRY_RUN_COMPLETED'
            : 'CLEANUP_COMPLETED',
    attemptedCount:
      packageCleanup.attemptedCount +
      directUploadCleanup.attemptedCount +
      receiptCleanup.attemptedCount,
    deletedCount:
      packageCleanup.deletedPackages +
      receiptCleanup.deletedReceipts +
      mediaCleanup.deletedMediaFiles +
      directUploadCleanup.deletedDirectUploadBlobs,
    wouldDeleteCount:
      packageCleanup.wouldDeletePackages +
      receiptCleanup.wouldDeleteReceipts +
      mediaCleanup.wouldDeleteMediaFiles +
      directUploadCleanup.wouldDeleteDirectUploads,
    cleanupFailureCount: cleanupFailures,
    unsafeTargetCount:
      packageCleanup.unsafePackageTargets +
      mediaCleanup.unsafeMediaTargets +
      directUploadCleanup.unsafeDirectUploadTargets,
    batchCount:
      packageCleanup.packageCleanupBatches +
      receiptCleanup.receiptCleanupBatches +
      mediaCleanup.cleanupBatches +
      directUploadCleanup.directUploadCleanupBatches,
    backlogRemaining:
      packageCleanup.packageCleanupBacklogRemaining ||
      receiptCleanup.receiptCleanupBacklogRemaining ||
      mediaCleanup.cleanupBacklogRemaining ||
      directUploadCleanup.directUploadCleanupBacklogRemaining,
  })

  return {
    deletedPackages: packageCleanup.deletedPackages,
    wouldDeletePackages: packageCleanup.wouldDeletePackages,
    unsafePackageTargets: packageCleanup.unsafePackageTargets,
    failedPackageCleanups: packageCleanup.failedPackageCleanups,
    packageCleanupBatches: packageCleanup.packageCleanupBatches,
    packageCleanupBacklogRemaining:
      packageCleanup.packageCleanupBacklogRemaining,
    deletedReceipts: receiptCleanup.deletedReceipts,
    wouldDeleteReceipts: receiptCleanup.wouldDeleteReceipts,
    failedReceiptCleanups: receiptCleanup.failedReceiptCleanups,
    receiptCleanupBatches: receiptCleanup.receiptCleanupBatches,
    receiptCleanupBacklogRemaining:
      receiptCleanup.receiptCleanupBacklogRemaining,
    ...mediaCleanup,
    ...directUploadCleanup,
    cleanupStoppedEarly,
    cleanupStopReason: stopController.reason,
    cleanupFailures,
  }
}

export const handleCleanupImportExportPackages: HatchetHandlers['handleCleanupImportExportPackages'] =
  async (_, globalCtx, executionCtx) => {
    const deadline = Date.now() + IMPORT_EXPORT_CLEANUP_RUNTIME_BUDGET_MS
    const result = await cleanupImportExportPackages({
      prisma: globalCtx.prisma,
      getStopReason: () =>
        executionCtx.abortController.signal.aborted
          ? 'cancelled'
          : Date.now() >= deadline
            ? 'budget'
            : null,
    })

    if (
      executionCtx.abortController.signal.aborted ||
      result.cleanupStopReason === 'cancelled'
    ) {
      throw new Error('Import/export cleanup was cancelled.')
    }

    executionCtx.logger.info(
      `[INFO] [CleanupImportExportPackages] Deleted ${result.deletedPackages}/${result.wouldDeletePackages} recorded package artifacts, ${result.deletedMediaFiles}/${result.wouldDeleteMediaFiles} recorded imported media blobs, ${result.deletedDirectUploadRows}/${result.wouldDeleteDirectUploads} abandoned direct uploads, and ${result.deletedReceipts}/${result.wouldDeleteReceipts} retained receipts; failures=${result.cleanupFailures}; unsafeTargets=${result.unsafePackageTargets + result.unsafeMediaTargets + result.unsafeDirectUploadTargets}; backlog=${result.packageCleanupBacklogRemaining || result.cleanupBacklogRemaining || result.directUploadCleanupBacklogRemaining || result.receiptCleanupBacklogRemaining}; stoppedEarly=${result.cleanupStoppedEarly}`
    )

    if (result.cleanupFailures > 0) {
      throw new Error('Import/export cleanup completed with hard failures.')
    }

    return true
  }

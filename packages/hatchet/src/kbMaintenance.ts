import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
  type Prisma,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type {
  DeleteKBResourceInput,
  IngestKBResourceInput,
} from '@klicker-uzh/types'
import { randomUUID } from 'node:crypto'
import {
  dispatchKBDeletion,
  dispatchKBIngestion,
  type KBIngestionLogger,
} from './kbIngestion.js'
import {
  createKBIngestionApiClient,
  type KBIngestionApiClient,
} from './kbIngestionApi.js'

const KB_MAINTENANCE_BATCH_SIZE = 32
const KB_MAINTENANCE_CONCURRENCY = 8
// The maintenance task itself runs on this cadence (see the `maintain-kb-resources`
// cron in `index.ts`), so a QUEUED/UPSERT row with no `externalOperationId` that is
// older than one interval has necessarily survived at least one full sweep without
// being dispatched or reconciled, i.e. it is stranded rather than merely in flight.
export const KB_MAINTENANCE_INTERVAL_MS = 15 * 60 * 1000
const KB_UPLOAD_RETENTION_GRACE_MS = 24 * 60 * 60 * 1000
const KB_BLOB_DELETE_TIMEOUT_MS = 30_000
const KB_TERMINAL_DELETION_STATUSES = [
  KBIngestionStatus.FAILED,
  KBIngestionStatus.SUPERSEDED,
]

type KBMaintenanceDependencies = {
  prisma: PrismaClient
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
  deleteBlob?: (ownerId: string, blobName: string) => Promise<void>
}

async function logMaintenanceError(
  logger: KBIngestionLogger | undefined,
  message: string,
  identifiers: Record<string, string>
) {
  try {
    await logger?.error?.(message, identifiers)
  } catch {
    // Maintenance must remain retryable when logging is unavailable.
  }
}

async function runBounded<T>(
  values: T[],
  callback: (value: T) => Promise<void>
) {
  for (
    let start = 0;
    start < values.length;
    start += KB_MAINTENANCE_CONCURRENCY
  ) {
    await Promise.all(
      values.slice(start, start + KB_MAINTENANCE_CONCURRENCY).map(callback)
    )
  }
}

function getBatchOffset(total: number, now: Date) {
  if (total <= KB_MAINTENANCE_BATCH_SIZE) {
    return 0
  }
  const runNumber = Math.floor(now.getTime() / KB_MAINTENANCE_INTERVAL_MS)
  return (runNumber * KB_MAINTENANCE_BATCH_SIZE) % total
}

async function deleteKBBlob(
  ownerId: string,
  blobName: string,
  env: NodeJS.ProcessEnv
) {
  const accountName = env.BLOB_STORAGE_ACCOUNT_NAME?.trim()
  const accessKey = env.BLOB_STORAGE_ACCESS_KEY?.trim()
  if (!accountName || !accessKey) {
    throw new Error('Blob storage is not configured')
  }
  const credential = new StorageSharedKeyCredential(accountName, accessKey)
  const serviceClient = new BlobServiceClient(
    `https://${accountName}.blob.core.windows.net`,
    credential
  )
  await serviceClient
    .getContainerClient(`kb-${ownerId}`)
    .getBlobClient(blobName)
    .deleteIfExists({
      abortSignal: AbortSignal.timeout(KB_BLOB_DELETE_TIMEOUT_MS),
    })
}

export async function maintainKBResources(
  dependencies: KBMaintenanceDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = (dependencies.now ?? (() => new Date()))()
  const deleteBlob =
    dependencies.deleteBlob ??
    ((ownerId, blobName) => deleteKBBlob(ownerId, blobName, env))

  const deletionRetryWhere = {
    deletedAt: { not: null },
    ingestionOperation: KBIngestionOperation.DELETE,
    ingestionAttemptId: { not: null },
    OR: [{ externalOperationId: null }, { status: KBResourceStatus.FAILED }],
  } satisfies Prisma.KBResourceWhereInput
  const deletionRetryCount = await dependencies.prisma.kBResource.count({
    where: deletionRetryWhere,
  })
  const deletionRetryOffset = getBatchOffset(deletionRetryCount, now)
  const deletionRetries = await dependencies.prisma.kBResource.findMany({
    where: deletionRetryWhere,
    select: {
      id: true,
      kbId: true,
      status: true,
      ingestionAttemptId: true,
      resourceVersion: true,
      externalOperationId: true,
      ingestionRuns: {
        where: {
          operation: KBIngestionOperation.DELETE,
          status: { in: KB_TERMINAL_DELETION_STATUSES },
        },
        select: { id: true },
      },
    },
    orderBy: { id: 'asc' },
    ...(deletionRetryOffset > 0 ? { skip: deletionRetryOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  const retryableDeletions = deletionRetries.filter(
    (resource) =>
      !resource.externalOperationId ||
      (resource.status === KBResourceStatus.FAILED &&
        resource.ingestionRuns.some(
          ({ id }) => id === resource.ingestionAttemptId
        ))
  )
  if (retryableDeletions.length > 0) {
    await runBounded(retryableDeletions, async (resource) => {
      let deletionAttemptId = resource.ingestionAttemptId!
      if (resource.externalOperationId) {
        const retryAttemptId = randomUUID()
        const claimed = await dependencies.prisma.$transaction(async (tx) => {
          const update = await tx.kBResource.updateMany({
            where: {
              id: resource.id,
              deletedAt: { not: null },
              status: KBResourceStatus.FAILED,
              ingestionOperation: KBIngestionOperation.DELETE,
              ingestionAttemptId: resource.ingestionAttemptId,
              resourceVersion: resource.resourceVersion,
              externalOperationId: resource.externalOperationId,
              ingestionRuns: {
                some: {
                  id: resource.ingestionAttemptId!,
                  operation: KBIngestionOperation.DELETE,
                  status: { in: KB_TERMINAL_DELETION_STATUSES },
                },
              },
            },
            data: {
              status: KBResourceStatus.QUEUED,
              statusMessage: 'The deletion operation is awaiting retry.',
              ingestionAttemptId: retryAttemptId,
              externalOperationId: null,
              externalOperationStartedAt: null,
              errorCode: null,
            },
          })
          if (update.count !== 1) {
            return false
          }
          await tx.kBIngestionRun.create({
            data: {
              id: retryAttemptId,
              resourceId: resource.id,
              operation: KBIngestionOperation.DELETE,
              resourceVersion: resource.resourceVersion,
            },
          })
          return true
        })
        if (!claimed) {
          return
        }
        deletionAttemptId = retryAttemptId
      }
      const input = {
        resourceId: resource.id,
        kbId: resource.kbId,
        deletionAttemptId,
        resourceVersion: resource.resourceVersion,
      } satisfies DeleteKBResourceInput
      try {
        const client =
          dependencies.client ?? createKBIngestionApiClient({ env })
        await dispatchKBDeletion(input, {
          prisma: dependencies.prisma,
          client,
          env,
          now: () => now,
          logger: dependencies.logger,
        })
      } catch {
        await logMaintenanceError(
          dependencies.logger,
          'KB deletion retry failed',
          {
            resourceId: resource.id,
            kbId: resource.kbId,
            deletionAttemptId,
          }
        )
      }
    })
  }

  // Recovers UPSERT dispatches stranded when the process crashed between the
  // commit that claims a fresh `ingestionAttemptId` (status QUEUED,
  // externalOperationId null) and the enqueue of the ingestion task. Such rows
  // are invisible to `monitorActiveKBIngestions` (which requires a non-null
  // externalOperationId) and cannot be re-ingested or deleted through the API
  // while QUEUED, so they would otherwise be stuck forever.
  const upsertRetryStaleBefore = new Date(
    now.getTime() - KB_MAINTENANCE_INTERVAL_MS
  )
  const upsertRetryWhere = {
    deletedAt: null,
    ingestionOperation: KBIngestionOperation.UPSERT,
    status: KBResourceStatus.QUEUED,
    externalOperationId: null,
    ingestionAttemptId: { not: null },
    updatedAt: { lte: upsertRetryStaleBefore },
  } satisfies Prisma.KBResourceWhereInput
  const upsertRetryCount = await dependencies.prisma.kBResource.count({
    where: upsertRetryWhere,
  })
  const upsertRetryOffset = getBatchOffset(upsertRetryCount, now)
  const upsertRetries = await dependencies.prisma.kBResource.findMany({
    where: upsertRetryWhere,
    select: {
      id: true,
      kbId: true,
      title: true,
      type: true,
      blobName: true,
      mimeType: true,
      sizeBytes: true,
      sourceUrl: true,
      ingestionAttemptId: true,
      resourceVersion: true,
      kb: { select: { ownerId: true } },
    },
    orderBy: { id: 'asc' },
    ...(upsertRetryOffset > 0 ? { skip: upsertRetryOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  if (upsertRetries.length > 0) {
    await runBounded(upsertRetries, async (resource) => {
      // The same attempt id is reused (never a new one, never a status
      // transition): the external platform dedupes on this id via its
      // Idempotency-Key, so re-dispatching is safe even if a previous crash
      // happened after the platform had already accepted the operation.
      const ingestionAttemptId = resource.ingestionAttemptId
      if (!ingestionAttemptId) {
        return
      }
      const basePayload = {
        resourceId: resource.id,
        kbId: resource.kbId,
        title: resource.title,
        ingestionAttemptId,
        resourceVersion: resource.resourceVersion,
      }
      let payload: IngestKBResourceInput
      if (resource.type === KBResourceType.BLOB) {
        if (
          !resource.blobName ||
          !resource.mimeType ||
          resource.sizeBytes === null
        ) {
          await logMaintenanceError(
            dependencies.logger,
            'KB ingestion retry payload is invalid',
            {
              resourceId: resource.id,
              kbId: resource.kbId,
              ingestionAttemptId,
            }
          )
          return
        }
        payload = {
          ...basePayload,
          type: KBResourceType.BLOB,
          blobName: resource.blobName,
          containerName: `kb-${resource.kb.ownerId}`,
          mimeType: resource.mimeType,
          sizeBytes: resource.sizeBytes,
        }
      } else {
        if (!resource.sourceUrl) {
          await logMaintenanceError(
            dependencies.logger,
            'KB ingestion retry payload is invalid',
            {
              resourceId: resource.id,
              kbId: resource.kbId,
              ingestionAttemptId,
            }
          )
          return
        }
        payload = {
          ...basePayload,
          type: KBResourceType.URL,
          sourceUrl: resource.sourceUrl,
        }
      }
      try {
        const client =
          dependencies.client ?? createKBIngestionApiClient({ env })
        await dispatchKBIngestion(payload, {
          prisma: dependencies.prisma,
          client,
          env,
          now: () => now,
          logger: dependencies.logger,
        })
      } catch {
        await logMaintenanceError(
          dependencies.logger,
          'KB ingestion retry failed',
          {
            resourceId: resource.id,
            kbId: resource.kbId,
            ingestionAttemptId,
          }
        )
      }
    })
  }

  const expiredBefore = new Date(now.getTime() - KB_UPLOAD_RETENTION_GRACE_MS)
  const expiredTicketWhere = {
    expiresAt: { lte: expiredBefore },
  } satisfies Prisma.KBUploadTicketWhereInput
  const expiredTicketCount = await dependencies.prisma.kBUploadTicket.count({
    where: expiredTicketWhere,
  })
  const expiredTicketOffset = getBatchOffset(expiredTicketCount, now)
  const expiredTickets = await dependencies.prisma.kBUploadTicket.findMany({
    where: expiredTicketWhere,
    select: {
      id: true,
      blobName: true,
      expiresAt: true,
      kb: { select: { ownerId: true } },
    },
    orderBy: { id: 'asc' },
    ...(expiredTicketOffset > 0 ? { skip: expiredTicketOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(expiredTickets, async (ticket) => {
    try {
      await deleteBlob(ticket.kb.ownerId, ticket.blobName)
      await dependencies.prisma.kBUploadTicket.deleteMany({
        where: {
          id: ticket.id,
          blobName: ticket.blobName,
          expiresAt: ticket.expiresAt,
        },
      })
    } catch {
      await logMaintenanceError(
        dependencies.logger,
        'KB upload cleanup failed',
        { uploadTicketId: ticket.id }
      )
    }
  })

  const deletedResourceWhere = {
    deletedAt: { not: null },
    ingestionOperation: KBIngestionOperation.DELETE,
    activeResourceVersion: null,
    activeContentSha256: null,
    ingestionAttemptId: { not: null },
    ingestionRuns: {
      some: {
        operation: KBIngestionOperation.DELETE,
        status: KBIngestionStatus.SUCCEEDED,
      },
    },
  } satisfies Prisma.KBResourceWhereInput
  const deletedResourceCount = await dependencies.prisma.kBResource.count({
    where: deletedResourceWhere,
  })
  const deletedResourceOffset = getBatchOffset(deletedResourceCount, now)
  const deletedResources = await dependencies.prisma.kBResource.findMany({
    where: deletedResourceWhere,
    select: {
      id: true,
      type: true,
      blobName: true,
      ingestionAttemptId: true,
      kb: { select: { ownerId: true } },
      ingestionRuns: {
        where: {
          operation: KBIngestionOperation.DELETE,
          status: KBIngestionStatus.SUCCEEDED,
        },
        select: { id: true },
      },
    },
    orderBy: { id: 'asc' },
    ...(deletedResourceOffset > 0 ? { skip: deletedResourceOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(deletedResources, async (resource) => {
    if (
      !resource.ingestionAttemptId ||
      !resource.ingestionRuns.some(
        ({ id }) => id === resource.ingestionAttemptId
      )
    ) {
      return
    }
    try {
      if (resource.type === KBResourceType.BLOB) {
        if (!resource.blobName) {
          throw new Error('KB blob metadata is invalid')
        }
        await deleteBlob(resource.kb.ownerId, resource.blobName)
      }
      await dependencies.prisma.kBResource.deleteMany({
        where: {
          id: resource.id,
          deletedAt: { not: null },
          ingestionOperation: KBIngestionOperation.DELETE,
          ingestionAttemptId: resource.ingestionAttemptId,
          activeResourceVersion: null,
          activeContentSha256: null,
          ingestionRuns: {
            some: {
              id: resource.ingestionAttemptId,
              operation: KBIngestionOperation.DELETE,
              status: KBIngestionStatus.SUCCEEDED,
            },
          },
        },
      })
    } catch {
      await logMaintenanceError(
        dependencies.logger,
        'KB resource cleanup failed',
        { resourceId: resource.id }
      )
    }
  })

  const deletedKbWhere = {
    deletedAt: { not: null },
    resources: { none: {} },
    uploadTickets: { none: {} },
    chatbots: { none: { isEnabled: true } },
  } satisfies Prisma.KBWhereInput
  const deletedKbCount = await dependencies.prisma.kB.count({
    where: deletedKbWhere,
  })
  const deletedKbOffset = getBatchOffset(deletedKbCount, now)
  const deletedKbs = await dependencies.prisma.kB.findMany({
    where: deletedKbWhere,
    select: { id: true },
    orderBy: { id: 'asc' },
    ...(deletedKbOffset > 0 ? { skip: deletedKbOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(deletedKbs, async (kb) => {
    try {
      await dependencies.prisma.kB.deleteMany({
        where: {
          id: kb.id,
          ...deletedKbWhere,
        },
      })
    } catch {
      await logMaintenanceError(dependencies.logger, 'KB cleanup failed', {
        kbId: kb.id,
      })
    }
  })
}

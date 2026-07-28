import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceType,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { DeleteKBResourceInput } from '@klicker-uzh/types'
import { dispatchKBDeletion, type KBIngestionLogger } from './kbIngestion.js'
import {
  createKBIngestionApiClient,
  type KBIngestionApiClient,
} from './kbIngestionApi.js'

const KB_MAINTENANCE_BATCH_SIZE = 32
const KB_MAINTENANCE_CONCURRENCY = 8
const KB_UPLOAD_RETENTION_GRACE_MS = 24 * 60 * 60 * 1000
const KB_BLOB_DELETE_TIMEOUT_MS = 30_000

type KBMaintenanceDependencies = {
  prisma: PrismaClient
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
  deleteBlob?: (
    ownerId: string,
    blobName: string,
    env: NodeJS.ProcessEnv
  ) => Promise<void>
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
  const deleteBlob = dependencies.deleteBlob ?? deleteKBBlob

  const pendingDispatch = await dependencies.prisma.kBResource.findMany({
    where: {
      deletedAt: { not: null },
      ingestionOperation: KBIngestionOperation.DELETE,
      ingestionAttemptId: { not: null },
      externalOperationId: null,
    },
    select: {
      id: true,
      kbId: true,
      ingestionAttemptId: true,
      resourceVersion: true,
    },
    orderBy: { id: 'asc' },
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  if (pendingDispatch.length > 0) {
    const client = dependencies.client ?? createKBIngestionApiClient({ env })
    await runBounded(pendingDispatch, async (resource) => {
      const input = {
        resourceId: resource.id,
        kbId: resource.kbId,
        deletionAttemptId: resource.ingestionAttemptId!,
        resourceVersion: resource.resourceVersion,
      } satisfies DeleteKBResourceInput
      try {
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
            deletionAttemptId: resource.ingestionAttemptId!,
          }
        )
      }
    })
  }

  const expiredBefore = new Date(now.getTime() - KB_UPLOAD_RETENTION_GRACE_MS)
  const expiredTickets = await dependencies.prisma.kBUploadTicket.findMany({
    where: { expiresAt: { lte: expiredBefore } },
    select: {
      id: true,
      blobName: true,
      expiresAt: true,
      kb: { select: { ownerId: true } },
    },
    orderBy: { id: 'asc' },
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(expiredTickets, async (ticket) => {
    try {
      await deleteBlob(ticket.kb.ownerId, ticket.blobName, env)
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

  const deletedResources = await dependencies.prisma.kBResource.findMany({
    where: {
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
    },
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
        await deleteBlob(resource.kb.ownerId, resource.blobName, env)
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

  const deletedKbs = await dependencies.prisma.kB.findMany({
    where: {
      deletedAt: { not: null },
      resources: { none: {} },
      uploadTickets: { none: {} },
      chatbots: { none: { isEnabled: true } },
    },
    select: { id: true },
    orderBy: { id: 'asc' },
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  for (const kb of deletedKbs) {
    await dependencies.prisma.kB.deleteMany({
      where: {
        id: kb.id,
        deletedAt: { not: null },
        resources: { none: {} },
        uploadTickets: { none: {} },
        chatbots: { none: { isEnabled: true } },
      },
    })
  }
}

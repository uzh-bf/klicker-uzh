import {
  BlobServiceClient,
  StorageSharedKeyCredential,
} from '@azure/storage-blob'
import {
  deleteKnowledgeGraph,
  getKnowledgeGraphName,
} from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
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
import { getBlobStorageAccountUrl } from '@klicker-uzh/util'
import { randomUUID } from 'node:crypto'
import { getKBGraphArtifactBlobName } from './kbGraphIngestionApi.js'
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
// How long a retired FalkorDB graph (neither active nor published) is kept before
// the serving projection is dropped. The GraphML archive is on a separate clock.
const KB_GRAPH_RETENTION_GRACE_MS = 24 * 60 * 60 * 1000
// ADR 0015: deleting a knowledge base starts a 30-day recovery grace, after which
// its archived GraphML versions are purged. Until then every archived version is
// restorable, so a lecturer can be rolled back to any earlier successful graph.
const KB_GRAPH_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000
const KB_BLOB_DELETE_TIMEOUT_MS = 30_000
const KB_TERMINAL_DELETION_STATUSES = [
  KBIngestionStatus.FAILED,
  KBIngestionStatus.SUPERSEDED,
]
// A build reaches one of these statuses only after the external run completed and
// exported its GraphML, so its artifact is a real, restorable graph version.
// SUPERSEDED is reached solely by a late success that a newer build outran
// (`KB_GRAPH_LATE_SUCCESS_SUPERSEDED`), which still produced a valid export.
const KB_GRAPH_ARCHIVED_ARTIFACT_STATUSES: KBGraphBuildStatus[] = [
  KBGraphBuildStatus.SUCCEEDED,
  KBGraphBuildStatus.SUPERSEDED,
]

type KBMaintenanceDependencies = {
  prisma: PrismaClient
  client?: KBIngestionApiClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
  deleteBlob?: (ownerId: string, blobName: string) => Promise<void>
  deleteGraph?: (graphName: string) => Promise<void>
  // Maintenance holds no task handles, so the caller supplies the re-enqueue.
  enqueueKBGraphBuild?: (buildId: string) => Promise<void>
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

async function logInvalidRetryPayload(
  logger: KBIngestionLogger | undefined,
  resource: { id: string; kbId: string },
  ingestionAttemptId: string
) {
  await logMaintenanceError(logger, 'KB ingestion retry payload is invalid', {
    resourceId: resource.id,
    kbId: resource.kbId,
    ingestionAttemptId,
  })
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
  const pageCount = Math.ceil(total / KB_MAINTENANCE_BATCH_SIZE)
  return (runNumber % pageCount) * KB_MAINTENANCE_BATCH_SIZE
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
    getBlobStorageAccountUrl(
      accountName,
      env.BLOB_STORAGE_INTERNAL_ACCOUNT_URL ?? env.BLOB_STORAGE_ACCOUNT_URL
    ),
    credential
  )
  await serviceClient
    .getContainerClient(`kb-${ownerId}`)
    .getBlobClient(blobName)
    .deleteIfExists({
      abortSignal: AbortSignal.timeout(KB_BLOB_DELETE_TIMEOUT_MS),
    })
}

function isExpectedKBGraphArtifactName(blobName: string, buildId: string) {
  return blobName === getKBGraphArtifactBlobName(buildId)
}

export async function maintainKBResources(
  dependencies: KBMaintenanceDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = (dependencies.now ?? (() => new Date()))()
  const deleteBlob =
    dependencies.deleteBlob ??
    ((ownerId, blobName) => deleteKBBlob(ownerId, blobName, env))
  const deleteGraph = dependencies.deleteGraph ?? deleteKnowledgeGraph

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
          await logInvalidRetryPayload(
            dependencies.logger,
            resource,
            ingestionAttemptId
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
          await logInvalidRetryPayload(
            dependencies.logger,
            resource,
            ingestionAttemptId
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

  // The graph-build analogue of the UPSERT recovery above. `rebuildKbKnowledgeGraph`
  // commits the reservation and the build-slot claim, then enqueues the task; a
  // crash in between leaves a QUEUED build with neither an externalOperationId nor
  // a dispatch claim. `monitorActiveKBGraphBuilds` skips it (it requires a
  // correlated run) and it has no finishedAt for the retention sweep, so the KB's
  // build slot and the lecturer's quota reservation would stay held forever.
  const enqueueKBGraphBuild = dependencies.enqueueKBGraphBuild
  if (enqueueKBGraphBuild) {
    const graphDispatchStaleBefore = new Date(
      now.getTime() - KB_MAINTENANCE_INTERVAL_MS
    )
    const graphDispatchRetryWhere = {
      status: KBGraphBuildStatus.QUEUED,
      externalOperationId: null,
      dispatchClaimedAt: null,
      createdAt: { lte: graphDispatchStaleBefore },
    } satisfies Prisma.KBGraphBuildWhereInput
    const graphDispatchRetryCount =
      await dependencies.prisma.kBGraphBuild.count({
        where: graphDispatchRetryWhere,
      })
    const graphDispatchRetryOffset = getBatchOffset(
      graphDispatchRetryCount,
      now
    )
    const graphDispatchRetries =
      await dependencies.prisma.kBGraphBuild.findMany({
        where: graphDispatchRetryWhere,
        select: { id: true, kbId: true },
        orderBy: { id: 'asc' },
        ...(graphDispatchRetryOffset > 0
          ? { skip: graphDispatchRetryOffset }
          : {}),
        take: KB_MAINTENANCE_BATCH_SIZE,
      })
    await runBounded(graphDispatchRetries, async (build) => {
      try {
        // The build id is already the external idempotency key and the real
        // provider call is fenced by `dispatchClaimedAt`, so re-enqueuing the
        // same id can never start a second external run or a second charge.
        await enqueueKBGraphBuild(build.id)
      } catch {
        await logMaintenanceError(
          dependencies.logger,
          'KB graph build dispatch retry failed',
          { buildId: build.id, kbId: build.kbId }
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

  const expiredGraphBefore = new Date(
    now.getTime() - KB_GRAPH_RETENTION_GRACE_MS
  )
  const graphCleanupWhere = {
    status: {
      in: [
        KBGraphBuildStatus.SUCCEEDED,
        KBGraphBuildStatus.FAILED,
        KBGraphBuildStatus.SUPERSEDED,
      ],
    },
    finishedAt: { lte: expiredGraphBefore },
    cleanedAt: null,
    OR: [
      { cleanupStartedAt: null },
      { cleanupStartedAt: { lt: expiredGraphBefore } },
    ],
  } satisfies Prisma.KBGraphBuildWhereInput
  const retainedGraphCount = await dependencies.prisma.kBGraphBuild.count({
    where: graphCleanupWhere,
  })
  const retainedGraphOffset = getBatchOffset(retainedGraphCount, now)
  const retainedGraphBuilds = await dependencies.prisma.kBGraphBuild.findMany({
    where: graphCleanupWhere,
    select: {
      id: true,
      kbId: true,
      status: true,
      graphName: true,
      graphmlBlobName: true,
      kb: {
        select: {
          ownerId: true,
          activeGraphBuildId: true,
          publishedGraphBuildId: true,
        },
      },
    },
    orderBy: { finishedAt: 'asc' },
    ...(retainedGraphOffset > 0 ? { skip: retainedGraphOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(retainedGraphBuilds, async (build) => {
    if (
      build.kb.activeGraphBuildId === build.id ||
      build.kb.publishedGraphBuildId === build.id
    ) {
      return
    }
    if (build.graphName !== getKnowledgeGraphName(build.kbId, build.id)) {
      await logMaintenanceError(
        dependencies.logger,
        'KB graph cleanup rejected an invalid graph name',
        { buildId: build.id, kbId: build.kbId }
      )
      return
    }
    if (
      build.graphmlBlobName !== null &&
      !isExpectedKBGraphArtifactName(build.graphmlBlobName, build.id)
    ) {
      await logMaintenanceError(
        dependencies.logger,
        'KB graph cleanup rejected an invalid artifact name',
        { buildId: build.id, kbId: build.kbId }
      )
      return
    }

    const claimed = await dependencies.prisma.kBGraphBuild.updateMany({
      where: {
        id: build.id,
        kbId: build.kbId,
        status: {
          in: [
            KBGraphBuildStatus.SUCCEEDED,
            KBGraphBuildStatus.FAILED,
            KBGraphBuildStatus.SUPERSEDED,
          ],
        },
        finishedAt: { lte: expiredGraphBefore },
        cleanedAt: null,
        OR: [
          { cleanupStartedAt: null },
          { cleanupStartedAt: { lt: expiredGraphBefore } },
        ],
        kb: {
          OR: [
            { activeGraphBuildId: null },
            { activeGraphBuildId: { not: build.id } },
          ],
          AND: [
            {
              OR: [
                { publishedGraphBuildId: null },
                { publishedGraphBuildId: { not: build.id } },
              ],
            },
          ],
        },
      },
      data: { cleanupStartedAt: now },
    })
    if (claimed.count !== 1) {
      return
    }

    // Only the serving projection is retired here. A build that exported a
    // GraphML keeps it until its knowledge base is deleted and the recovery
    // grace expires, so an earlier version stays restorable; a build that never
    // produced an export has nothing worth retaining.
    const purgeArchive = !KB_GRAPH_ARCHIVED_ARTIFACT_STATUSES.includes(
      build.status
    )
    try {
      if (purgeArchive && build.graphmlBlobName) {
        await deleteBlob(build.kb.ownerId, build.graphmlBlobName)
      }
      await deleteGraph(build.graphName)
      const cleaned = await dependencies.prisma.kBGraphBuild.updateMany({
        where: {
          id: build.id,
          kbId: build.kbId,
          cleanedAt: null,
          cleanupStartedAt: now,
          status: {
            in: [
              KBGraphBuildStatus.SUCCEEDED,
              KBGraphBuildStatus.FAILED,
              KBGraphBuildStatus.SUPERSEDED,
            ],
          },
          kb: {
            OR: [
              { activeGraphBuildId: null },
              { activeGraphBuildId: { not: build.id } },
            ],
            AND: [
              {
                OR: [
                  { publishedGraphBuildId: null },
                  { publishedGraphBuildId: { not: build.id } },
                ],
              },
            ],
          },
        },
        data: {
          cleanedAt: now,
          ...(purgeArchive ? { graphmlPurgedAt: now } : {}),
        },
      })
      if (cleaned.count !== 1) {
        throw new Error('KB graph cleanup claim was lost')
      }
    } catch {
      try {
        await dependencies.prisma.kBGraphBuild.updateMany({
          where: {
            id: build.id,
            kbId: build.kbId,
            cleanedAt: null,
            cleanupStartedAt: now,
          },
          data: { cleanupStartedAt: null },
        })
      } catch {
        // A stale claim is reclaimable on a later sweep after the grace window.
      }
      await logMaintenanceError(
        dependencies.logger,
        'KB graph cleanup failed',
        {
          buildId: build.id,
          kbId: build.kbId,
        }
      )
    }
  })

  // ADR 0015: once the deletion recovery grace has expired there is nothing left
  // to restore, so every remaining artifact of that knowledge base goes. This
  // pass deliberately ignores `activeGraphBuildId`/`publishedGraphBuildId`: the
  // KB is gone, and a build still holding the slot when it was deleted would
  // otherwise keep its graph and archive forever.
  const purgeArchiveBefore = new Date(
    now.getTime() - KB_GRAPH_DELETION_GRACE_MS
  )
  const archivePurgeWhere = {
    graphmlPurgedAt: null,
    kb: { deletedAt: { lte: purgeArchiveBefore } },
  } satisfies Prisma.KBGraphBuildWhereInput
  const archivePurgeCount = await dependencies.prisma.kBGraphBuild.count({
    where: archivePurgeWhere,
  })
  const archivePurgeOffset = getBatchOffset(archivePurgeCount, now)
  const purgeableArchives = await dependencies.prisma.kBGraphBuild.findMany({
    where: archivePurgeWhere,
    select: {
      id: true,
      kbId: true,
      graphName: true,
      graphmlBlobName: true,
      cleanedAt: true,
      kb: { select: { ownerId: true } },
    },
    orderBy: { id: 'asc' },
    ...(archivePurgeOffset > 0 ? { skip: archivePurgeOffset } : {}),
    take: KB_MAINTENANCE_BATCH_SIZE,
  })
  await runBounded(purgeableArchives, async (build) => {
    if (build.graphName !== getKnowledgeGraphName(build.kbId, build.id)) {
      await logMaintenanceError(
        dependencies.logger,
        'KB graph archive purge rejected an invalid graph name',
        { buildId: build.id, kbId: build.kbId }
      )
      return
    }
    if (
      build.graphmlBlobName !== null &&
      !isExpectedKBGraphArtifactName(build.graphmlBlobName, build.id)
    ) {
      await logMaintenanceError(
        dependencies.logger,
        'KB graph archive purge rejected an invalid artifact name',
        { buildId: build.id, kbId: build.kbId }
      )
      return
    }
    try {
      if (build.graphmlBlobName) {
        await deleteBlob(build.kb.ownerId, build.graphmlBlobName)
      }
      if (build.cleanedAt === null) {
        await deleteGraph(build.graphName)
      }
      // The ledger row survives the purge (ADR 0013 keeps its cost evidence);
      // only the stamps recording that the artifacts are gone are written.
      await dependencies.prisma.kBGraphBuild.updateMany({
        where: { id: build.id, kbId: build.kbId, graphmlPurgedAt: null },
        data: {
          graphmlPurgedAt: now,
          ...(build.cleanedAt === null ? { cleanedAt: now } : {}),
        },
      })
    } catch {
      await logMaintenanceError(
        dependencies.logger,
        'KB graph archive purge failed',
        { buildId: build.id, kbId: build.kbId }
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

  // `KBGraphBuild.kb` cascades, so hard-deleting a KB would take its build ledger
  // — metered cost, pricing version and actual provider usage — with it. ADR 0013
  // requires that evidence to stay auditable, so a KB that ever ran a graph build
  // keeps its tombstone row permanently and only its artifacts are purged above.
  // KBs that never built a graph are removed once the recovery grace has expired.
  const deletedKbWhere = {
    deletedAt: { not: null, lte: purgeArchiveBefore },
    resources: { none: {} },
    uploadTickets: { none: {} },
    chatbots: { none: { isEnabled: true } },
    graphBuilds: { none: {} },
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

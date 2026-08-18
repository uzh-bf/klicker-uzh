import {
  KBGraphBuildStatus,
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
  KBResourceType,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { KBIngestionApiClient } from '../src/kbIngestionApi.js'
import {
  KB_MAINTENANCE_INTERVAL_MS,
  maintainKBResources,
} from '../src/kbMaintenance.js'

const RESOURCE_ID = '7f3e2a10-9c4b-4d8e-b1a6-5e0f9d2c7b3a'
const KB_ID = 'c2a91f74-6e0b-4c3d-8f5a-1b9e7d4a2c60'
const OWNER_ID = 'f490ce41-bd11-42c1-b601-74bdbcd4d3d7'
const ATTEMPT_ID = 'b5d4c3a2-1f0e-4d9c-8b7a-6e5f4d3c2b1a'
const OPERATION_ID = 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND'
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'
const NOW = new Date('2026-07-27T12:00:00.000Z')
const GRAPH_DELETION_GRACE_MS = 30 * 24 * 60 * 60 * 1000
const BUILD_ID = 'f1fbd1fd-aabb-4dd4-8e64-2f9a13a971a6'
const GRAPH_NAME = `klickeruzh:kb:${KB_ID}:${BUILD_ID}`
const GRAPHML_BLOB_NAME = `knowledge-graphs/${BUILD_ID}.graphml`

function client(): KBIngestionApiClient {
  return {
    acceptResource: vi.fn().mockResolvedValue(OPERATION_ID),
    deleteResource: vi.fn().mockResolvedValue(OPERATION_ID),
    getOperation: vi.fn(),
  }
}

function maintenancePrisma({
  pendingDispatch = [],
  pendingDispatchCount = pendingDispatch.length,
  pendingUpsertRetries = [],
  pendingUpsertRetryCount = pendingUpsertRetries.length,
  expiredTickets = [],
  expiredTicketCount = expiredTickets.length,
  deletedResources = [],
  deletedResourceCount = deletedResources.length,
  deletedKbs = [],
  deletedKbCount = deletedKbs.length,
  pendingGraphDispatch,
  pendingGraphDispatchCount,
  retainedGraphBuilds = [],
  retainedGraphBuildCount = retainedGraphBuilds.length,
  purgeableArchives = [],
  purgeableArchiveCount = purgeableArchives.length,
  currentResource,
}: {
  pendingDispatch?: unknown[]
  pendingDispatchCount?: number
  pendingUpsertRetries?: unknown[]
  pendingUpsertRetryCount?: number
  expiredTickets?: unknown[]
  expiredTicketCount?: number
  deletedResources?: unknown[]
  deletedResourceCount?: number
  deletedKbs?: unknown[]
  deletedKbCount?: number
  pendingGraphDispatch?: unknown[]
  pendingGraphDispatchCount?: number
  retainedGraphBuilds?: unknown[]
  retainedGraphBuildCount?: number
  purgeableArchives?: unknown[]
  purgeableArchiveCount?: number
  currentResource?: unknown
} = {}) {
  // The sweep queries KBGraphBuild once per pass, in order. The stranded-dispatch
  // pass only runs when the caller wires `enqueueKBGraphBuild`, which is what
  // supplying `pendingGraphDispatch` stands for here.
  const graphBuildPages: Array<{ count: number; rows: unknown[] }> = [
    ...(pendingGraphDispatch
      ? [
          {
            count: pendingGraphDispatchCount ?? pendingGraphDispatch.length,
            rows: pendingGraphDispatch,
          },
        ]
      : []),
    { count: retainedGraphBuildCount, rows: retainedGraphBuilds },
    { count: purgeableArchiveCount, rows: purgeableArchives },
  ]
  const graphBuildCount = vi.fn()
  const graphBuildFindMany = vi.fn()
  for (const page of graphBuildPages) {
    graphBuildCount.mockResolvedValueOnce(page.count)
    graphBuildFindMany.mockResolvedValueOnce(page.rows)
  }
  const prisma = {
    kBResource: {
      count: vi
        .fn()
        .mockResolvedValueOnce(pendingDispatchCount)
        .mockResolvedValueOnce(pendingUpsertRetryCount)
        .mockResolvedValueOnce(deletedResourceCount),
      findMany: vi
        .fn()
        .mockResolvedValueOnce(pendingDispatch)
        .mockResolvedValueOnce(pendingUpsertRetries)
        .mockResolvedValueOnce(deletedResources),
      findUnique: vi.fn().mockResolvedValue(currentResource),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBIngestionRun: {
      create: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBUploadTicket: {
      count: vi.fn().mockResolvedValue(expiredTicketCount),
      findMany: vi.fn().mockResolvedValue(expiredTickets),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kB: {
      count: vi.fn().mockResolvedValue(deletedKbCount),
      findMany: vi.fn().mockResolvedValue(deletedKbs),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBGraphBuild: {
      count: graphBuildCount,
      findMany: graphBuildFindMany,
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  return prisma
}

describe('KB retention maintenance', () => {
  it('retries an undispatched tombstone with its stable attempt id', async () => {
    const pending = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: null,
      ingestionRuns: [],
    }
    const prisma = maintenancePrisma({
      pendingDispatch: [pending],
      currentResource: {
        kbId: KB_ID,
        deletedAt: NOW,
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 4,
        externalOperationId: null,
      },
    })
    const apiClient = client()

    await maintainKBResources({
      prisma: prisma as never,
      client: apiClient,
      now: () => NOW,
    })

    expect(apiClient.deleteResource).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      kbId: KB_ID,
      deletionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
    })
  })

  it.each([
    KBIngestionStatus.FAILED,
    KBIngestionStatus.SUPERSEDED,
  ])('starts a fresh attempt after a terminal external delete result (%s)', async (terminalStatus) => {
    const failedOperationId = 'op_01J2X8K3M9QZ4R7T6V5W1Y0OLD'
    const failed = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      status: KBResourceStatus.FAILED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: failedOperationId,
      ingestionRuns: [{ id: ATTEMPT_ID, status: terminalStatus }],
    }
    const prisma = maintenancePrisma({ pendingDispatch: [failed] })
    prisma.kBResource.findMany.mockReset()
    prisma.kBResource.findMany
      .mockImplementationOnce(async (args) => {
        const terminalStatuses = args.select.ingestionRuns.where.status.in
        return terminalStatuses.includes(terminalStatus) ? [failed] : []
      })
      .mockResolvedValueOnce([]) // no stranded UPSERT dispatches
      .mockResolvedValueOnce([]) // no hard-deletable resources
    prisma.kBResource.updateMany
      .mockReset()
      .mockImplementationOnce(async (args) => {
        const terminalStatuses = args.where.ingestionRuns.some.status.in
        return { count: terminalStatuses.includes(terminalStatus) ? 1 : 0 }
      })
      .mockResolvedValue({ count: 1 })
    prisma.kBResource.findUnique.mockImplementation(async () => {
      const retryAttemptId =
        prisma.kBIngestionRun.create.mock.calls[0]?.[0].data.id
      return {
        kbId: KB_ID,
        deletedAt: NOW,
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: retryAttemptId,
        resourceVersion: 4,
        externalOperationId: null,
      }
    })
    const apiClient = client()

    await maintainKBResources({
      prisma: prisma as never,
      client: apiClient,
      now: () => NOW,
    })

    const retryAttemptId =
      prisma.kBIngestionRun.create.mock.calls[0]?.[0].data.id
    expect(retryAttemptId).toEqual(expect.any(String))
    expect(retryAttemptId).not.toBe(ATTEMPT_ID)
    expect(prisma.kBResource.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        select: expect.objectContaining({
          ingestionRuns: expect.objectContaining({
            where: {
              operation: KBIngestionOperation.DELETE,
              status: {
                in: [KBIngestionStatus.FAILED, KBIngestionStatus.SUPERSEDED],
              },
            },
          }),
        }),
      })
    )
    expect(prisma.kBResource.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: RESOURCE_ID,
        deletedAt: { not: null },
        status: KBResourceStatus.FAILED,
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 4,
        externalOperationId: failedOperationId,
        ingestionRuns: {
          some: {
            id: ATTEMPT_ID,
            operation: KBIngestionOperation.DELETE,
            status: {
              in: [KBIngestionStatus.FAILED, KBIngestionStatus.SUPERSEDED],
            },
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
    expect(apiClient.deleteResource).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      kbId: KB_ID,
      deletionAttemptId: retryAttemptId,
      resourceVersion: 4,
    })
  })

  it('continues independent cleanup when deletion dispatch is not configured', async () => {
    const expiresAt = new Date(NOW.getTime() - 25 * 60 * 60 * 1000)
    const pending = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: null,
      ingestionRuns: [],
    }
    const ticket = {
      id: '77996ac1-ad9a-4379-8ff8-2a07d2184a31',
      blobName: 'abandoned.pdf',
      expiresAt,
      kb: { ownerId: OWNER_ID },
    }
    const prisma = maintenancePrisma({
      pendingDispatch: [pending],
      currentResource: {
        kbId: KB_ID,
        deletedAt: NOW,
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 4,
        externalOperationId: null,
      },
      expiredTickets: [ticket],
    })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      env: {},
      now: () => NOW,
      deleteBlob,
    })

    expect(deleteBlob).toHaveBeenCalledWith(OWNER_ID, ticket.blobName)
    expect(prisma.kBUploadTicket.deleteMany).toHaveBeenCalledOnce()
  })

  it('rotates bounded retries so retained failures cannot starve later rows', async () => {
    const rotatedNow = new Date(NOW.getTime() + 15 * 60 * 1000)
    const pending = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: null,
      ingestionRuns: [],
    }
    const prisma = maintenancePrisma({
      pendingDispatch: [pending],
      pendingDispatchCount: 64,
      currentResource: {
        kbId: KB_ID,
        deletedAt: NOW,
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 4,
        externalOperationId: null,
      },
    })

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => rotatedNow,
    })

    expect(prisma.kBResource.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ skip: 32, take: 32 })
    )
  })

  it('deletes an abandoned blob before consuming its expired ticket', async () => {
    const expiresAt = new Date(NOW.getTime() - 24 * 60 * 60 * 1000 - 1)
    const ticket = {
      id: ATTEMPT_ID,
      blobName: `${ATTEMPT_ID}.pdf`,
      expiresAt,
      kb: { ownerId: OWNER_ID },
    }
    const prisma = maintenancePrisma({ expiredTickets: [ticket] })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
    })

    expect(deleteBlob).toHaveBeenCalledWith(OWNER_ID, ticket.blobName)
    expect(prisma.kBUploadTicket.deleteMany).toHaveBeenCalledWith({
      where: {
        id: ticket.id,
        blobName: ticket.blobName,
        expiresAt,
      },
    })
    expect(deleteBlob.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.kBUploadTicket.deleteMany.mock.invocationCallOrder[0]!
    )
    expect(prisma.kBUploadTicket.findMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lte: new Date(NOW.getTime() - 24 * 60 * 60 * 1000),
        },
      },
      select: {
        id: true,
        blobName: true,
        expiresAt: true,
        kb: { select: { ownerId: true } },
      },
      orderBy: { id: 'asc' },
      take: 32,
    })
  })

  it('retains an upload ticket when blob cleanup fails', async () => {
    const ticket = {
      id: ATTEMPT_ID,
      blobName: `${ATTEMPT_ID}.pdf`,
      expiresAt: new Date(NOW.getTime() - 25 * 60 * 60 * 1000),
      kb: { ownerId: OWNER_ID },
    }
    const prisma = maintenancePrisma({ expiredTickets: [ticket] })

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob: vi.fn().mockRejectedValue(new Error('storage unavailable')),
    })

    expect(prisma.kBUploadTicket.deleteMany).not.toHaveBeenCalled()
  })

  it('hard-deletes a tombstoned blob only after its current delete succeeded', async () => {
    const resource = {
      id: RESOURCE_ID,
      type: KBResourceType.BLOB,
      blobName: `${RESOURCE_ID}.pdf`,
      ingestionAttemptId: ATTEMPT_ID,
      kb: { ownerId: OWNER_ID },
      ingestionRuns: [{ id: ATTEMPT_ID }],
    }
    const prisma = maintenancePrisma({ deletedResources: [resource] })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
    })

    expect(deleteBlob).toHaveBeenCalledWith(OWNER_ID, resource.blobName)
    expect(prisma.kBResource.deleteMany).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        deletedAt: { not: null },
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        activeResourceVersion: null,
        activeContentSha256: null,
        ingestionRuns: {
          some: {
            id: ATTEMPT_ID,
            operation: KBIngestionOperation.DELETE,
            status: KBIngestionStatus.SUCCEEDED,
          },
        },
      },
    })
    expect(deleteBlob.mock.invocationCallOrder[0]).toBeLessThan(
      prisma.kBResource.deleteMany.mock.invocationCallOrder[0]!
    )
  })

  it('does not clean a resource whose current delete run has not succeeded', async () => {
    const prisma = maintenancePrisma({
      deletedResources: [
        {
          id: RESOURCE_ID,
          type: KBResourceType.URL,
          blobName: null,
          ingestionAttemptId: ATTEMPT_ID,
          kb: { ownerId: OWNER_ID },
          ingestionRuns: [{ id: '3139acdc-4639-4af3-9f6d-458867e09d98' }],
        },
      ],
    })

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob: vi.fn(),
    })

    expect(prisma.kBResource.deleteMany).not.toHaveBeenCalled()
  })

  it('hard-deletes a tombstoned URL without touching blob storage', async () => {
    const resource = {
      id: RESOURCE_ID,
      type: KBResourceType.URL,
      blobName: null,
      ingestionAttemptId: ATTEMPT_ID,
      kb: { ownerId: OWNER_ID },
      ingestionRuns: [{ id: ATTEMPT_ID }],
    }
    const prisma = maintenancePrisma({ deletedResources: [resource] })
    const deleteBlob = vi.fn()

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
    })

    expect(deleteBlob).not.toHaveBeenCalled()
    expect(prisma.kBResource.deleteMany).toHaveBeenCalledOnce()
  })

  it('finalizes a pending knowledge base only after all children are gone', async () => {
    const prisma = maintenancePrisma({ deletedKbs: [{ id: KB_ID }] })

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob: vi.fn(),
    })

    expect(prisma.kB.deleteMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: KB_ID,
        resources: { none: {} },
        uploadTickets: { none: {} },
        chatbots: { none: { isEnabled: true } },
        // A build ledger row carries the settled cost evidence and cascades from
        // the KB, so only a knowledge base that never built a graph is removed,
        // and only once the recovery grace has expired.
        graphBuilds: { none: {} },
        deletedAt: {
          not: null,
          lte: new Date(NOW.getTime() - GRAPH_DELETION_GRACE_MS),
        },
      }),
    })
  })

  it('retires an unreferenced successful graph but keeps its GraphML archive', async () => {
    const prisma = maintenancePrisma({
      retainedGraphBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          status: KBGraphBuildStatus.SUCCEEDED,
          graphName: GRAPH_NAME,
          graphmlBlobName: GRAPHML_BLOB_NAME,
          kb: {
            ownerId: OWNER_ID,
            activeGraphBuildId: null,
            publishedGraphBuildId: null,
          },
        },
      ],
    })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)
    const deleteGraph = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
      deleteGraph,
    })

    // The serving projection is reconstructible and goes after the short grace;
    // the archive is the durable record and stays while the KB exists, so an
    // earlier successful version remains restorable.
    expect(deleteGraph).toHaveBeenCalledWith(GRAPH_NAME)
    expect(deleteBlob).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BUILD_ID, cleanedAt: null }),
        data: { cleanedAt: NOW },
      })
    )
    expect(prisma.kBGraphBuild.updateMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BUILD_ID,
          cleanedAt: null,
          OR: expect.arrayContaining([{ cleanupStartedAt: null }]),
        }),
        data: { cleanupStartedAt: NOW },
      })
    )
  })

  it('purges the pinned artifact of a build that never produced an export', async () => {
    const prisma = maintenancePrisma({
      retainedGraphBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          status: KBGraphBuildStatus.FAILED,
          graphName: GRAPH_NAME,
          graphmlBlobName: GRAPHML_BLOB_NAME,
          kb: {
            ownerId: OWNER_ID,
            activeGraphBuildId: null,
            publishedGraphBuildId: null,
          },
        },
      ],
    })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)
    const deleteGraph = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
      deleteGraph,
    })

    expect(deleteBlob).toHaveBeenCalledWith(OWNER_ID, GRAPHML_BLOB_NAME)
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { cleanedAt: NOW, graphmlPurgedAt: NOW },
      })
    )
  })

  it('purges a retained archive only once the deletion recovery grace expired', async () => {
    const prisma = maintenancePrisma({
      purgeableArchives: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          graphName: GRAPH_NAME,
          graphmlBlobName: GRAPHML_BLOB_NAME,
          cleanedAt: NOW,
          kb: { ownerId: OWNER_ID },
        },
      ],
    })
    const deleteBlob = vi.fn().mockResolvedValue(undefined)
    const deleteGraph = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      deleteBlob,
      deleteGraph,
    })

    // The pass is selected purely on how long the KB has been deleted, and it
    // leaves the ledger row in place so the settled cost stays auditable.
    expect(prisma.kBGraphBuild.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          graphmlPurgedAt: null,
          kb: {
            deletedAt: {
              lte: new Date(NOW.getTime() - GRAPH_DELETION_GRACE_MS),
            },
          },
        },
      })
    )
    expect(deleteBlob).toHaveBeenCalledWith(OWNER_ID, GRAPHML_BLOB_NAME)
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith({
      where: { id: BUILD_ID, kbId: KB_ID, graphmlPurgedAt: null },
      data: { graphmlPurgedAt: NOW },
    })
  })

  it('re-enqueues a graph build stranded between its reservation and its dispatch', async () => {
    const prisma = maintenancePrisma({
      pendingGraphDispatch: [{ id: BUILD_ID, kbId: KB_ID }],
    })
    const enqueueKBGraphBuild = vi.fn().mockResolvedValue(undefined)

    await maintainKBResources({
      prisma: prisma as never,
      client: client(),
      now: () => NOW,
      enqueueKBGraphBuild,
    })

    expect(prisma.kBGraphBuild.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          status: KBGraphBuildStatus.QUEUED,
          externalOperationId: null,
          dispatchClaimedAt: null,
          createdAt: {
            lte: new Date(NOW.getTime() - KB_MAINTENANCE_INTERVAL_MS),
          },
        },
      })
    )
    // Recovery reuses the stored build id, which is already the external
    // idempotency key, so no second run and no second charge can start.
    expect(enqueueKBGraphBuild).toHaveBeenCalledWith(BUILD_ID)
  })

  it('retries a stranded UPSERT dispatch stuck in the crash window with its stable attempt id', async () => {
    const stranded = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      title: 'Lecture 1',
      type: KBResourceType.URL,
      blobName: null,
      mimeType: null,
      sizeBytes: null,
      sourceUrl: 'https://example.com/lecture.txt',
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      kb: { ownerId: OWNER_ID },
    }
    const prisma = maintenancePrisma({
      pendingUpsertRetries: [stranded],
      currentResource: {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: CONTENT_SHA256,
        mimeType: 'text/plain',
        sizeBytes: 1024,
        kbId: KB_ID,
        deletedAt: null,
        kb: { deletedAt: null },
        externalOperationId: null,
      },
    })
    const apiClient = client()

    await maintainKBResources({
      prisma: prisma as never,
      client: apiClient,
      now: () => NOW,
    })

    expect(apiClient.acceptResource).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        resourceVersion: 3,
        ingestionAttemptId: ATTEMPT_ID,
        source: expect.objectContaining({
          contentSha256: CONTENT_SHA256,
          mimeType: 'text/plain',
          sizeBytes: 1024,
        }),
      })
    )
    // Recovery reuses the existing attempt: no new attempt id, no status
    // transition performed by the maintenance sweep itself.
    expect(prisma.kBIngestionRun.create).not.toHaveBeenCalled()
  })

  it('excludes upsert rows that are fresh, still in flight, tombstoned, or mid-deletion', async () => {
    const prisma = maintenancePrisma()
    const apiClient = client()

    await maintainKBResources({
      prisma: prisma as never,
      client: apiClient,
      now: () => NOW,
    })

    expect(prisma.kBResource.findMany).toHaveBeenNthCalledWith(2, {
      where: {
        deletedAt: null,
        ingestionOperation: KBIngestionOperation.UPSERT,
        status: KBResourceStatus.QUEUED,
        externalOperationId: null,
        ingestionAttemptId: { not: null },
        updatedAt: {
          lte: new Date(NOW.getTime() - KB_MAINTENANCE_INTERVAL_MS),
        },
      },
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
      take: 32,
    })
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('re-dispatches the same attempt id across repeated sweeps without minting a new attempt', async () => {
    const stranded = {
      id: RESOURCE_ID,
      kbId: KB_ID,
      title: 'Lecture 1',
      type: KBResourceType.URL,
      blobName: null,
      mimeType: null,
      sizeBytes: null,
      sourceUrl: 'https://example.com/lecture.txt',
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      kb: { ownerId: OWNER_ID },
    }
    const currentResource = {
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      contentSha256: CONTENT_SHA256,
      mimeType: 'text/plain',
      sizeBytes: 1024,
      kbId: KB_ID,
      deletedAt: null,
      kb: { deletedAt: null },
      externalOperationId: null,
    }
    const apiClient = client()

    // Two independent sweeps against the same still-stranded row (e.g. a
    // second crash before the first sweep's dispatch could be correlated):
    // both must reuse the identical attempt id, which the ingestion API
    // dedupes on via its Idempotency-Key, so the double dispatch is harmless.
    const firstPrisma = maintenancePrisma({
      pendingUpsertRetries: [stranded],
      currentResource,
    })
    await maintainKBResources({
      prisma: firstPrisma as never,
      client: apiClient,
      now: () => NOW,
    })

    const secondPrisma = maintenancePrisma({
      pendingUpsertRetries: [stranded],
      currentResource,
    })
    await maintainKBResources({
      prisma: secondPrisma as never,
      client: apiClient,
      now: () => NOW,
    })

    expect(apiClient.acceptResource).toHaveBeenCalledTimes(2)
    for (const call of vi.mocked(apiClient.acceptResource).mock.calls) {
      expect(call[0]).toMatchObject({ ingestionAttemptId: ATTEMPT_ID })
    }
    expect(firstPrisma.kBIngestionRun.create).not.toHaveBeenCalled()
    expect(secondPrisma.kBIngestionRun.create).not.toHaveBeenCalled()
  })
})

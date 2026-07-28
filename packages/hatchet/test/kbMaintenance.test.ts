import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceType,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import type { KBIngestionApiClient } from '../src/kbIngestionApi.js'
import { maintainKBResources } from '../src/kbMaintenance.js'

const RESOURCE_ID = '7f3e2a10-9c4b-4d8e-b1a6-5e0f9d2c7b3a'
const KB_ID = 'c2a91f74-6e0b-4c3d-8f5a-1b9e7d4a2c60'
const OWNER_ID = 'f490ce41-bd11-42c1-b601-74bdbcd4d3d7'
const ATTEMPT_ID = 'b5d4c3a2-1f0e-4d9c-8b7a-6e5f4d3c2b1a'
const OPERATION_ID = 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND'
const NOW = new Date('2026-07-27T12:00:00.000Z')

function client(): KBIngestionApiClient {
  return {
    acceptResource: vi.fn(),
    deleteResource: vi.fn().mockResolvedValue(OPERATION_ID),
    getOperation: vi.fn(),
  }
}

function maintenancePrisma({
  pendingDispatch = [],
  expiredTickets = [],
  deletedResources = [],
  deletedKbs = [],
  currentResource,
}: {
  pendingDispatch?: unknown[]
  expiredTickets?: unknown[]
  deletedResources?: unknown[]
  deletedKbs?: unknown[]
  currentResource?: unknown
} = {}) {
  const prisma = {
    kBResource: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(pendingDispatch)
        .mockResolvedValueOnce(deletedResources),
      findUnique: vi.fn().mockResolvedValue(currentResource),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBIngestionRun: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBUploadTicket: {
      findMany: vi.fn().mockResolvedValue(expiredTickets),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kB: {
      findMany: vi.fn().mockResolvedValue(deletedKbs),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
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
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
    }
    const prisma = maintenancePrisma({
      pendingDispatch: [pending],
      currentResource: {
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
      where: {
        id: KB_ID,
        deletedAt: { not: null },
        resources: { none: {} },
        uploadTickets: { none: {} },
        chatbots: { none: { isEnabled: true } },
      },
    })
  })
})

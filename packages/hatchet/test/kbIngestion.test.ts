import {
  KBIngestionOperation,
  KBIngestionStatus,
  KBResourceStatus,
} from '@klicker-uzh/prisma/client'
import type {
  DeleteKBResourceInput,
  IngestKBResourceInput,
} from '@klicker-uzh/types'
import {
  MAX_KB_SOURCE_SIZE_BYTES,
  MAX_KB_TOTAL_SIZE_BYTES,
} from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchKBDeletion,
  dispatchKBIngestion,
  failKBIngestionDispatch,
  monitorActiveKBIngestions,
  retainFailedKBDeletionDispatch,
  validateKBIngestionWorkerConfig,
} from '../src/kbIngestion.js'
import type {
  KBIngestionApiClient,
  KBIngestionSource,
  KBOperationStatusResponse,
} from '../src/kbIngestionApi.js'

const RESOURCE_ID = '7f3e2a10-9c4b-4d8e-b1a6-5e0f9d2c7b3a'
const KB_ID = 'c2a91f74-6e0b-4c3d-8f5a-1b9e7d4a2c60'
const ATTEMPT_ID = 'b5d4c3a2-1f0e-4d9c-8b7a-6e5f4d3c2b1a'
const OPERATION_ID = 'op_01J2X8K3M9QZ4R7T6V5W1Y0BND'
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'
const NOW = new Date('2026-07-26T12:00:00.000Z')

const input = {
  resourceId: RESOURCE_ID,
  kbId: KB_ID,
  title: 'Lecture 1',
  ingestionAttemptId: ATTEMPT_ID,
  resourceVersion: 3,
  type: 'URL',
  sourceUrl: 'https://example.com/lecture.txt',
} satisfies IngestKBResourceInput

const deletionInput = {
  resourceId: RESOURCE_ID,
  kbId: KB_ID,
  deletionAttemptId: ATTEMPT_ID,
  resourceVersion: 4,
} satisfies DeleteKBResourceInput

const source = {
  kind: 'url',
  url: input.sourceUrl,
  mimeType: 'text/plain',
  displayName: input.title,
  contentSha256: CONTENT_SHA256,
  sizeBytes: 1024,
} satisfies KBIngestionSource

function operation(
  overrides: Partial<KBOperationStatusResponse> = {}
): KBOperationStatusResponse {
  return {
    operationId: OPERATION_ID,
    status: 'running',
    operation: 'update',
    projectId: 'klicker-course-materials',
    producer: 'klicker',
    externalResourceId: RESOURCE_ID,
    resourceVersion: 3,
    expectedSha256: CONTENT_SHA256,
    observedSha256: null,
    serving: {
      activeResourceVersion: 2,
      activeSha256: 'a'.repeat(64),
    },
    errorCode: null,
    correlationId: 'correlation-id',
    createdAt: '2026-07-26T11:59:00Z',
    updatedAt: '2026-07-26T12:00:00Z',
    ...overrides,
  }
}

function client(
  overrides: Partial<KBIngestionApiClient> = {}
): KBIngestionApiClient {
  return {
    acceptResource: vi.fn().mockResolvedValue(OPERATION_ID),
    deleteResource: vi.fn().mockResolvedValue(OPERATION_ID),
    getOperation: vi.fn().mockResolvedValue(operation()),
    ...overrides,
  }
}

function dispatchPrisma(
  resource: Record<string, unknown>,
  updateResults: number[] = [1, 1],
  quota: {
    resourceBytes?: number
    unknownSizeCount?: number
    ticketBytes?: number
  } = {}
) {
  const persistedResource = {
    kbId: KB_ID,
    deletedAt: null,
    kb: { deletedAt: null },
    sizeBytes: 1024,
    ...resource,
  }
  const prisma = {
    kBResource: {
      findUnique: vi.fn().mockResolvedValue(persistedResource),
      findFirst: vi.fn().mockResolvedValue(persistedResource),
      aggregate: vi.fn().mockResolvedValue({
        _sum: { sizeBytes: quota.resourceBytes ?? 1024 },
      }),
      count: vi.fn().mockResolvedValue(quota.unknownSizeCount ?? 0),
      updateMany: vi.fn().mockImplementation(async () => ({
        count: updateResults.shift() ?? 0,
      })),
    },
    kBUploadTicket: {
      aggregate: vi.fn().mockResolvedValue({
        _sum: { sizeBytes: quota.ticketBytes ?? 0 },
      }),
    },
    kBIngestionRun: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    $queryRaw: vi.fn().mockResolvedValue([{ id: KB_ID }]),
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  return prisma
}

describe('KB ingestion dispatch', () => {
  it('does not require external API config until the integration is configured', () => {
    expect(() => validateKBIngestionWorkerConfig({})).not.toThrow()
  })

  it('requires external API config when the worker gate is explicitly open', () => {
    expect(() =>
      validateKBIngestionWorkerConfig({}, { required: true })
    ).toThrow('KB_INGESTION_API_URL must be configured')
  })

  it('fails fast when external API config is only partially configured', () => {
    expect(() =>
      validateKBIngestionWorkerConfig({
        KB_INGESTION_API_URL: 'https://ingestion.example',
      })
    ).toThrow('KB_INGESTION_API_KEY must be configured')
  })

  it('fails fast when the source gateway is not configured', () => {
    expect(() =>
      validateKBIngestionWorkerConfig({
        KB_INGESTION_API_URL: 'https://ingestion.example',
        KB_INGESTION_API_KEY: 'ingestion-key',
      })
    ).toThrow('KB_SOURCE_GATEWAY_URL must be configured')
  })

  it('prepares source bytes, awaits API acceptance, and persists correlation', async () => {
    const prisma = dispatchPrisma({
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      contentSha256: null,
      mimeType: null,
      externalOperationId: null,
    })
    const apiClient = client()
    const prepareSource = vi.fn().mockResolvedValue(source)

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource,
        now: () => NOW,
      })
    ).resolves.toBe(OPERATION_ID)

    expect(prepareSource).toHaveBeenCalledWith(input, process.env)
    expect(prisma.kBResource.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        id: RESOURCE_ID,
        kbId: KB_ID,
        deletedAt: null,
        kb: { deletedAt: null },
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
        contentSha256: null,
        externalOperationId: null,
      },
      data: {
        contentSha256: CONTENT_SHA256,
        mimeType: 'text/plain',
        sizeBytes: 1024,
      },
    })
    expect(apiClient.acceptResource).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      kbId: KB_ID,
      resourceVersion: 3,
      ingestionAttemptId: ATTEMPT_ID,
      source,
    })
    expect(prisma.kBResource.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
        contentSha256: CONTENT_SHA256,
        externalOperationId: null,
      },
      data: {
        externalOperationId: OPERATION_ID,
        externalOperationStartedAt: NOW,
      },
    })
  })

  it('reuses persisted source identity on an idempotent task retry', async () => {
    const prisma = dispatchPrisma(
      {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: CONTENT_SHA256,
        mimeType: 'text/plain',
        sizeBytes: 1024,
        externalOperationId: null,
      },
      [1]
    )
    const apiClient = client()
    const prepareSource = vi.fn()

    await dispatchKBIngestion(input, {
      prisma: prisma as never,
      client: apiClient,
      prepareSource,
      now: () => NOW,
    })

    expect(prepareSource).not.toHaveBeenCalled()
    expect(apiClient.acceptResource).toHaveBeenCalledWith(
      expect.objectContaining({ source })
    )
  })

  it('returns an already correlated operation without another API call', async () => {
    const prisma = dispatchPrisma({
      status: KBResourceStatus.PROCESSING,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      contentSha256: CONTENT_SHA256,
      mimeType: 'text/plain',
      sizeBytes: 1024,
      externalOperationId: OPERATION_ID,
    })
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
      })
    ).resolves.toBe(OPERATION_ID)
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('does not dispatch a stale attempt or version', async () => {
    const prisma = dispatchPrisma({
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      contentSha256: null,
      mimeType: null,
      sizeBytes: null,
      externalOperationId: null,
    })
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
      })
    ).resolves.toBeUndefined()
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('rejects a payload whose KB scope does not match the persisted resource', async () => {
    const prisma = dispatchPrisma({
      kbId: '5190edaa-2e7e-4828-a209-968a597e65b9',
      status: KBResourceStatus.QUEUED,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 3,
      contentSha256: null,
      mimeType: null,
      sizeBytes: null,
      externalOperationId: null,
    })
    const apiClient = client()
    const prepareSource = vi.fn()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource,
      })
    ).resolves.toBeUndefined()

    expect(prepareSource).not.toHaveBeenCalled()
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('replaces the previous URL size without double counting at the quota boundary', async () => {
    const prisma = dispatchPrisma(
      {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: null,
        mimeType: null,
        sizeBytes: 1000,
        externalOperationId: null,
      },
      [1, 1],
      { resourceBytes: MAX_KB_TOTAL_SIZE_BYTES - 500 }
    )
    const boundarySource = { ...source, sizeBytes: 1500 }
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource: vi.fn().mockResolvedValue(boundarySource),
      })
    ).resolves.toBe(OPERATION_ID)

    expect(apiClient.acceptResource).toHaveBeenCalledWith(
      expect.objectContaining({ source: boundarySource })
    )
  })

  it('replaces the conservative reservation for a legacy unknown-size URL', async () => {
    const prisma = dispatchPrisma(
      {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: null,
        mimeType: null,
        sizeBytes: null,
        externalOperationId: null,
      },
      [1, 1],
      {
        resourceBytes: 0,
        unknownSizeCount: 20,
      }
    )
    const observedSource = { ...source, sizeBytes: 1 }
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource: vi.fn().mockResolvedValue(observedSource),
      })
    ).resolves.toBe(OPERATION_ID)

    expect(MAX_KB_SOURCE_SIZE_BYTES * 20).toBe(MAX_KB_TOTAL_SIZE_BYTES)
    expect(apiClient.acceptResource).toHaveBeenCalledWith(
      expect.objectContaining({ source: observedSource })
    )
  })

  it('records a stable failure before dispatch when a URL replacement exceeds quota', async () => {
    const prisma = dispatchPrisma(
      {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: null,
        mimeType: null,
        sizeBytes: 1000,
        externalOperationId: null,
      },
      [1],
      { resourceBytes: MAX_KB_TOTAL_SIZE_BYTES - 500 }
    )
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource: vi
          .fn()
          .mockResolvedValue({ ...source, sizeBytes: 1501 }),
      })
    ).resolves.toBeUndefined()

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
      }),
      data: {
        status: KBResourceStatus.FAILED,
        statusMessage: 'The knowledge base storage limit was reached.',
        errorCode: 'KB_STORAGE_LIMIT_REACHED',
      },
    })
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({
        id: ATTEMPT_ID,
        resourceId: RESOURCE_ID,
        resourceVersion: 3,
      }),
      data: {
        status: KBIngestionStatus.FAILED,
        statusMessage: 'The knowledge base storage limit was reached.',
        errorCode: 'KB_STORAGE_LIMIT_REACHED',
        finishedAt: expect.any(Date),
      },
    })
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('rolls back an over-limit failure that cannot correlate its run', async () => {
    const prisma = dispatchPrisma(
      {
        status: KBResourceStatus.QUEUED,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: null,
        mimeType: null,
        sizeBytes: 1000,
        externalOperationId: null,
      },
      [1],
      { resourceBytes: MAX_KB_TOTAL_SIZE_BYTES }
    )
    prisma.kBIngestionRun.updateMany.mockResolvedValueOnce({ count: 0 })
    const apiClient = client()

    await expect(
      dispatchKBIngestion(input, {
        prisma: prisma as never,
        client: apiClient,
        prepareSource: vi
          .fn()
          .mockResolvedValue({ ...source, sizeBytes: 1001 }),
      })
    ).rejects.toThrow('KB ingestion dispatch failed')
    expect(apiClient.acceptResource).not.toHaveBeenCalled()
  })

  it('marks only an unaccepted current attempt failed after task retries', async () => {
    const prisma = {
      kBResource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      kBIngestionRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(),
    }
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))

    await failKBIngestionDispatch({ input, prisma: prisma as never })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        externalOperationId: null,
        status: {
          in: [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
      },
      data: {
        status: KBResourceStatus.FAILED,
        statusMessage: 'The ingestion operation could not be started.',
        errorCode: 'INGESTION_DISPATCH_FAILED',
      },
    })
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: ATTEMPT_ID,
        resourceId: RESOURCE_ID,
        operation: 'UPSERT',
        resourceVersion: 3,
        status: {
          in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        status: KBIngestionStatus.FAILED,
        statusMessage: 'The ingestion operation could not be started.',
        errorCode: 'INGESTION_DISPATCH_FAILED',
        finishedAt: expect.any(Date),
      },
    })
  })
})

describe('KB deletion dispatch', () => {
  it('dispatches a current tombstone and persists its operation correlation', async () => {
    const acceptedAt = new Date('2026-07-26T12:00:01.000Z')
    let accepted = false
    const prisma = dispatchPrisma({
      kbId: KB_ID,
      deletedAt: NOW,
      ingestionOperation: KBIngestionOperation.DELETE,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: null,
    })
    const apiClient = client()
    apiClient.deleteResource.mockImplementation(async () => {
      accepted = true
      return OPERATION_ID
    })

    await expect(
      dispatchKBDeletion(deletionInput, {
        prisma: prisma as never,
        client: apiClient,
        now: () => (accepted ? acceptedAt : NOW),
      })
    ).resolves.toBe(OPERATION_ID)

    expect(apiClient.deleteResource).toHaveBeenCalledWith(deletionInput)
    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        deletedAt: { not: null },
        ingestionOperation: KBIngestionOperation.DELETE,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 4,
        externalOperationId: null,
      },
      data: {
        externalOperationId: OPERATION_ID,
        externalOperationStartedAt: acceptedAt,
        statusMessage: null,
        errorCode: null,
      },
    })
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: ATTEMPT_ID,
        resourceId: RESOURCE_ID,
        operation: KBIngestionOperation.DELETE,
        resourceVersion: 4,
        status: {
          in: [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        externalOperationId: OPERATION_ID,
        startedAt: acceptedAt,
        statusMessage: null,
        errorCode: null,
      },
    })
  })

  it('does not redispatch a stale deletion attempt', async () => {
    const prisma = dispatchPrisma({
      kbId: KB_ID,
      deletedAt: NOW,
      ingestionOperation: KBIngestionOperation.DELETE,
      ingestionAttemptId: '77996ac1-ad9a-4379-8ff8-2a07d2184a31',
      resourceVersion: 4,
      externalOperationId: null,
    })
    const apiClient = client()

    await expect(
      dispatchKBDeletion(deletionInput, {
        prisma: prisma as never,
        client: apiClient,
      })
    ).resolves.toBeUndefined()
    expect(apiClient.deleteResource).not.toHaveBeenCalled()
  })

  it('does not dispatch a deletion for a different knowledge base', async () => {
    const prisma = dispatchPrisma({
      kbId: '4dad13f2-1c45-47b3-b08a-1bc9cf4c5c47',
      deletedAt: NOW,
      ingestionOperation: KBIngestionOperation.DELETE,
      ingestionAttemptId: ATTEMPT_ID,
      resourceVersion: 4,
      externalOperationId: null,
    })
    const apiClient = client()

    await expect(
      dispatchKBDeletion(deletionInput, {
        prisma: prisma as never,
        client: apiClient,
      })
    ).resolves.toBeUndefined()
    expect(apiClient.deleteResource).not.toHaveBeenCalled()
  })

  it('keeps a failed deletion hidden and retryable', async () => {
    const prisma = dispatchPrisma({}, [1])

    await retainFailedKBDeletionDispatch({
      input: deletionInput,
      prisma: prisma as never,
    })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBResourceStatus.QUEUED,
          errorCode: 'DELETION_DISPATCH_FAILED',
        }),
      })
    )
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBIngestionStatus.QUEUED,
          errorCode: 'DELETION_DISPATCH_FAILED',
        }),
      })
    )
  })
})

describe('KB ingestion reconciliation', () => {
  function monitorPrisma(resources: Record<string, unknown>[]) {
    const prisma = {
      kBResource: {
        count: vi.fn().mockResolvedValue(resources.length),
        findMany: vi
          .fn()
          .mockImplementation(async ({ skip = 0, take = resources.length }) =>
            resources.slice(skip, skip + take)
          ),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      kBIngestionRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(),
    }
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    return prisma
  }

  const activeResource = {
    id: RESOURCE_ID,
    kbId: KB_ID,
    ingestionAttemptId: ATTEMPT_ID,
    resourceVersion: 3,
    contentSha256: CONTENT_SHA256,
    externalOperationId: OPERATION_ID,
    externalOperationStartedAt: new Date('2026-07-26T11:50:00.000Z'),
  }

  it('leaves fresh operations to the signed callback path', async () => {
    const prisma = monitorPrisma([])
    const apiClient = client()

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: apiClient,
      now: () => NOW,
    })

    expect(prisma.kBResource.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        externalOperationStartedAt: {
          lte: new Date('2026-07-26T11:55:00.000Z'),
        },
      }),
    })
    expect(apiClient.getOperation).not.toHaveBeenCalled()
  })

  it('reconciles a succeeded delete only after serving is empty', async () => {
    const deletedResource = {
      ...activeResource,
      resourceVersion: 4,
      contentSha256: null,
      ingestionOperation: KBIngestionOperation.DELETE,
    }
    const prisma = monitorPrisma([deletedResource])

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            status: 'succeeded',
            operation: 'delete',
            resourceVersion: 4,
            expectedSha256: null,
            observedSha256: null,
            serving: {
              activeResourceVersion: null,
              activeSha256: null,
            },
          })
        ),
      }),
    })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ingestionOperation: KBIngestionOperation.DELETE,
          contentSha256: null,
        }),
        data: expect.objectContaining({
          status: KBResourceStatus.READY,
          activeResourceVersion: null,
          activeContentSha256: null,
        }),
      })
    )
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          operation: KBIngestionOperation.DELETE,
        }),
        data: expect.objectContaining({
          status: KBIngestionStatus.SUCCEEDED,
        }),
      })
    )
  })

  it('keeps a succeeded delete processing while old content still serves', async () => {
    const deletedResource = {
      ...activeResource,
      resourceVersion: 4,
      contentSha256: null,
      ingestionOperation: KBIngestionOperation.DELETE,
    }
    const prisma = monitorPrisma([deletedResource])

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            status: 'succeeded',
            operation: 'delete',
            resourceVersion: 4,
            expectedSha256: null,
            observedSha256: null,
            serving: {
              activeResourceVersion: 3,
              activeSha256: CONTENT_SHA256,
            },
          })
        ),
      }),
    })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBResourceStatus.PROCESSING,
        }),
      })
    )
  })

  it.each([
    ['accepted', KBResourceStatus.QUEUED, KBIngestionStatus.QUEUED, null],
    [
      'running',
      KBResourceStatus.PROCESSING,
      KBIngestionStatus.PROCESSING,
      null,
    ],
    [
      'failed',
      KBResourceStatus.FAILED,
      KBIngestionStatus.FAILED,
      'The ingestion operation failed.',
    ],
    [
      'superseded',
      KBResourceStatus.FAILED,
      KBIngestionStatus.SUPERSEDED,
      'The ingestion operation was superseded.',
    ],
  ] as const)('maps %s operation status to %s', async (externalStatus, localStatus, runStatus, statusMessage) => {
    const prisma = monitorPrisma([activeResource])

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi
          .fn()
          .mockResolvedValue(operation({ status: externalStatus })),
      }),
    })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        resourceVersion: 3,
        contentSha256: CONTENT_SHA256,
        externalOperationId: OPERATION_ID,
        ingestionOperation: 'UPSERT',
        status: {
          in:
            externalStatus === 'accepted'
              ? [KBResourceStatus.QUEUED]
              : [KBResourceStatus.QUEUED, KBResourceStatus.PROCESSING],
        },
      },
      data: {
        status: localStatus,
        statusMessage,
        errorCode: null,
        activeResourceVersion: 2,
        activeContentSha256: 'a'.repeat(64),
      },
    })
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: ATTEMPT_ID,
        resourceId: RESOURCE_ID,
        operation: 'UPSERT',
        resourceVersion: 3,
        status: {
          in:
            externalStatus === 'accepted'
              ? [KBIngestionStatus.QUEUED]
              : [KBIngestionStatus.QUEUED, KBIngestionStatus.PROCESSING],
        },
      },
      data: {
        status: runStatus,
        statusMessage,
        errorCode: null,
        ...(externalStatus === 'failed' || externalStatus === 'superseded'
          ? { finishedAt: new Date('2026-07-26T12:00:00Z') }
          : {}),
      },
    })
  })

  it('marks a succeeded operation ready with an ingestion timestamp', async () => {
    const prisma = monitorPrisma([activeResource])

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            status: 'succeeded',
            observedSha256: CONTENT_SHA256,
            serving: {
              activeResourceVersion: 3,
              activeSha256: CONTENT_SHA256,
            },
          })
        ),
      }),
    })

    const update = prisma.kBResource.updateMany.mock.calls[0]![0]
    expect(update.data).toMatchObject({
      status: KBResourceStatus.READY,
      statusMessage: null,
      activeResourceVersion: 3,
      activeContentSha256: CONTENT_SHA256,
      errorCode: null,
    })
    expect(update.data.ingestedAt).toEqual(new Date('2026-07-26T12:00:00.000Z'))
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith({
      where: {
        id: ATTEMPT_ID,
        resourceId: RESOURCE_ID,
        operation: 'UPSERT',
        resourceVersion: 3,
        status: {
          in: [
            KBIngestionStatus.QUEUED,
            KBIngestionStatus.PROCESSING,
            KBIngestionStatus.SUCCEEDED,
          ],
        },
      },
      data: {
        status: KBIngestionStatus.SUCCEEDED,
        statusMessage: null,
        errorCode: null,
        finishedAt: new Date('2026-07-26T12:00:00.000Z'),
      },
    })
  })

  it('refuses success when the observed digest does not match', async () => {
    const prisma = monitorPrisma([activeResource])
    const logger = { error: vi.fn() }

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            status: 'succeeded',
            observedSha256: null,
            serving: {
              activeResourceVersion: 3,
              activeSha256: CONTENT_SHA256,
            },
          })
        ),
      }),
      logger,
    })

    expect(prisma.kBResource.updateMany).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      'KB ingestion observed digest correlation failed',
      {
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
      }
    )
  })

  it.each([
    {
      activeResourceVersion: 2,
      activeSha256: 'a'.repeat(64),
    },
    {
      activeResourceVersion: 3,
      activeSha256: 'a'.repeat(64),
    },
  ])('records successful operation while serving cutover is pending', async (serving) => {
    const prisma = monitorPrisma([activeResource])
    const logger = { info: vi.fn() }

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            status: 'succeeded',
            observedSha256: CONTENT_SHA256,
            serving,
          })
        ),
      }),
      logger,
    })

    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBResourceStatus.PROCESSING,
          activeResourceVersion: serving.activeResourceVersion,
          activeContentSha256: serving.activeSha256,
        }),
      })
    )
    expect(prisma.kBIngestionRun.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBIngestionStatus.SUCCEEDED,
        }),
      })
    )
    expect(logger.info).toHaveBeenCalledWith(
      'KB ingestion succeeded while serving cutover is pending',
      {
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
      }
    )
  })

  it('refuses a status response that does not match every correlation field', async () => {
    const prisma = monitorPrisma([activeResource])
    const logger = { error: vi.fn() }

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi.fn().mockResolvedValue(
          operation({
            externalResourceId: '99c15e36-62ce-4982-88f8-1f50ed9bf61e',
          })
        ),
      }),
      logger,
    })

    expect(prisma.kBResource.updateMany).not.toHaveBeenCalled()
    expect(logger.error).toHaveBeenCalledWith(
      'KB ingestion operation correlation failed',
      {
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
      }
    )
  })

  it('bounds concurrent operation polls to eight', async () => {
    const resources = Array.from({ length: 17 }, (_, index) => ({
      ...activeResource,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      externalOperationId: `${OPERATION_ID}_${index}`,
    }))
    const prisma = monitorPrisma(resources)
    let active = 0
    let peak = 0
    const getOperation = vi.fn().mockImplementation(async (operationId) => {
      active += 1
      peak = Math.max(peak, active)
      await Promise.resolve()
      active -= 1
      const index = Number(operationId.split('_').at(-1))
      return operation({
        operationId,
        externalResourceId: resources[index]!.id,
      })
    })

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({ getOperation }),
    })

    expect(getOperation).toHaveBeenCalledTimes(17)
    expect(peak).toBe(8)
  })

  it('rotates a bounded 32-resource reconciliation window every five minutes', async () => {
    const resources = Array.from({ length: 49 }, (_, index) => ({
      ...activeResource,
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      externalOperationId: `${OPERATION_ID}_${index}`,
    }))
    const prisma = {
      kBResource: {
        count: vi.fn().mockResolvedValue(resources.length),
        findMany: vi.fn().mockImplementation(async ({ skip = 0, take }) => {
          return resources.slice(skip, skip + take)
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      kBIngestionRun: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: vi.fn(),
    }
    prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
    const getOperation = vi.fn().mockImplementation(async (operationId) => {
      const index = Number(operationId.split('_').at(-1))
      return operation({
        operationId,
        externalResourceId: resources[index]!.id,
      })
    })

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({ getOperation }),
      now: () => new Date(300_000),
    })

    expect(prisma.kBResource.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ skip: 32, take: 32 })
    )
    expect(prisma.kBResource.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ take: 15 })
    )
    expect(getOperation).toHaveBeenCalledTimes(32)
  })
})

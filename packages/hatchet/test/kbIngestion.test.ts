import { KBResourceStatus } from '@klicker-uzh/prisma/client'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  dispatchKBIngestion,
  failKBIngestionDispatch,
  monitorActiveKBIngestions,
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
  speedMode: 'balanced',
  type: 'URL',
  sourceUrl: 'https://example.com/lecture.txt',
} satisfies IngestKBResourceInput

const source = {
  kind: 'url',
  url: input.sourceUrl,
  mimeType: 'text/plain',
  displayName: input.title,
  contentSha256: CONTENT_SHA256,
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
    getOperation: vi.fn().mockResolvedValue(operation()),
    ...overrides,
  }
}

function dispatchPrisma(
  resource: Record<string, unknown>,
  updateResults: number[] = [1, 1]
) {
  return {
    kBResource: {
      findUnique: vi.fn().mockResolvedValue(resource),
      updateMany: vi.fn().mockImplementation(async () => ({
        count: updateResults.shift() ?? 0,
      })),
    },
  }
}

describe('KB ingestion dispatch', () => {
  it('does not require external API config until the integration is configured', () => {
    expect(() => validateKBIngestionWorkerConfig({})).not.toThrow()
  })

  it('fails fast when external API config is only partially configured', () => {
    expect(() =>
      validateKBIngestionWorkerConfig({
        KB_INGESTION_API_URL: 'https://ingestion.example',
      })
    ).toThrow('KB_INGESTION_API_KEY must be configured')
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

  it('marks only an unaccepted current attempt failed after task retries', async () => {
    const prisma = {
      kBResource: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }

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
      },
    })
  })
})

describe('KB ingestion reconciliation', () => {
  function monitorPrisma(resources: Record<string, unknown>[]) {
    return {
      kBResource: {
        findMany: vi.fn().mockResolvedValue(resources),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    }
  }

  const activeResource = {
    id: RESOURCE_ID,
    kbId: KB_ID,
    ingestionAttemptId: ATTEMPT_ID,
    resourceVersion: 3,
    contentSha256: CONTENT_SHA256,
    externalOperationId: OPERATION_ID,
  }

  it.each([
    ['accepted', KBResourceStatus.QUEUED, null],
    ['running', KBResourceStatus.PROCESSING, null],
    ['failed', KBResourceStatus.FAILED, 'The ingestion operation failed.'],
    [
      'superseded',
      KBResourceStatus.FAILED,
      'The ingestion operation was superseded.',
    ],
  ] as const)(
    'maps %s operation status to %s',
    async (externalStatus, localStatus, statusMessage) => {
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
        },
      })
    }
  )

  it('marks a succeeded operation ready with an ingestion timestamp', async () => {
    const prisma = monitorPrisma([activeResource])

    await monitorActiveKBIngestions({
      prisma: prisma as never,
      client: client({
        getOperation: vi
          .fn()
          .mockResolvedValue(operation({ status: 'succeeded' })),
      }),
    })

    const update = prisma.kBResource.updateMany.mock.calls[0]![0]
    expect(update.data).toMatchObject({
      status: KBResourceStatus.READY,
      statusMessage: null,
    })
    expect(update.data.ingestedAt).toBeInstanceOf(Date)
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
})

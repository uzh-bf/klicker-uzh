import { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  buildExternalKBIngestionPayload,
  dispatchKBIngestion,
  getExternalHatchetConfig,
  getKBIngestionSourceUrl,
  getKBIngestionTimeoutSeconds,
  KB_INGESTION_ATTEMPT_METADATA_KEY,
  validateKBIngestionWorkerConfig,
  type ExternalHatchetClient,
  type KBIngestionLogger,
} from '../src/kbIngestion.js'

const NOW = new Date('2026-07-20T12:00:00.000Z')
const UPDATED_AT = new Date('2026-07-20T11:55:00.000Z')
const RESOURCE_ID = '8b4ee44e-8cc2-4fd0-ab50-ff9d884c8d63'
const KB_ID = '2412f294-6a60-4409-ab88-b349879a9450'
const ATTEMPT_ID = '376fc4b8-90aa-4e1c-a3d4-95dcd3081f21'

const externalEnv = {
  KB_INGESTION_HATCHET_CLIENT_TOKEN: 'external-token',
  KB_INGESTION_HATCHET_CLIENT_HOST_PORT: 'hatchet-engine.other:7070',
  KB_INGESTION_HATCHET_API_URL: 'http://hatchet-api.other:8080',
  KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY: 'none',
  KB_INGESTION_HATCHET_WORKFLOW_NAME: 'build-knowledge-graph',
}

const urlInput: IngestKBResourceInput = {
  resourceId: RESOURCE_ID,
  kbId: KB_ID,
  ingestionAttemptId: ATTEMPT_ID,
  speedMode: 'balanced',
  title: 'Public source',
  type: 'URL',
  sourceUrl: 'https://content.example.org/source.pdf?version=1',
}

const blobInput: IngestKBResourceInput = {
  resourceId: RESOURCE_ID,
  kbId: KB_ID,
  ingestionAttemptId: ATTEMPT_ID,
  speedMode: 'quality',
  title: 'Private source',
  type: 'BLOB',
  containerName: 'kb-user-id',
  blobName: 'resources/source.pdf',
}

type MockPrisma = Pick<PrismaClient, 'kBResource'>

function createPrisma({
  resource = {
    status: 'QUEUED',
    updatedAt: UPDATED_AT,
    ingestionAttemptId: ATTEMPT_ID,
    externalWorkflowRunId: null as string | null,
  },
  updateCount = 1,
  rereadResource,
}: {
  resource?: {
    status: 'QUEUED' | 'PROCESSING' | 'READY'
    updatedAt: Date
    ingestionAttemptId: string | null
    externalWorkflowRunId: string | null
  } | null
  updateCount?: number
  rereadResource?: {
    ingestionAttemptId: string | null
    externalWorkflowRunId: string | null
  } | null
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(resource)
  if (rereadResource !== undefined) {
    findUnique
      .mockResolvedValueOnce(resource)
      .mockResolvedValueOnce(rereadResource)
  }

  return {
    kBResource: {
      findUnique,
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
  } as unknown as MockPrisma
}

function createClient({
  rows = [],
  runId = 'external-run-id',
}: {
  rows?: Array<{ workflowRunExternalId: string; createdAt: string }>
  runId?: string
} = {}) {
  return {
    runs: {
      list: vi.fn().mockResolvedValue({ rows }),
      cancel: vi.fn().mockResolvedValue({}),
    },
    runNoWait: vi.fn().mockResolvedValue({
      getWorkflowRunId: vi.fn().mockResolvedValue(runId),
    }),
  } satisfies ExternalHatchetClient
}

describe('KB ingestion worker configuration', () => {
  it('defaults an absent timeout to one hour', () => {
    expect(getKBIngestionTimeoutSeconds({})).toBe(3600)
  })

  it.each(['0', '-1', '1.5', 'not-a-number', ' '])(
    'rejects the present invalid timeout %j',
    (value) => {
      expect(() =>
        getKBIngestionTimeoutSeconds({
          KB_INGESTION_TIMEOUT_SECONDS: value,
        })
      ).toThrow('KB_INGESTION_TIMEOUT_SECONDS must be a positive integer')
    }
  )

  it('uses only the dedicated external Hatchet environment variables', () => {
    expect(
      getExternalHatchetConfig({
        ...externalEnv,
        HATCHET_CLIENT_TOKEN: 'local-token-must-not-be-used',
        HATCHET_CLIENT_NAMESPACE: 'local-namespace-must-not-be-used',
      })
    ).toEqual({
      client: {
        token: 'external-token',
        host_port: 'hatchet-engine.other:7070',
        api_url: 'http://hatchet-api.other:8080',
        namespace: '',
        tls_config: { tls_strategy: 'none' },
      },
      workflowName: 'build-knowledge-graph',
    })
  })

  it.each(['tls', 'mtls', 'none'] as const)(
    'accepts the %s TLS strategy',
    (tlsStrategy) => {
      expect(
        getExternalHatchetConfig({
          ...externalEnv,
          KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY: tlsStrategy,
        }).client.tls_config.tls_strategy
      ).toBe(tlsStrategy)
    }
  )

  it.each([
    'KB_INGESTION_HATCHET_CLIENT_TOKEN',
    'KB_INGESTION_HATCHET_CLIENT_HOST_PORT',
    'KB_INGESTION_HATCHET_API_URL',
    'KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY',
    'KB_INGESTION_HATCHET_WORKFLOW_NAME',
  ])('requires the dedicated %s variable', (name) => {
    expect(() =>
      getExternalHatchetConfig({ ...externalEnv, [name]: undefined })
    ).toThrow(`${name} must be configured`)
  })

  it('rejects an unsupported external Hatchet TLS strategy', () => {
    expect(() =>
      getExternalHatchetConfig({
        ...externalEnv,
        KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY: 'prefer-tls',
      })
    ).toThrow(
      'KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY must be tls, mtls, or none'
    )
  })

  it('validates only the timeout without initializing or requiring an external client', () => {
    const init = vi.spyOn(HatchetClient, 'init')

    expect(() =>
      validateKBIngestionWorkerConfig({
        KB_INGESTION_TIMEOUT_SECONDS: '3600',
      })
    ).not.toThrow()
    expect(init).not.toHaveBeenCalled()
    init.mockRestore()
  })
})

describe('KB ingestion source and payload', () => {
  it('passes a URL source through byte-for-byte', () => {
    expect(getKBIngestionSourceUrl(urlInput)).toBe(urlInput.sourceUrl)
  })

  it('creates a blob-scoped, read-only, HTTPS-only one-hour SAS', () => {
    const sourceUrl = getKBIngestionSourceUrl(blobInput, {
      env: {
        BLOB_STORAGE_ACCOUNT_NAME: 'klickertest',
        BLOB_STORAGE_ACCESS_KEY: 'dGVzdC1rZXk=',
      },
      now: () => NOW,
    })
    const parsedUrl = new URL(sourceUrl)

    expect(`${parsedUrl.origin}${parsedUrl.pathname}`).toBe(
      'https://klickertest.blob.core.windows.net/kb-user-id/resources/source.pdf'
    )
    expect(parsedUrl.searchParams.get('sp')).toBe('r')
    expect(parsedUrl.searchParams.get('spr')).toBe('https')
    expect(new Date(parsedUrl.searchParams.get('st')!).toISOString()).toBe(
      '2026-07-20T11:55:00.000Z'
    )
    expect(new Date(parsedUrl.searchParams.get('se')!).toISOString()).toBe(
      '2026-07-20T13:00:00.000Z'
    )
  })

  it('builds exactly the agreed single-source Python workflow payload', () => {
    expect(
      buildExternalKBIngestionPayload(
        blobInput,
        'https://signed.example/source'
      )
    ).toEqual({
      course_id: KB_ID,
      sources: [
        {
          source_id: RESOURCE_ID,
          source_url: 'https://signed.example/source',
        },
      ],
      upload_markdown: true,
      export_to_falkordb: true,
      falkordb_graph_name: `klickeruzh:${KB_ID}`,
      speed_mode: 'quality',
    })
  })
})

describe('external KB ingestion dispatch', () => {
  it('does not look up or trigger when a run ID is already persisted', async () => {
    const prisma = createPrisma({
      resource: {
        status: 'PROCESSING',
        updatedAt: UPDATED_AT,
        ingestionAttemptId: ATTEMPT_ID,
        externalWorkflowRunId: 'persisted-run-id',
      },
    })
    const client = createClient()

    await expect(
      dispatchKBIngestion(urlInput, { prisma, client, env: externalEnv })
    ).resolves.toBe('persisted-run-id')
    expect(client.runs.list).not.toHaveBeenCalled()
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBResource.updateMany).not.toHaveBeenCalled()
  })

  it('exits before external calls for a stale attempt', async () => {
    const prisma = createPrisma({
      resource: {
        status: 'QUEUED',
        updatedAt: UPDATED_AT,
        ingestionAttemptId: 'a-newer-attempt',
        externalWorkflowRunId: null,
      },
    })
    const client = createClient()

    await expect(
      dispatchKBIngestion(urlInput, { prisma, client, env: externalEnv })
    ).resolves.toBeUndefined()
    expect(client.runs.list).not.toHaveBeenCalled()
    expect(client.runNoWait).not.toHaveBeenCalled()
  })

  it('recovers an external run by attempt metadata without a duplicate trigger', async () => {
    const prisma = createPrisma()
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
        },
      ],
    })

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
        now: () => NOW,
      })
    ).resolves.toBe('recovered-run-id')
    expect(client.runs.list).toHaveBeenCalledWith({
      workflowNames: ['build-knowledge-graph'],
      additionalMetadata: {
        [KB_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
      },
      onlyTasks: false,
      includePayloads: false,
      limit: 1,
      since: new Date('2026-07-20T11:50:00.000Z'),
    })
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith({
      where: {
        id: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        status: { in: ['QUEUED', 'PROCESSING'] },
        externalWorkflowRunId: null,
      },
      data: {
        externalWorkflowRunId: 'recovered-run-id',
        externalWorkflowStartedAt: new Date('2026-07-20T11:57:00.000Z'),
      },
    })
  })

  it.each(['balanced', 'quality', 'fast'] as const)(
    'triggers and persists a new run in %s mode',
    async (speedMode) => {
      const prisma = createPrisma()
      const client = createClient({ runId: `run-${speedMode}` })
      const input = { ...urlInput, speedMode }

      await expect(
        dispatchKBIngestion(input, {
          prisma,
          client,
          env: externalEnv,
          now: () => NOW,
        })
      ).resolves.toBe(`run-${speedMode}`)
      expect(client.runNoWait).toHaveBeenCalledWith(
        'build-knowledge-graph',
        {
          course_id: KB_ID,
          sources: [
            {
              source_id: RESOURCE_ID,
              source_url: urlInput.sourceUrl,
            },
          ],
          upload_markdown: true,
          export_to_falkordb: true,
          falkordb_graph_name: `klickeruzh:${KB_ID}`,
          speed_mode: speedMode,
        },
        {
          additionalMetadata: {
            [KB_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
          },
        }
      )
      expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            externalWorkflowRunId: `run-${speedMode}`,
            externalWorkflowStartedAt: NOW,
          },
        })
      )
    }
  )

  it('best-effort cancels when the guarded run persistence loses the race', async () => {
    const prisma = createPrisma({ updateCount: 0 })
    const client = createClient({ runId: 'orphaned-run-id' })

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
        now: () => NOW,
      })
    ).resolves.toBeUndefined()
    expect(client.runs.cancel).toHaveBeenCalledWith({
      ids: ['orphaned-run-id'],
    })
  })

  it('converges without cancellation when the same attempt concurrently persists the same recovered run', async () => {
    const prisma = createPrisma({
      updateCount: 0,
      rereadResource: {
        ingestionAttemptId: ATTEMPT_ID,
        externalWorkflowRunId: 'recovered-run-id',
      },
    })
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
        },
      ],
    })

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
      })
    ).resolves.toBe('recovered-run-id')
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(client.runs.cancel).not.toHaveBeenCalled()
    expect(prisma.kBResource.findUnique).toHaveBeenCalledTimes(2)
  })

  it('does not let cancellation failure expose a raw SDK error', async () => {
    const prisma = createPrisma({ updateCount: 0 })
    const client = createClient({ runId: 'orphaned-run-id' })
    const logger = { error: vi.fn() } satisfies KBIngestionLogger
    client.runs.cancel.mockRejectedValue(
      new Error('secret cancellation response with signed URL')
    )

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
        logger,
      })
    ).resolves.toBeUndefined()
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('signed URL')
  })

  it('sanitizes logger calls and thrown errors when the SDK echoes a SAS URL', async () => {
    const prisma = createPrisma()
    const client = createClient()
    const logger = { error: vi.fn(), info: vi.fn() } satisfies KBIngestionLogger
    const env = {
      ...externalEnv,
      BLOB_STORAGE_ACCOUNT_NAME: 'klickertest',
      BLOB_STORAGE_ACCESS_KEY: 'dGVzdC1rZXk=',
    }
    client.runNoWait.mockImplementation(async (_workflow, payload) => {
      throw new Error(`raw SDK error: ${payload.sources[0]!.source_url}`)
    })

    const error = await dispatchKBIngestion(blobInput, {
      prisma,
      client,
      env,
      now: () => NOW,
      logger,
    }).catch((caughtError: unknown) => caughtError)

    expect(error).toEqual(new Error('External KB ingestion dispatch failed'))
    const logged = JSON.stringify([
      logger.error.mock.calls,
      logger.info.mock.calls,
    ])
    expect(logged).not.toContain('raw SDK error')
    expect(logged).not.toContain('sig=')
    expect(logged).not.toContain('source_url')
  })
})

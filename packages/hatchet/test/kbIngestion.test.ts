import {
  ConcurrencyLimitStrategy,
  HatchetClient,
} from '@hatchet-dev/typescript-sdk'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { IngestKBResourceInput } from '@klicker-uzh/types'
import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import {
  buildExternalKBIngestionPayload,
  dispatchKBIngestion,
  getExternalHatchetConfig,
  getKBIngestionSourceUrl,
  getKBIngestionTimeoutSeconds,
  KB_INGESTION_ATTEMPT_METADATA_KEY,
  monitorActiveKBIngestions,
  sendKBIngestionStatus,
  validateKBIngestionWorkerConfig,
  type ExternalHatchetClient,
  type ExternalHatchetStatus,
  type KBIngestionLogger,
  type KBIngestionStatusPayload,
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
  status = 'QUEUED',
}: {
  rows?: Array<{
    workflowRunExternalId: string
    createdAt: string
    additionalMetadata?: Record<string, unknown>
  }>
  runId?: string
  status?: ExternalHatchetStatus
} = {}) {
  return {
    runs: {
      get_status: vi.fn().mockResolvedValue(status),
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

describe('KB ingestion status webhook', () => {
  it('signs and posts the exact serialized bytes', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({ ok: true })
    const payload = {
      resourceId: RESOURCE_ID,
      ingestionAttemptId: ATTEMPT_ID,
      status: 'PROCESSING',
    } satisfies KBIngestionStatusPayload
    const rawBody = Buffer.from(JSON.stringify(payload), 'utf8')
    const timestamp = Math.floor(NOW.getTime() / 1000)

    await sendKBIngestionStatus(payload, {
      env: {
        KB_WEBHOOK_URL: 'https://klicker.example/api/kb/ingestion-webhook',
        KB_WEBHOOK_SECRET: 'webhook-secret',
      },
      now: () => NOW,
      fetch: fetchRequest,
    })

    expect(fetchRequest).toHaveBeenCalledTimes(1)
    const [url, request] = fetchRequest.mock.calls[0]!
    expect(url).toBe('https://klicker.example/api/kb/ingestion-webhook')
    expect(request).toMatchObject({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-kb-timestamp': String(timestamp),
        'x-kb-signature': createHmac('sha256', 'webhook-secret')
          .update(Buffer.concat([Buffer.from(`${timestamp}.`), rawBody]))
          .digest('hex'),
      },
    })
    expect(Buffer.isBuffer(request.body)).toBe(true)
    expect(request.body).toEqual(rawBody)
  })

  it('rejects a non-success response without exposing response details', async () => {
    const fetchRequest = vi.fn().mockResolvedValue({ ok: false })

    await expect(
      sendKBIngestionStatus(
        {
          resourceId: RESOURCE_ID,
          ingestionAttemptId: ATTEMPT_ID,
          status: 'FAILED',
        },
        {
          env: {
            KB_WEBHOOK_URL: 'https://klicker.example/webhook',
            KB_WEBHOOK_SECRET: 'webhook-secret',
          },
          now: () => NOW,
          fetch: fetchRequest,
        }
      )
    ).rejects.toThrow('KB ingestion status webhook failed')
  })
})

type MonitorResource = {
  id: string
  kbId: string
  ingestionAttemptId: string | null
  externalWorkflowRunId: string | null
  externalWorkflowStartedAt: Date | null
}

function createMonitorPrisma(resources: MonitorResource[]) {
  return {
    kBResource: {
      findMany: vi.fn().mockResolvedValue(resources),
    },
  } as unknown as Pick<PrismaClient, 'kBResource'>
}

function createMonitorResource(
  overrides: Partial<MonitorResource> = {}
): MonitorResource {
  return {
    id: RESOURCE_ID,
    kbId: KB_ID,
    ingestionAttemptId: ATTEMPT_ID,
    externalWorkflowRunId: 'external-run-id',
    externalWorkflowStartedAt: new Date('2026-07-20T11:59:00.000Z'),
    ...overrides,
  }
}

describe('external KB ingestion monitor', () => {
  it('queries only active resources with complete external metadata', async () => {
    const prisma = createMonitorPrisma([])

    await monitorActiveKBIngestions({
      prisma,
      client: createClient(),
      env: {},
      now: () => NOW,
      sendStatus: vi.fn(),
    })

    expect(prisma.kBResource.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['QUEUED', 'PROCESSING'] },
        ingestionAttemptId: { not: null },
        externalWorkflowRunId: { not: null },
        externalWorkflowStartedAt: { not: null },
      },
      select: {
        id: true,
        kbId: true,
        ingestionAttemptId: true,
        externalWorkflowRunId: true,
        externalWorkflowStartedAt: true,
      },
    })
  })

  it.each<{
    externalStatus: ExternalHatchetStatus
    expectedPayload?: KBIngestionStatusPayload
  }>([
    { externalStatus: 'QUEUED' },
    {
      externalStatus: 'RUNNING',
      expectedPayload: {
        resourceId: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        status: 'PROCESSING',
      },
    },
    {
      externalStatus: 'COMPLETED',
      expectedPayload: {
        resourceId: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        status: 'READY',
      },
    },
    {
      externalStatus: 'FAILED',
      expectedPayload: {
        resourceId: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        status: 'FAILED',
        statusMessage: 'External ingestion workflow failed.',
      },
    },
    {
      externalStatus: 'CANCELLED',
      expectedPayload: {
        resourceId: RESOURCE_ID,
        ingestionAttemptId: ATTEMPT_ID,
        status: 'FAILED',
        statusMessage: 'External ingestion workflow was cancelled.',
      },
    },
  ])(
    'maps $externalStatus to the expected local webhook action',
    async ({ externalStatus, expectedPayload }) => {
      const sendStatus = vi.fn().mockResolvedValue(undefined)

      await monitorActiveKBIngestions({
        prisma: createMonitorPrisma([createMonitorResource()]),
        client: createClient({ status: externalStatus }),
        env: {},
        now: () => NOW,
        sendStatus,
      })

      if (expectedPayload) {
        expect(sendStatus).toHaveBeenCalledWith(expectedPayload)
      } else {
        expect(sendStatus).not.toHaveBeenCalled()
      }
    }
  )

  it('checks terminal status before applying the timeout', async () => {
    const client = createClient({ status: 'COMPLETED' })
    const sendStatus = vi.fn().mockResolvedValue(undefined)

    await monitorActiveKBIngestions({
      prisma: createMonitorPrisma([
        createMonitorResource({
          externalWorkflowStartedAt: new Date('2026-07-20T11:00:00.000Z'),
        }),
      ]),
      client,
      env: { KB_INGESTION_TIMEOUT_SECONDS: '60' },
      now: () => NOW,
      sendStatus,
    })

    expect(client.runs.cancel).not.toHaveBeenCalled()
    expect(sendStatus).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      ingestionAttemptId: ATTEMPT_ID,
      status: 'READY',
    })
  })

  it('reports a configured timeout even when external cancellation rejects', async () => {
    const client = createClient({ status: 'RUNNING' })
    const sendStatus = vi.fn().mockResolvedValue(undefined)
    const logger = { error: vi.fn() } satisfies KBIngestionLogger
    client.runs.cancel.mockRejectedValue(
      new Error('secret raw response from external Hatchet')
    )

    await monitorActiveKBIngestions({
      prisma: createMonitorPrisma([
        createMonitorResource({
          externalWorkflowStartedAt: new Date('2026-07-20T11:58:59.000Z'),
        }),
      ]),
      client,
      env: { KB_INGESTION_TIMEOUT_SECONDS: '60' },
      now: () => NOW,
      logger,
      sendStatus,
    })

    expect(client.runs.cancel).toHaveBeenCalledWith({
      ids: ['external-run-id'],
    })
    expect(sendStatus).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      ingestionAttemptId: ATTEMPT_ID,
      status: 'FAILED',
      statusMessage: 'External ingestion timed out.',
    })
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'raw response'
    )
  })

  it('isolates both status-query and webhook failures between resources', async () => {
    const firstId = '4cf9d88e-75b1-4d7b-abfe-d5f57ae9276f'
    const secondId = 'a7a874a8-f919-4fb9-88ea-f1a40ca6f479'
    const thirdId = 'b79e5239-0763-4336-aa96-b1e1356c37a5'
    const prisma = createMonitorPrisma([
      createMonitorResource({
        id: firstId,
        externalWorkflowRunId: 'run-status-fails',
      }),
      createMonitorResource({
        id: secondId,
        externalWorkflowRunId: 'run-webhook-fails',
      }),
      createMonitorResource({
        id: thirdId,
        externalWorkflowRunId: 'run-succeeds',
      }),
    ])
    const client = createClient()
    client.runs.get_status.mockImplementation(async (runId) => {
      if (runId === 'run-status-fails') {
        throw new Error('secret status response')
      }
      return runId === 'run-succeeds' ? 'COMPLETED' : 'RUNNING'
    })
    const sendStatus = vi.fn().mockImplementation(async (payload) => {
      if (payload.resourceId === secondId) {
        throw new Error('secret webhook response')
      }
    })
    const logger = { error: vi.fn() } satisfies KBIngestionLogger

    await monitorActiveKBIngestions({
      prisma,
      client,
      env: {},
      now: () => NOW,
      logger,
      sendStatus,
    })

    expect(client.runs.get_status.mock.calls.map(([runId]) => runId)).toEqual([
      'run-status-fails',
      'run-webhook-fails',
      'run-succeeds',
    ])
    expect(sendStatus).toHaveBeenLastCalledWith({
      resourceId: thirdId,
      ingestionAttemptId: ATTEMPT_ID,
      status: 'READY',
    })
    const logged = JSON.stringify(logger.error.mock.calls)
    expect(logged).not.toContain('secret')
    expect(logged).not.toContain('response')
  })
})

describe('KB ingestion Hatchet declarations', () => {
  it('preserves dispatch order, failure correlation, and singleton cron settings', async () => {
    vi.resetModules()
    const callOrder: string[] = []
    const dispatchKBIngestion = vi.fn().mockImplementation(async () => {
      callOrder.push('dispatch')
    })
    const sendKBIngestionStatus = vi.fn().mockResolvedValue(undefined)
    const monitorActiveKBIngestions = vi.fn().mockResolvedValue(undefined)
    const mockedPrisma = { kBResource: {} }

    vi.doMock('../src/client.js', () => ({ hatchetClient: {} }))
    vi.doMock('@klicker-uzh/prisma', () => ({ prisma: mockedPrisma }))
    vi.doMock('../src/kbIngestion.js', async () => {
      const actual = await vi.importActual('../src/kbIngestion.js')
      return {
        ...actual,
        dispatchKBIngestion,
        sendKBIngestionStatus,
        monitorActiveKBIngestions,
      }
    })
    const { prepareHatchetTasks } = await import('../src/index.js')
    const declarations = new Map<string, any>()
    const hatchet = {
      task: vi.fn((definition) => {
        declarations.set(definition.name, definition)
        return { definition }
      }),
    } as unknown as HatchetClient
    const prepared = prepareHatchetTasks({
      hatchet,
      pubSub: {} as any,
      emitter: {} as any,
      redisExec: {} as any,
      redisAssessmentExec: {} as any,
      handlers: {} as any,
    })
    const ingestDefinition = declarations.get('ingest-kb-resource')
    const monitorDefinition = declarations.get('monitor-kb-ingestions')
    const logger = {
      info: vi.fn().mockImplementation(async () => {
        callOrder.push('log')
      }),
    }

    await ingestDefinition.fn(urlInput, { logger })

    expect(callOrder).toEqual(['log', 'dispatch'])
    expect(logger.info).toHaveBeenCalledWith('KB ingestion dispatch stub', {
      resourceId: RESOURCE_ID,
      kbId: KB_ID,
      type: 'URL',
    })
    expect(ingestDefinition.retries).toBe(3)
    expect(ingestDefinition.onFailure.retries).toBe(3)

    await ingestDefinition.onFailure.fn(urlInput)

    expect(sendKBIngestionStatus).toHaveBeenCalledWith({
      resourceId: RESOURCE_ID,
      ingestionAttemptId: ATTEMPT_ID,
      status: 'FAILED',
      statusMessage: 'The external ingestion workflow could not be started.',
    })
    expect(monitorDefinition).toMatchObject({
      name: 'monitor-kb-ingestions',
      onCrons: ['* * * * *'],
      concurrency: {
        expression: '"monitor-kb-ingestions"',
        maxRuns: 1,
      },
    })
    expect(monitorDefinition.concurrency.limitStrategy).toBe(
      ConcurrencyLimitStrategy.CANCEL_NEWEST
    )

    await monitorDefinition.fn()

    expect(monitorActiveKBIngestions).toHaveBeenCalledWith({
      prisma: mockedPrisma,
    })
    expect(prepared).toHaveProperty('monitorKBIngestions')
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
          additionalMetadata: {
            [KB_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
          },
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

  it('returns the persisted run when the success logger rejects', async () => {
    const prisma = createPrisma()
    const client = createClient({ runId: 'persisted-run-id' })
    const logger = {
      info: vi.fn().mockRejectedValue(new Error('logger transport failed')),
    } satisfies KBIngestionLogger

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
        logger,
      })
    ).resolves.toBe('persisted-run-id')
    expect(prisma.kBResource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalWorkflowRunId: 'persisted-run-id',
        }),
      })
    )
    expect(logger.info).toHaveBeenCalledWith(
      'External KB ingestion dispatched',
      {
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
      }
    )
  })

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
          additionalMetadata: {
            [KB_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
          },
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

  it('does not let a rejecting logger escape cancellation cleanup', async () => {
    const prisma = createPrisma({ updateCount: 0 })
    const client = createClient({ runId: 'orphaned-run-id' })
    const logger = {
      error: vi.fn().mockRejectedValue(new Error('logger transport failed')),
    } satisfies KBIngestionLogger
    client.runs.cancel.mockRejectedValue(new Error('cancellation failed'))

    await expect(
      dispatchKBIngestion(urlInput, {
        prisma,
        client,
        env: externalEnv,
        logger,
      })
    ).resolves.toBeUndefined()
    expect(logger.error).toHaveBeenCalledWith(
      'External KB ingestion cancellation failed',
      {
        resourceId: RESOURCE_ID,
        kbId: KB_ID,
        ingestionAttemptId: ATTEMPT_ID,
      }
    )
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

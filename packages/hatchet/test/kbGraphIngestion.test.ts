import { hashKBContentDigestEntries } from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
  KBGraphQualityTier,
  KBResourceType,
} from '@klicker-uzh/prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  buildExternalKBGraphPayload,
  dispatchKBGraphBuild,
  markKBGraphBuildDispatchFailed,
  monitorActiveKBGraphBuilds,
} from '../src/kbGraphIngestion.js'
import {
  getKBGraphSourceUrl,
  KB_GRAPH_BUILD_METADATA_KEY,
  KB_GRAPH_KB_METADATA_KEY,
  validateKBGraphWorkerConfig,
  type ExternalKBGraphClient,
} from '../src/kbGraphIngestionApi.js'

const NOW = new Date('2026-08-01T12:00:00.000Z')
const CREATED_AT = new Date('2026-08-01T11:55:00.000Z')
const BUILD_ID = 'd1ec25e9-71ae-449f-88c5-7872f0b1a875'
const KB_ID = '842f262d-3482-43aa-956a-68f0c52184dd'
const OWNER_ID = 'fb5c14dc-853a-4acb-b146-080e84c4b7df'
const RESOURCE_ID = '17af8b84-58bf-4a92-8f8b-197556ed98f4'
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'
const SOURCE_DIGEST = hashKBContentDigestEntries([
  { resourceId: RESOURCE_ID, contentSha256: CONTENT_SHA256 },
])
const STALE_SOURCE_DIGEST =
  'c2d01b6fd94f7a792b00401922865f76da84d5206a2c6940a009456f5e2f1a15'
const SOURCE_URL = 'https://content.example.org/public-paper.pdf?version=1'

const externalEnv = {
  KB_GRAPH_HATCHET_CLIENT_TOKEN: 'external-token',
  KB_GRAPH_HATCHET_CLIENT_HOST_PORT: 'hatchet-engine.other:7070',
  KB_GRAPH_HATCHET_API_URL: 'http://hatchet-api.other:8080',
  KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY: 'none',
  KB_GRAPH_HATCHET_WORKFLOW_NAME: 'course-kg-ingestion',
  KB_GRAPH_TIMEOUT_SECONDS: '3600',
  KB_GRAPH_STANDARD_GENERATION_MODEL: 'klickeruzh/azure/gpt-5.4',
  KB_GRAPH_STANDARD_CLEANING_MODEL: 'klickeruzh/azure/gpt-4.1-nano',
  KB_GRAPH_HIGH_GENERATION_MODEL: 'klickeruzh/azure/gpt-5.4-high',
  KB_GRAPH_HIGH_CLEANING_MODEL: 'klickeruzh/azure/gpt-4.1',
  KB_FALKORDB_HOST: 'falkordb.other',
  KB_FALKORDB_PORT: '6379',
  KB_FALKORDB_TLS: 'false',
  KB_FALKORDB_QUERY_TIMEOUT_MS: '5000',
}

function createBuild(overrides: Record<string, unknown> = {}) {
  return {
    id: BUILD_ID,
    kbId: KB_ID,
    sourceContentDigest: SOURCE_DIGEST,
    graphName: `klickeruzh:kb:${KB_ID}:${BUILD_ID}`,
    graphmlBlobName: `knowledge-graphs/${BUILD_ID}.graphml`,
    qualityTier: KBGraphQualityTier.STANDARD,
    createdAt: CREATED_AT,
    status: KBGraphBuildStatus.QUEUED,
    externalOperationId: null,
    kb: {
      ownerId: OWNER_ID,
      deletedAt: null,
      activeGraphBuildId: BUILD_ID,
    },
    sources: [
      {
        resourceId: RESOURCE_ID,
        type: KBResourceType.URL,
        sourceUrl: SOURCE_URL,
        blobName: null,
        contentSha256: CONTENT_SHA256,
      },
    ],
    ...overrides,
  }
}

function createClient({
  runId = 'external-run-id',
  rows = [],
}: {
  runId?: string
  rows?: Array<{
    workflowRunExternalId: string
    createdAt: string
    additionalMetadata?: Record<string, unknown>
  }>
} = {}) {
  return {
    runs: {
      get_status: vi.fn().mockResolvedValue('QUEUED'),
      list: vi.fn().mockResolvedValue({ rows }),
      cancel: vi.fn().mockResolvedValue({}),
    },
    runNoWait: vi.fn().mockResolvedValue({
      getWorkflowRunId: vi.fn().mockResolvedValue(runId),
    }),
  } as unknown as ExternalKBGraphClient
}

function createDispatchPrisma({
  build = createBuild(),
  updateCount = 1,
  rereadExternalOperationId,
}: {
  build?: ReturnType<typeof createBuild> | null
  updateCount?: number
  rereadExternalOperationId?: string | null
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(build)
  if (rereadExternalOperationId !== undefined) {
    findUnique
      .mockResolvedValueOnce(build)
      .mockResolvedValueOnce({ externalOperationId: rereadExternalOperationId })
  }
  const prisma = {
    kBGraphBuild: {
      findUnique,
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
    kB: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  return prisma
}

function createMonitorPrisma(
  builds: Array<Record<string, unknown>>,
  {
    timedOutBuilds = [],
    timedOutBuildCount = timedOutBuilds.length,
    newerBuild = null,
    servingResources = [],
  }: {
    timedOutBuilds?: Array<Record<string, unknown>>
    timedOutBuildCount?: number
    newerBuild?: { id: string } | null
    servingResources?: Array<{
      id: string
      activeContentSha256: string | null
    }>
  } = {}
) {
  const prisma = {
    kBGraphBuild: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(builds)
        .mockResolvedValueOnce(timedOutBuilds),
      count: vi.fn().mockResolvedValue(timedOutBuildCount),
      findFirst: vi.fn().mockResolvedValue(newerBuild),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kB: {
      findUnique: vi
        .fn()
        .mockResolvedValue({ activeGraphBuildId: null, deletedAt: null }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBResource: { findMany: vi.fn().mockResolvedValue(servingResources) },
    $queryRaw: vi
      .fn()
      .mockResolvedValue([
        { id: KB_ID, activeGraphBuildId: null, deletedAt: null },
      ]),
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  return prisma
}

describe('KB graph external dispatch', () => {
  it('allows an unconfigured worker but rejects a partial graph integration', () => {
    expect(() => validateKBGraphWorkerConfig({})).not.toThrow()
    expect(() =>
      validateKBGraphWorkerConfig({
        KB_GRAPH_HATCHET_CLIENT_TOKEN: 'external-token',
      })
    ).toThrow('KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY must be configured')
    expect(() => validateKBGraphWorkerConfig(externalEnv)).not.toThrow()
  })

  it('builds the pinned external manifest field-for-field', () => {
    const build = createBuild()

    expect(
      buildExternalKBGraphPayload(build, [SOURCE_URL], externalEnv)
    ).toEqual({
      course_id: BUILD_ID,
      storage_name: BUILD_ID,
      sources: [
        {
          source_id: RESOURCE_ID,
          source_url: SOURCE_URL,
          expected_content_sha256: CONTENT_SHA256,
        },
      ],
      upload_markdown: false,
      export_to_falkordb: true,
      falkordb_graph_name: `klickeruzh:kb:${KB_ID}:${BUILD_ID}`,
      speed_mode: 'balanced',
      generation_model: 'klickeruzh/azure/gpt-5.4',
      cleaning_model: 'klickeruzh/azure/gpt-4.1-nano',
      klicker_graph_build: {
        build_id: BUILD_ID,
        kb_id: KB_ID,
        owner_id: OWNER_ID,
        source_content_digest: SOURCE_DIGEST,
        graphml_container_name: `kb-${OWNER_ID}`,
        graphml_blob_name: `knowledge-graphs/${BUILD_ID}.graphml`,
      },
    })
  })

  it('creates an exact-blob, read-only, HTTPS-only SAS for a private source', () => {
    const sourceUrl = getKBGraphSourceUrl(
      {
        type: KBResourceType.BLOB,
        sourceUrl: null,
        blobName: 'slides/private.pdf',
      },
      {
        ownerId: OWNER_ID,
        env: {
          BLOB_STORAGE_ACCOUNT_NAME: 'klickertest',
          BLOB_STORAGE_ACCESS_KEY: Buffer.alloc(32).toString('base64'),
          KB_GRAPH_TIMEOUT_SECONDS: '3600',
        },
        now: () => NOW,
      }
    )

    const parsed = new URL(sourceUrl)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `https://klickertest.blob.core.windows.net/kb-${OWNER_ID}/slides/private.pdf`
    )
    expect(parsed.searchParams.get('sp')).toBe('r')
    expect(parsed.searchParams.get('spr')).toBe('https')
    expect(new Date(parsed.searchParams.get('st')!).toISOString()).toBe(
      '2026-08-01T11:55:00.000Z'
    )
    expect(new Date(parsed.searchParams.get('se')!).toISOString()).toBe(
      '2026-08-01T13:05:00.000Z'
    )
  })

  it('persists a single external correlation for the active KB build', async () => {
    const prisma = createDispatchPrisma()
    const client = createClient()

    await expect(
      dispatchKBGraphBuild(
        { buildId: BUILD_ID },
        {
          prisma: prisma as never,
          client,
          env: externalEnv,
          now: () => NOW,
          getSourceUrl: () => SOURCE_URL,
        }
      )
    ).resolves.toBe('external-run-id')

    expect(vi.mocked(client.runNoWait)).toHaveBeenCalledWith(
      'course-kg-ingestion',
      expect.objectContaining({
        course_id: BUILD_ID,
        storage_name: BUILD_ID,
        sources: [
          expect.objectContaining({
            source_id: RESOURCE_ID,
            expected_content_sha256: CONTENT_SHA256,
          }),
        ],
      }),
      {
        additionalMetadata: {
          [KB_GRAPH_BUILD_METADATA_KEY]: BUILD_ID,
          [KB_GRAPH_KB_METADATA_KEY]: KB_ID,
        },
      }
    )
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BUILD_ID,
          kbId: KB_ID,
          externalOperationId: null,
        }),
        data: expect.objectContaining({
          externalOperationId: 'external-run-id',
          externalStartedAt: NOW,
          startedAt: NOW,
        }),
      })
    )
  })

  it('recovers a matching external build before creating a duplicate run', async () => {
    const prisma = createDispatchPrisma()
    const client = createClient({
      runId: 'new-run-id',
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: '2026-08-01T11:57:00.000Z',
          additionalMetadata: {
            [KB_GRAPH_BUILD_METADATA_KEY]: BUILD_ID,
            [KB_GRAPH_KB_METADATA_KEY]: KB_ID,
          },
        },
      ],
    })

    await expect(
      dispatchKBGraphBuild(
        { buildId: BUILD_ID },
        {
          prisma: prisma as never,
          client,
          env: externalEnv,
          now: () => NOW,
          getSourceUrl: () => SOURCE_URL,
        }
      )
    ).resolves.toBe('recovered-run-id')

    expect(vi.mocked(client.runNoWait)).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalOperationId: 'recovered-run-id',
          externalStartedAt: new Date('2026-08-01T11:57:00.000Z'),
        }),
      })
    )
  })

  it('cancels an orphaned external run when the guarded correlation loses its race', async () => {
    const prisma = createDispatchPrisma({ updateCount: 0 })
    const client = createClient({ runId: 'orphaned-run-id' })

    await expect(
      dispatchKBGraphBuild(
        { buildId: BUILD_ID },
        {
          prisma: prisma as never,
          client,
          env: externalEnv,
          now: () => NOW,
          getSourceUrl: () => SOURCE_URL,
        }
      )
    ).resolves.toBeUndefined()

    expect(vi.mocked(client.runs.cancel)).toHaveBeenCalledWith({
      ids: ['orphaned-run-id'],
    })
  })
})

describe('KB graph external reconciliation', () => {
  it('publishes a completed build and releases its active slot', async () => {
    const prisma = createMonitorPrisma([
      {
        id: BUILD_ID,
        kbId: KB_ID,
        externalOperationId: 'external-run-id',
        externalStartedAt: new Date('2026-08-01T11:59:00.000Z'),
      },
    ])
    const client = createClient()
    vi.mocked(client.runs.get_status).mockResolvedValue('COMPLETED')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: BUILD_ID }),
        data: expect.objectContaining({
          status: KBGraphBuildStatus.SUCCEEDED,
          finishedAt: NOW,
        }),
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: {
        id: KB_ID,
        deletedAt: null,
        activeGraphBuildId: BUILD_ID,
      },
      data: {
        activeGraphBuildId: null,
        publishedGraphBuildId: BUILD_ID,
      },
    })
  })

  it('times out a running build, cancels it, and releases its active slot', async () => {
    const prisma = createMonitorPrisma([
      {
        id: BUILD_ID,
        kbId: KB_ID,
        externalOperationId: 'external-run-id',
        externalStartedAt: new Date('2026-08-01T10:00:00.000Z'),
      },
    ])
    const client = createClient()
    vi.mocked(client.runs.get_status).mockResolvedValue('RUNNING')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    expect(vi.mocked(client.runs.cancel)).toHaveBeenCalledWith({
      ids: ['external-run-id'],
    })
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_TIMEOUT',
        }),
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it('rotates the timed-out graph backstop window', async () => {
    const prisma = createMonitorPrisma([], {
      timedOutBuildCount: 64,
    })
    const client = createClient()

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => new Date(NOW.getTime() + 15 * 60 * 1000),
    })

    expect(prisma.kBGraphBuild.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: 32, take: 32 })
    )
  })

  it('accepts a late completion only when the pinned source digest still matches', async () => {
    const matchingDigest = hashKBContentDigestEntries([
      { resourceId: RESOURCE_ID, contentSha256: CONTENT_SHA256 },
    ])
    const prisma = createMonitorPrisma([], {
      timedOutBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          sourceContentDigest: matchingDigest,
          createdAt: CREATED_AT,
          externalOperationId: 'external-run-id',
        },
      ],
      servingResources: [
        { id: RESOURCE_ID, activeContentSha256: CONTENT_SHA256 },
      ],
    })
    const client = createClient()
    vi.mocked(client.runs.get_status).mockResolvedValue('COMPLETED')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_TIMEOUT',
          cleanedAt: null,
          cleanupStartedAt: null,
        }),
        data: expect.objectContaining({
          status: KBGraphBuildStatus.SUCCEEDED,
          errorCode: null,
        }),
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, deletedAt: null, activeGraphBuildId: null },
      data: { publishedGraphBuildId: BUILD_ID },
    })
  })

  it('keeps a late completion failed when the KB source digest has moved on', async () => {
    const prisma = createMonitorPrisma([], {
      timedOutBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          sourceContentDigest: STALE_SOURCE_DIGEST,
          createdAt: CREATED_AT,
          externalOperationId: 'external-run-id',
        },
      ],
      servingResources: [
        { id: RESOURCE_ID, activeContentSha256: CONTENT_SHA256 },
      ],
    })
    const client = createClient()
    vi.mocked(client.runs.get_status).mockResolvedValue('COMPLETED')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          status: KBGraphBuildStatus.FAILED,
          statusMessage: 'The KB changed before the timed-out build completed.',
          errorCode: 'KB_GRAPH_LATE_SUCCESS_STALE',
        },
      })
    )
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
  })
})

describe('KB graph build failure guard', () => {
  it('marks only an uncorrelated active build as failed and releases its slot', async () => {
    const prisma = createDispatchPrisma()

    await markKBGraphBuildDispatchFailed({ buildId: BUILD_ID }, prisma as never)

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: BUILD_ID,
          kbId: KB_ID,
          externalOperationId: null,
        }),
        data: expect.objectContaining({
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_DISPATCH_FAILED',
        }),
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })
})

import { hashKBContentDigestEntries } from '@klicker-uzh/knowledge-graph'
import {
  KBGraphBuildStatus,
  KBGraphCostStatus,
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
  getKBGraphTerminalResult,
  KB_GRAPH_BUILD_METADATA_KEY,
  KB_GRAPH_KB_METADATA_KEY,
  validateKBGraphWorkerConfig,
  type ExternalKBGraphClient,
} from '../src/kbGraphIngestionApi.js'

const NOW = new Date('2026-08-01T12:00:00.000Z')
const CREATED_AT = new Date('2026-08-01T11:55:00.000Z')
// Older than the 15-minute in-flight grace, so the claiming attempt is treated as
// abandoned rather than as a dispatch that may still be inside the provider call.
const STALE_CLAIMED_AT = new Date(NOW.getTime() - 16 * 60 * 1000)
const FRESH_CLAIMED_AT = new Date(NOW.getTime() - 60 * 1000)
const BUILD_ID = 'd1ec25e9-71ae-449f-88c5-7872f0b1a875'
const KB_ID = '842f262d-3482-43aa-956a-68f0c52184dd'
const OWNER_ID = 'fb5c14dc-853a-4acb-b146-080e84c4b7df'
const QUOTA_ID = '82b6f7a1-7aa7-4fc1-b7a0-648ba4c64e90'
const RESOURCE_ID = '17af8b84-58bf-4a92-8f8b-197556ed98f4'
const CONTENT_SHA256 =
  '9b74c9897bac770ffc029102a200c5de11ba9dbd0e0f28c991eb64b0fb54d96e'
const SOURCE_DIGEST = hashKBContentDigestEntries([
  { resourceId: RESOURCE_ID, contentSha256: CONTENT_SHA256 },
])
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
    dispatchClaimedAt: null,
    costStatus: KBGraphCostStatus.RESERVED,
    estimatedCostMinorUnits: 100,
    costCurrency: 'CHF',
    costPricingVersion: 'test-v1',
    semesterKey: '2026-H2',
    quotaId: QUOTA_ID,
    quota: {
      id: QUOTA_ID,
      ownerId: OWNER_ID,
      semesterKey: '2026-H2',
      currency: 'CHF',
      limitMinorUnits: 1000,
      reservedMinorUnits: 100,
    },
    kb: {
      ownerId: OWNER_ID,
      deletedAt: null,
      activeGraphBuildId: BUILD_ID,
      knowledgeGraphEnabled: true,
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
      get: vi.fn().mockResolvedValue({ run: { output: null } }),
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
    kBGraphQuota: {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kB: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    $queryRaw: vi.fn().mockResolvedValue([{ id: QUOTA_ID }]),
    $transaction: vi.fn(),
  }
  prisma.$transaction.mockImplementation(async (callback) => callback(prisma))
  return prisma
}

function createMonitorPrisma(
  builds: Array<Record<string, unknown>>,
  {
    activeBuildCount = builds.length,
    timedOutBuilds = [],
    timedOutBuildCount = timedOutBuilds.length,
    newerBuild = null,
    servingResources = [],
    ambiguousBuilds = [],
    ambiguousBuildCount = ambiguousBuilds.length,
  }: {
    activeBuildCount?: number
    timedOutBuilds?: Array<Record<string, unknown>>
    timedOutBuildCount?: number
    newerBuild?: { id: string } | null
    servingResources?: Array<{
      id: string
      activeContentSha256: string | null
    }>
    ambiguousBuilds?: Array<Record<string, unknown>>
    ambiguousBuildCount?: number
  } = {}
) {
  const prisma = {
    kBGraphBuild: {
      findMany: vi
        .fn()
        .mockResolvedValueOnce(builds)
        .mockResolvedValueOnce(timedOutBuilds)
        .mockResolvedValueOnce(ambiguousBuilds),
      count: vi
        .fn()
        .mockResolvedValueOnce(activeBuildCount)
        .mockResolvedValueOnce(timedOutBuildCount)
        .mockResolvedValueOnce(ambiguousBuildCount),
      findFirst: vi.fn().mockResolvedValue(newerBuild),
      findUnique: vi.fn().mockResolvedValue({
        quotaId: QUOTA_ID,
        estimatedCostMinorUnits: 100,
        costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    kBGraphQuota: {
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
  it('reads the versioned terminal payload from the external run output', async () => {
    const client = createClient()
    const result = { contract_version: 'klicker-kb-graph/v1' }
    vi.mocked(client.runs.get).mockResolvedValue({ run: { output: result } })

    await expect(
      getKBGraphTerminalResult('external-run-id', client)
    ).resolves.toEqual(result)
  })

  it('allows an unconfigured worker but rejects a partial graph integration', () => {
    expect(() => validateKBGraphWorkerConfig({})).not.toThrow()
    // The out-of-repo worker secret alone must not arm the gate: doing so would
    // stop every unrelated general-worker job if the secret lands first.
    expect(() =>
      validateKBGraphWorkerConfig({
        KB_GRAPH_HATCHET_CLIENT_TOKEN: 'external-token',
      })
    ).not.toThrow()
    expect(() =>
      validateKBGraphWorkerConfig({
        KB_GRAPH_HATCHET_WORKFLOW_NAME: 'course-kg-ingestion',
      })
    ).toThrow('KB_GRAPH_HATCHET_CLIENT_TLS_STRATEGY must be configured')
    expect(() => validateKBGraphWorkerConfig(externalEnv)).not.toThrow()
  })

  it('uses a loopback Blob endpoint for host-side graph sources', () => {
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
          BLOB_STORAGE_ACCOUNT_URL: 'https://blob.example.org',
          KB_GRAPH_BLOB_ACCOUNT_URL: 'http://127.0.0.1:10003/klickerdev',
          KB_GRAPH_TIMEOUT_SECONDS: '3600',
        },
        now: () => NOW,
      }
    )

    const parsed = new URL(sourceUrl)
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `http://127.0.0.1:10003/klickerdev/kb-${OWNER_ID}/slides/private.pdf`
    )
    expect(parsed.searchParams.get('sp')).toBe('r')
    expect(parsed.searchParams.get('spr')).toBeNull()
  })

  it('rejects a cleartext non-local Blob endpoint', () => {
    expect(() =>
      getKBGraphSourceUrl(
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
            KB_GRAPH_BLOB_ACCOUNT_URL: 'http://blob.example.org',
            KB_GRAPH_TIMEOUT_SECONDS: '3600',
          },
          now: () => NOW,
        }
      )
    ).toThrow(
      'KB graph Blob account URL must use HTTPS outside local development'
    )
  })

  it('rejects a loopback-looking hostname outside local development', () => {
    expect(() =>
      getKBGraphSourceUrl(
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
            KB_GRAPH_BLOB_ACCOUNT_URL: 'http://127.example.com',
            KB_GRAPH_TIMEOUT_SECONDS: '3600',
          },
          now: () => NOW,
        }
      )
    ).toThrow(
      'KB graph Blob account URL must use HTTPS outside local development'
    )
  })

  it('fails a queued build closed when the global graph kill switch is enabled', async () => {
    const prisma = createDispatchPrisma()
    const client = createClient()

    await expect(
      dispatchKBGraphBuild(
        { buildId: BUILD_ID },
        {
          prisma: prisma as never,
          client,
          env: { ...externalEnv, KB_GRAPH_DISABLED: 'true' },
          now: () => NOW,
          getSourceUrl: () => SOURCE_URL,
        }
      )
    ).resolves.toBeUndefined()

    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphQuota.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { reservedMinorUnits: { decrement: 100 } },
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it('rechecks the persisted KB opt-in before starting the external run', async () => {
    const prisma = createDispatchPrisma()
    const initialBuild = createBuild()
    const optedOutBuild = createBuild({
      kb: { ...initialBuild.kb, knowledgeGraphEnabled: false },
    })
    prisma.kBGraphBuild.findUnique
      .mockReset()
      .mockResolvedValueOnce(initialBuild)
      .mockResolvedValueOnce(optedOutBuild)
      .mockResolvedValue(optedOutBuild)
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
    ).resolves.toBeUndefined()

    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ errorCode: 'KB_GRAPH_NOT_ENABLED' }),
      })
    )
  })

  it('holds a pre-accounting build for review instead of dispatching it', async () => {
    const build = createBuild({ costStatus: null })
    const prisma = createDispatchPrisma({ build })
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
    ).resolves.toBeUndefined()

    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW,
        }),
      })
    )
  })

  it('holds a reservation with incomplete quota identity before dispatch', async () => {
    const build = createBuild({ quota: null })
    const prisma = createDispatchPrisma({ build })
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
    ).resolves.toBeUndefined()

    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'KB_GRAPH_RESERVATION_INCOMPLETE',
        }),
      })
    )
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
      })
    )
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
      upload_graph_artifacts: true,
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

  it('holds the reservation when provider acceptance cannot be correlated', async () => {
    const prisma = createDispatchPrisma()
    const client = createClient()
    vi.mocked(client.runNoWait).mockResolvedValue({
      getWorkflowRunId: vi
        .fn()
        .mockRejectedValue(new Error('run id unavailable')),
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
    ).rejects.toThrow('External KB graph build dispatch failed')

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dispatchClaimedAt: NOW },
      })
    )

    const ambiguousPrisma = createDispatchPrisma({
      build: createBuild({ dispatchClaimedAt: STALE_CLAIMED_AT }),
    })
    await markKBGraphBuildDispatchFailed(
      { buildId: BUILD_ID },
      ambiguousPrisma as never
    )

    expect(ambiguousPrisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(ambiguousPrisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
      })
    )
    expect(ambiguousPrisma.kB.updateMany).not.toHaveBeenCalled()
  })

  it('correlates an accepted-but-uncorrelated dispatch instead of parking it', async () => {
    const prisma = createDispatchPrisma({
      build: createBuild({ dispatchClaimedAt: STALE_CLAIMED_AT }),
    })
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: NOW.toISOString(),
          additionalMetadata: {
            [KB_GRAPH_BUILD_METADATA_KEY]: BUILD_ID,
            [KB_GRAPH_KB_METADATA_KEY]: KB_ID,
          },
        },
      ],
    })

    await dispatchKBGraphBuild(
      { buildId: BUILD_ID },
      {
        prisma: prisma as never,
        client,
        env: externalEnv,
        now: () => NOW,
        getSourceUrl: () => SOURCE_URL,
      }
    )

    // The run the earlier attempt lost is adopted, so no second run is started
    // and the build leaves the ambiguous state on its own.
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          externalOperationId: 'recovered-run-id',
          status: KBGraphBuildStatus.PROCESSING,
          errorCode: null,
        }),
      })
    )
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
  })

  it('leaves a freshly claimed dispatch alone instead of releasing its money', async () => {
    const prisma = createDispatchPrisma({
      build: createBuild({ dispatchClaimedAt: FRESH_CLAIMED_AT }),
    })
    const client = createClient({ rows: [] })

    await dispatchKBGraphBuild(
      { buildId: BUILD_ID },
      {
        prisma: prisma as never,
        client,
        env: externalEnv,
        now: () => NOW,
        getSourceUrl: () => SOURCE_URL,
      }
    )

    // A duplicate task run for the same build must not act on the provider's
    // "no run yet": the first attempt may still be inside its dispatch call and
    // about to start a run that spends. Nothing is asked, nothing is written.
    expect(client.runs.list).not.toHaveBeenCalled()
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).not.toHaveBeenCalled()
    expect(prisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
  })

  it('releases the hold when the provider has no run for the claimed build', async () => {
    const prisma = createDispatchPrisma({
      build: createBuild({ dispatchClaimedAt: STALE_CLAIMED_AT }),
    })
    const client = createClient({ rows: [] })

    await dispatchKBGraphBuild(
      { buildId: BUILD_ID },
      {
        prisma: prisma as never,
        client,
        env: externalEnv,
        now: () => NOW,
        getSourceUrl: () => SOURCE_URL,
      }
    )

    // Nothing external was ever accepted, so this is an ordinary dispatch
    // failure: the quota is given back and the KB build slot is freed.
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'KB_GRAPH_DISPATCH_FAILED',
        }),
      })
    )
    expect(prisma.kBGraphQuota.updateMany).toHaveBeenCalled()
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it('keeps the ambiguous hold when the provider lookup itself fails', async () => {
    const prisma = createDispatchPrisma({
      build: createBuild({ dispatchClaimedAt: STALE_CLAIMED_AT }),
    })
    const client = createClient()
    vi.mocked(client.runs.list).mockRejectedValue(new Error('provider down'))

    await dispatchKBGraphBuild(
      { buildId: BUILD_ID },
      {
        prisma: prisma as never,
        client,
        env: externalEnv,
        now: () => NOW,
        getSourceUrl: () => SOURCE_URL,
      }
    )

    // A run may still be generating and spending, so neither the quota nor the
    // build slot may be handed back on an unanswered lookup.
    expect(prisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'KB_GRAPH_DISPATCH_AMBIGUOUS',
        }),
      })
    )
  })

  it('does not release a reservation when gate compensation loses the dispatch claim race', async () => {
    const prisma = createDispatchPrisma({ updateCount: 0 })
    const client = createClient()

    await expect(
      dispatchKBGraphBuild(
        { buildId: BUILD_ID },
        {
          prisma: prisma as never,
          client,
          env: { ...externalEnv, KB_GRAPH_DISABLED: 'true' },
          now: () => NOW,
          getSourceUrl: () => SOURCE_URL,
        }
      )
    ).resolves.toBeUndefined()

    expect(prisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
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
    prisma.kBGraphBuild.updateMany
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 })
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
  it('fails closed when a completed build has no versioned terminal result', async () => {
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
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_RESULT_REQUIRED',
          finishedAt: NOW,
        }),
      })
    )
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it('hands a completed build to the versioned terminal-result settlement path', async () => {
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
    const getTerminalResult = vi.fn().mockResolvedValue({ status: 'SUCCEEDED' })
    const settleTerminalResult = vi.fn().mockResolvedValue('SETTLED')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
      getTerminalResult,
      settleTerminalResult,
    })

    expect(getTerminalResult).toHaveBeenCalledWith(
      'external-run-id',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(settleTerminalResult).toHaveBeenCalledWith({
      buildId: BUILD_ID,
      result: { status: 'SUCCEEDED' },
      finishedAt: NOW,
    })
    expect(prisma.kBGraphBuild.updateMany).not.toHaveBeenCalled()
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
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

    expect(vi.mocked(client.runs.cancel)).toHaveBeenCalledWith(
      { ids: ['external-run-id'] },
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_TIMEOUT',
        }),
      })
    )
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { costStatus: KBGraphCostStatus.NEEDS_HUMAN_REVIEW },
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it.each([
    { buildCount: 33, elapsedIntervals: 1, expectedSkip: 32 },
    { buildCount: 65, elapsedIntervals: 2, expectedSkip: 64 },
  ])('rotates the timed-out graph backstop window for $buildCount builds', async ({
    buildCount,
    elapsedIntervals,
    expectedSkip,
  }) => {
    const prisma = createMonitorPrisma([], {
      timedOutBuildCount: buildCount,
    })
    const client = createClient()

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => new Date(NOW.getTime() + elapsedIntervals * 15 * 60 * 1000),
    })

    expect(prisma.kBGraphBuild.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ skip: expectedSkip, take: 32 })
    )
  })

  it.each([
    { buildCount: 33, elapsedIntervals: 1, expectedSkip: 32 },
    { buildCount: 65, elapsedIntervals: 2, expectedSkip: 64 },
  ])('rotates the active graph monitor window for $buildCount builds', async ({
    buildCount,
    elapsedIntervals,
    expectedSkip,
  }) => {
    const prisma = createMonitorPrisma([], { activeBuildCount: buildCount })
    const client = createClient()

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => new Date(NOW.getTime() + elapsedIntervals * 15 * 60 * 1000),
    })

    expect(prisma.kBGraphBuild.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ skip: expectedSkip, take: 32 })
    )
  })

  it('limits active provider status checks to eight at a time', async () => {
    const builds = Array.from({ length: 16 }, (_, index) => ({
      id: `build-${index}`,
      kbId: KB_ID,
      externalOperationId: `external-run-${index}`,
      externalStartedAt: new Date('2026-08-01T11:59:00.000Z'),
    }))
    const prisma = createMonitorPrisma(builds)
    const client = createClient()
    let activeCalls = 0
    let maxActiveCalls = 0
    vi.mocked(client.runs.get_status).mockImplementation(async () => {
      activeCalls += 1
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls)
      await Promise.resolve()
      activeCalls -= 1
      return 'QUEUED'
    })

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    expect(maxActiveCalls).toBe(8)
  })

  it('aborts timed-out provider operations before admitting the next build', async () => {
    const builds = Array.from({ length: 9 }, (_, index) => ({
      id: `build-${index}`,
      kbId: KB_ID,
      externalOperationId: `external-run-${index}`,
      externalStartedAt: new Date('2026-08-01T11:59:00.000Z'),
    }))
    const prisma = createMonitorPrisma(builds)
    const client = createClient()
    let activeCalls = 0
    let maxActiveCalls = 0
    let callCount = 0
    vi.mocked(client.runs.get_status).mockImplementation((_runId, options) => {
      callCount += 1
      activeCalls += 1
      maxActiveCalls = Math.max(maxActiveCalls, activeCalls)
      if (callCount === 9) {
        activeCalls -= 1
        return Promise.resolve('QUEUED')
      }

      return new Promise<'QUEUED'>((_, reject) => {
        const abort = () => {
          activeCalls -= 1
          reject(options?.signal?.reason)
        }
        options?.signal?.addEventListener('abort', abort, { once: true })
      })
    })

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
      providerOperationTimeoutMs: 5,
    })

    expect(callCount).toBe(9)
    expect(maxActiveCalls).toBe(8)
    expect(activeCalls).toBe(0)
  })

  it('continues independent builds when one provider status call hangs', async () => {
    const hungBuild = {
      id: 'build-hung',
      kbId: KB_ID,
      externalOperationId: 'external-run-hung',
      externalStartedAt: new Date('2026-08-01T11:59:00.000Z'),
    }
    const readyBuild = {
      id: 'build-ready',
      kbId: KB_ID,
      externalOperationId: 'external-run-ready',
      externalStartedAt: new Date('2026-08-01T11:59:00.000Z'),
    }
    const prisma = createMonitorPrisma([hungBuild, readyBuild])
    const client = createClient()
    vi.mocked(client.runs.get_status).mockImplementation((runId, options) =>
      runId === 'external-run-hung'
        ? new Promise<'RUNNING'>((_, reject) => {
            options?.signal?.addEventListener(
              'abort',
              () => reject(options.signal?.reason),
              { once: true }
            )
          })
        : Promise.resolve('RUNNING')
    )

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
      providerOperationTimeoutMs: 5,
    })

    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'build-ready' }),
        data: expect.objectContaining({
          status: KBGraphBuildStatus.PROCESSING,
        }),
      })
    )
    expect(prisma.kBGraphBuild.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'build-hung' }),
      })
    )
  })

  it('frees a parked ambiguous build once the provider confirms no run exists', async () => {
    const prisma = createMonitorPrisma([], {
      ambiguousBuilds: [{ id: BUILD_ID, kbId: KB_ID, createdAt: CREATED_AT }],
    })
    const client = createClient({ rows: [] })

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
    })

    // The hold is a waiting state, not a permanent one: the sweep gives the
    // lecturer their quota and build slot back without an operator step.
    expect(prisma.kBGraphBuild.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          errorCode: 'KB_GRAPH_DISPATCH_FAILED',
        }),
      })
    )
    expect(prisma.kB.updateMany).toHaveBeenCalledWith({
      where: { id: KB_ID, activeGraphBuildId: BUILD_ID },
      data: { activeGraphBuildId: null },
    })
  })

  it('does not publish a late completion without a versioned terminal result', async () => {
    const prisma = createMonitorPrisma([], {
      timedOutBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          sourceContentDigest: SOURCE_DIGEST,
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
          status: KBGraphBuildStatus.FAILED,
          errorCode: 'KB_GRAPH_RESULT_REQUIRED',
        }),
      })
    )
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
  })

  it('settles a late completion through the versioned terminal-result handoff', async () => {
    const prisma = createMonitorPrisma([], {
      timedOutBuilds: [
        {
          id: BUILD_ID,
          kbId: KB_ID,
          sourceContentDigest: SOURCE_DIGEST,
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
    const getTerminalResult = vi.fn().mockResolvedValue({ status: 'SUCCEEDED' })
    const settleTerminalResult = vi.fn().mockResolvedValue('SETTLED')

    await monitorActiveKBGraphBuilds({
      prisma: prisma as never,
      client,
      env: externalEnv,
      now: () => NOW,
      getTerminalResult,
      settleTerminalResult,
    })

    expect(getTerminalResult).toHaveBeenCalledWith(
      'external-run-id',
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    )
    expect(settleTerminalResult).toHaveBeenCalledWith({
      buildId: BUILD_ID,
      result: { status: 'SUCCEEDED' },
      finishedAt: NOW,
      allowLateSuccess: true,
    })
    expect(prisma.kBGraphBuild.updateMany).not.toHaveBeenCalled()
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

  it('does not release a reservation when failure compensation loses the dispatch claim race', async () => {
    const prisma = createDispatchPrisma({ updateCount: 0 })

    await markKBGraphBuildDispatchFailed({ buildId: BUILD_ID }, prisma as never)

    expect(prisma.kBGraphQuota.updateMany).not.toHaveBeenCalled()
    expect(prisma.kB.updateMany).not.toHaveBeenCalled()
  })
})

import type { HatchetClient } from '@hatchet-dev/typescript-sdk'
import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { BuildChatbotKnowledgeGraphInput } from '@klicker-uzh/types'
import { describe, expect, it, vi } from 'vitest'
import {
  buildExternalChatbotKnowledgeGraphPayload,
  dispatchChatbotKnowledgeGraphIngestion,
  KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY,
  KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY,
  markChatbotKnowledgeGraphBuildFailed,
  monitorActiveChatbotKnowledgeGraphIngestions,
} from '../src/kbGraphIngestion.js'
import type {
  ExternalHatchetClient,
  ExternalHatchetStatus,
  KBIngestionLogger,
} from '../src/kbIngestion.js'

const NOW = new Date('2026-07-20T12:00:00.000Z')
const CREATED_AT = new Date('2026-07-20T11:55:00.000Z')
const UPDATED_AT = new Date('2026-07-20T11:55:00.000Z')
const GRAPH_ID = 'd1ec25e9-71ae-449f-88c5-7872f0b1a875'
const CHATBOT_ID = '842f262d-3482-43aa-956a-68f0c52184dd'
const ATTEMPT_ID = 'fb5c14dc-853a-4acb-b146-080e84c4b7df'
const PDF_RESOURCE_ID = '17af8b84-58bf-4a92-8f8b-197556ed98f4'
const URL_RESOURCE_ID = 'ea674dbf-c9bc-47cd-91d7-e9d74d7a1078'
const PUBLIC_URL = 'https://content.example.org/public-paper.pdf?version=1'

const externalEnv = {
  KB_INGESTION_HATCHET_CLIENT_TOKEN: 'external-token',
  KB_INGESTION_HATCHET_CLIENT_HOST_PORT: 'hatchet-engine.other:7070',
  KB_INGESTION_HATCHET_API_URL: 'http://hatchet-api.other:8080',
  KB_INGESTION_HATCHET_CLIENT_TLS_STRATEGY: 'none',
  KB_INGESTION_HATCHET_WORKFLOW_NAME: 'course-kg-ingestion',
  BLOB_STORAGE_ACCOUNT_NAME: 'klickertest',
  BLOB_STORAGE_ACCESS_KEY: 'dGVzdC1rZXk=',
}

const graphInput: BuildChatbotKnowledgeGraphInput = {
  graphId: GRAPH_ID,
  chatbotId: CHATBOT_ID,
  attemptId: ATTEMPT_ID,
  selectionRevision: 3,
  speedMode: 'balanced',
  generationModel: 'klickeruzh/azure/gpt-5.4',
  cleaningModel: 'klickeruzh/azure/gpt-4.1-nano',
  resources: [
    {
      resourceId: PDF_RESOURCE_ID,
      title: 'Private slides',
      type: 'BLOB',
      containerName: 'kb-user-id',
      blobName: 'slides/private.pdf',
    },
    {
      resourceId: URL_RESOURCE_ID,
      title: 'Public paper',
      type: 'URL',
      sourceUrl: PUBLIC_URL,
    },
  ],
}

type MockPrisma = Pick<PrismaClient, 'chatbotKnowledgeGraph'>

function createPrisma({
  graph = {
    chatbotId: CHATBOT_ID,
    status: 'QUEUED',
    createdAt: CREATED_AT,
    updatedAt: UPDATED_AT,
    selectionRevision: 3,
    activeAttemptId: ATTEMPT_ID,
    activeBuildRevision: 3,
    externalWorkflowRunId: null as string | null,
  },
  updateCount = 1,
  rereadGraph,
}: {
  graph?: {
    chatbotId: string
    status: 'QUEUED' | 'PROCESSING' | 'READY'
    createdAt: Date
    updatedAt: Date
    selectionRevision: number
    activeAttemptId: string | null
    activeBuildRevision: number | null
    externalWorkflowRunId: string | null
  } | null
  updateCount?: number
  rereadGraph?: {
    activeAttemptId: string | null
    activeBuildRevision: number | null
    externalWorkflowRunId: string | null
  } | null
} = {}) {
  const findUnique = vi.fn().mockResolvedValue(graph)
  if (rereadGraph !== undefined) {
    findUnique.mockResolvedValueOnce(graph).mockResolvedValueOnce(rereadGraph)
  }

  const prisma = {
    chatbotKnowledgeGraph: {
      findUnique,
      updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
    },
  }
  return prisma as typeof prisma & MockPrisma
}

function createClient({
  rows = [],
  runId = 'external-run-id',
}: {
  rows?: Array<{
    workflowRunExternalId: string
    createdAt: string
    additionalMetadata?: Record<string, unknown>
  }>
  runId?: string
} = {}) {
  return {
    runs: {
      get_status: vi.fn().mockResolvedValue('QUEUED' as const),
      list: vi.fn().mockResolvedValue({ rows }),
      cancel: vi.fn().mockResolvedValue({}),
    },
    runNoWait: vi.fn().mockResolvedValue({
      getWorkflowRunId: vi.fn().mockResolvedValue(runId),
    }),
  } satisfies ExternalHatchetClient
}

type MonitorGraph = {
  id: string
  chatbotId: string
  selectionRevision: number
  activeAttemptId: string | null
  activeBuildRevision: number | null
  externalWorkflowRunId: string | null
  externalStartedAt: Date | null
}

function createMonitorGraph(
  overrides: Partial<MonitorGraph> = {}
): MonitorGraph {
  return {
    id: GRAPH_ID,
    chatbotId: CHATBOT_ID,
    selectionRevision: 3,
    activeAttemptId: ATTEMPT_ID,
    activeBuildRevision: 3,
    externalWorkflowRunId: 'external-run-id',
    externalStartedAt: new Date('2026-07-20T11:59:00.000Z'),
    ...overrides,
  }
}

function createMonitorPrisma(graphs: MonitorGraph[]) {
  const prisma = {
    chatbotKnowledgeGraph: {
      findMany: vi.fn().mockResolvedValue(graphs),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
  return prisma as typeof prisma & MockPrisma
}

function activeGraphGuard(graph: MonitorGraph) {
  return {
    id: graph.id,
    chatbotId: graph.chatbotId,
    activeAttemptId: graph.activeAttemptId,
    activeBuildRevision: graph.activeBuildRevision,
    externalWorkflowRunId: graph.externalWorkflowRunId,
    status: { in: ['QUEUED', 'PROCESSING'] },
  }
}

const clearedActiveGraph = {
  activeAttemptId: null,
  activeBuildRevision: null,
  externalWorkflowRunId: null,
  externalStartedAt: null,
}

describe('chatbot knowledge graph external dispatch', () => {
  it('builds the exact multi-source external workflow payload', () => {
    expect(
      buildExternalChatbotKnowledgeGraphPayload(graphInput, [
        'https://signed.example/private.pdf?sig=signature',
        PUBLIC_URL,
      ])
    ).toEqual({
      course_id: CHATBOT_ID,
      sources: [
        {
          source_id: PDF_RESOURCE_ID,
          source_url: 'https://signed.example/private.pdf?sig=signature',
        },
        { source_id: URL_RESOURCE_ID, source_url: PUBLIC_URL },
      ],
      upload_markdown: true,
      export_to_falkordb: true,
      falkordb_graph_name: `klickeruzh:${CHATBOT_ID}`,
      speed_mode: 'balanced',
      generation_model: 'klickeruzh/azure/gpt-5.4',
      cleaning_model: 'klickeruzh/azure/gpt-4.1-nano',
    })
  })

  it('creates an exact-blob, read-only, HTTPS-only one-hour SAS and never persists or logs it', async () => {
    const prisma = createPrisma()
    const client = createClient()
    const logger = { info: vi.fn(), error: vi.fn() } satisfies KBIngestionLogger

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
        now: () => NOW,
        logger,
      })
    ).resolves.toBe('external-run-id')

    const payload = client.runNoWait.mock.calls[0]![1]
    expect(payload).toEqual({
      course_id: CHATBOT_ID,
      sources: [
        {
          source_id: PDF_RESOURCE_ID,
          source_url: expect.stringContaining('sig='),
        },
        { source_id: URL_RESOURCE_ID, source_url: PUBLIC_URL },
      ],
      upload_markdown: true,
      export_to_falkordb: true,
      falkordb_graph_name: `klickeruzh:${CHATBOT_ID}`,
      speed_mode: 'balanced',
      generation_model: 'klickeruzh/azure/gpt-5.4',
      cleaning_model: 'klickeruzh/azure/gpt-4.1-nano',
    })
    const sourceUrl = new URL(payload.sources[0]!.source_url)
    expect(`${sourceUrl.origin}${sourceUrl.pathname}`).toBe(
      'https://klickertest.blob.core.windows.net/kb-user-id/slides/private.pdf'
    )
    expect(sourceUrl.searchParams.get('sp')).toBe('r')
    expect(sourceUrl.searchParams.get('spr')).toBe('https')
    expect(new Date(sourceUrl.searchParams.get('st')!).toISOString()).toBe(
      '2026-07-20T11:55:00.000Z'
    )
    expect(new Date(sourceUrl.searchParams.get('se')!).toISOString()).toBe(
      '2026-07-20T13:00:00.000Z'
    )
    expect(
      JSON.stringify(prisma.chatbotKnowledgeGraph.updateMany.mock.calls)
    ).not.toContain('sig=')
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('sig=')
    expect(logger.info).toHaveBeenCalledWith(
      'External chatbot knowledge graph ingestion dispatched',
      {
        graphId: GRAPH_ID,
        chatbotId: CHATBOT_ID,
        attemptId: ATTEMPT_ID,
      }
    )
  })

  it('recovers a retry by attempt and chatbot metadata without triggering a duplicate run', async () => {
    const prisma = createPrisma()
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
          additionalMetadata: {
            [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
            [KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY]: CHATBOT_ID,
          },
        },
      ],
    })

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
        now: () => NOW,
      })
    ).resolves.toBe('recovered-run-id')
    expect(client.runs.list).toHaveBeenCalledWith({
      workflowNames: ['course-kg-ingestion'],
      additionalMetadata: {
        [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
      },
      onlyTasks: false,
      includePayloads: false,
      limit: 1,
      since: new Date('2026-07-20T11:50:00.000Z'),
    })
    expect(client.runNoWait).not.toHaveBeenCalled()
    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
      where: {
        id: GRAPH_ID,
        chatbotId: CHATBOT_ID,
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        status: { in: ['QUEUED', 'PROCESSING'] },
        externalWorkflowRunId: null,
      },
      data: {
        externalWorkflowRunId: 'recovered-run-id',
        externalStartedAt: new Date('2026-07-20T11:57:00.000Z'),
      },
    })
  })

  it('rejects an unrelated run returned by the metadata lookup', async () => {
    const prisma = createPrisma()
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'unrelated-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
          additionalMetadata: {
            [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: 'another-attempt-id',
            [KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY]: CHATBOT_ID,
          },
        },
      ],
      runId: 'new-run-id',
    })

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
        now: () => NOW,
      })
    ).resolves.toBe('new-run-id')
    expect(client.runNoWait).toHaveBeenCalledOnce()
    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          externalWorkflowRunId: 'new-run-id',
          externalStartedAt: NOW,
        },
      })
    )
  })

  it('recovers a delayed retry from the immutable graph creation time after updatedAt advances', async () => {
    const prisma = createPrisma({
      graph: {
        chatbotId: CHATBOT_ID,
        status: 'PROCESSING',
        createdAt: new Date('2026-07-20T10:00:00.000Z'),
        updatedAt: new Date('2026-07-20T12:30:00.000Z'),
        selectionRevision: 3,
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        externalWorkflowRunId: null,
      },
    })
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'delayed-recovered-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
          additionalMetadata: {
            [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
            [KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY]: CHATBOT_ID,
          },
        },
      ],
    })

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
      })
    ).resolves.toBe('delayed-recovered-run-id')
    expect(client.runs.list).toHaveBeenCalledWith(
      expect.objectContaining({ since: new Date('2026-07-20T09:55:00.000Z') })
    )
    expect(client.runNoWait).not.toHaveBeenCalled()
  })

  it('does not dispatch a stale attempt or rebuild a graph with an existing run', async () => {
    const stalePrisma = createPrisma({
      graph: {
        chatbotId: CHATBOT_ID,
        status: 'QUEUED',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        selectionRevision: 4,
        activeAttemptId: 'a-newer-attempt',
        activeBuildRevision: 4,
        externalWorkflowRunId: null,
      },
    })
    const staleClient = createClient()
    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma: stalePrisma,
        client: staleClient,
        env: externalEnv,
      })
    ).resolves.toBeUndefined()
    expect(staleClient.runs.list).not.toHaveBeenCalled()
    expect(staleClient.runNoWait).not.toHaveBeenCalled()

    const existingRunPrisma = createPrisma({
      graph: {
        chatbotId: CHATBOT_ID,
        status: 'PROCESSING',
        createdAt: CREATED_AT,
        updatedAt: UPDATED_AT,
        selectionRevision: 3,
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        externalWorkflowRunId: 'already-persisted-run',
      },
    })
    const existingRunClient = createClient()
    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma: existingRunPrisma,
        client: existingRunClient,
        env: externalEnv,
      })
    ).resolves.toBe('already-persisted-run')
    expect(existingRunClient.runs.list).not.toHaveBeenCalled()
    expect(existingRunClient.runNoWait).not.toHaveBeenCalled()
  })

  it('best-effort cancels the external run when guarded persistence loses the race', async () => {
    const prisma = createPrisma({ updateCount: 0 })
    const client = createClient({ runId: 'orphaned-run-id' })

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
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

  it('converges without cancellation when the same attempt persisted the same recovered run', async () => {
    const prisma = createPrisma({
      updateCount: 0,
      rereadGraph: {
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        externalWorkflowRunId: 'recovered-run-id',
      },
    })
    const client = createClient({
      rows: [
        {
          workflowRunExternalId: 'recovered-run-id',
          createdAt: '2026-07-20T11:57:00.000Z',
          additionalMetadata: {
            [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: ATTEMPT_ID,
            [KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY]: CHATBOT_ID,
          },
        },
      ],
    })

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
      })
    ).resolves.toBe('recovered-run-id')
    expect(client.runs.cancel).not.toHaveBeenCalled()
  })

  it('sanitizes external dispatch failures', async () => {
    const prisma = createPrisma()
    const client = createClient()
    const logger = { error: vi.fn() } satisfies KBIngestionLogger
    client.runNoWait.mockRejectedValue(
      new Error('private SDK response with sig=secret')
    )

    await expect(
      dispatchChatbotKnowledgeGraphIngestion(graphInput, {
        prisma,
        client,
        env: externalEnv,
        logger,
      })
    ).rejects.toThrow('External chatbot knowledge graph dispatch failed')
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('sig=secret')
  })
})

describe('chatbot knowledge graph external monitor', () => {
  it('queries only active graph attempts with complete external metadata', async () => {
    const prisma = createMonitorPrisma([])

    await monitorActiveChatbotKnowledgeGraphIngestions({
      prisma,
      client: createClient(),
      env: {},
      now: () => NOW,
    })

    expect(prisma.chatbotKnowledgeGraph.findMany).toHaveBeenCalledWith({
      where: {
        status: { in: ['QUEUED', 'PROCESSING'] },
        activeAttemptId: { not: null },
        activeBuildRevision: { not: null },
        externalWorkflowRunId: { not: null },
        externalStartedAt: { not: null },
      },
      select: {
        id: true,
        chatbotId: true,
        selectionRevision: true,
        activeAttemptId: true,
        activeBuildRevision: true,
        externalWorkflowRunId: true,
        externalStartedAt: true,
      },
    })
  })

  it.each<{
    externalStatus: ExternalHatchetStatus
    expectedData?: Record<string, unknown>
  }>([
    { externalStatus: 'QUEUED' },
    {
      externalStatus: 'RUNNING',
      expectedData: { status: 'PROCESSING', statusMessage: null },
    },
    {
      externalStatus: 'COMPLETED',
      expectedData: {
        status: 'READY',
        statusMessage: null,
        builtRevision: 3,
        lastBuiltAt: NOW,
        ...clearedActiveGraph,
      },
    },
    {
      externalStatus: 'FAILED',
      expectedData: {
        status: 'FAILED',
        statusMessage: 'External ingestion workflow failed.',
        ...clearedActiveGraph,
      },
    },
    {
      externalStatus: 'CANCELLED',
      expectedData: {
        status: 'FAILED',
        statusMessage: 'External ingestion workflow was cancelled.',
        ...clearedActiveGraph,
      },
    },
  ])(
    'maps current $externalStatus to the guarded graph transition',
    async ({ externalStatus, expectedData }) => {
      const isTerminal =
        externalStatus === 'COMPLETED' ||
        externalStatus === 'FAILED' ||
        externalStatus === 'CANCELLED'
      const graph = createMonitorGraph(
        isTerminal
          ? { externalStartedAt: new Date('2026-07-20T10:00:00.000Z') }
          : {}
      )
      const prisma = createMonitorPrisma([graph])
      const client = createClient()
      client.runs.get_status.mockResolvedValue(externalStatus)

      await monitorActiveChatbotKnowledgeGraphIngestions({
        prisma,
        client,
        env: {},
        now: () => NOW,
      })

      if (!expectedData) {
        expect(prisma.chatbotKnowledgeGraph.updateMany).not.toHaveBeenCalled()
        return
      }
      if (isTerminal) expect(client.runs.cancel).not.toHaveBeenCalled()
      expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
        where: {
          ...activeGraphGuard(graph),
          ...(externalStatus === 'RUNNING'
            ? {}
            : { selectionRevision: graph.activeBuildRevision }),
        },
        data: expectedData,
      })
    }
  )

  it.each<{
    externalStatus: 'COMPLETED' | 'FAILED' | 'CANCELLED'
  }>([
    { externalStatus: 'COMPLETED' },
    { externalStatus: 'FAILED' },
    { externalStatus: 'CANCELLED' },
  ])(
    'marks a stale $externalStatus attempt DIRTY without publishing it',
    async ({ externalStatus }) => {
      const graph = createMonitorGraph({ selectionRevision: 4 })
      const prisma = createMonitorPrisma([graph])
      const client = createClient()
      client.runs.get_status.mockResolvedValue(externalStatus)

      await monitorActiveChatbotKnowledgeGraphIngestions({
        prisma,
        client,
        env: {},
        now: () => NOW,
      })

      expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
        where: {
          ...activeGraphGuard(graph),
          selectionRevision: { not: graph.activeBuildRevision },
        },
        data: {
          status: 'DIRTY',
          statusMessage: null,
          ...clearedActiveGraph,
        },
      })
      const serializedUpdates = JSON.stringify(
        prisma.chatbotKnowledgeGraph.updateMany.mock.calls
      )
      expect(serializedUpdates).not.toContain('builtRevision')
      expect(serializedUpdates).not.toContain('lastBuiltAt')
      expect(serializedUpdates).not.toContain('READY')
      expect(serializedUpdates).not.toContain('FAILED')
    }
  )

  it.each([
    { selectionRevision: 3, expectedStatus: 'FAILED' },
    { selectionRevision: 4, expectedStatus: 'DIRTY' },
  ])(
    'times out and clears a revision-$selectionRevision attempt as $expectedStatus',
    async ({ selectionRevision, expectedStatus }) => {
      const graph = createMonitorGraph({
        selectionRevision,
        externalStartedAt: new Date('2026-07-20T10:59:59.000Z'),
      })
      const prisma = createMonitorPrisma([graph])
      const client = createClient()
      client.runs.get_status.mockResolvedValue('RUNNING')
      client.runs.cancel.mockRejectedValue(new Error('secret external error'))
      const logger = { error: vi.fn() } satisfies KBIngestionLogger

      await monitorActiveChatbotKnowledgeGraphIngestions({
        prisma,
        client,
        env: {},
        now: () => NOW,
        logger,
      })

      expect(client.runs.cancel).toHaveBeenCalledWith({
        ids: ['external-run-id'],
      })
      expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
        where: {
          ...activeGraphGuard(graph),
          selectionRevision:
            selectionRevision === 3
              ? graph.activeBuildRevision
              : { not: graph.activeBuildRevision },
        },
        data: {
          status: expectedStatus,
          statusMessage:
            expectedStatus === 'FAILED'
              ? 'External ingestion timed out.'
              : null,
          ...clearedActiveGraph,
        },
      })
      expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret')
    }
  )

  it('isolates status lookup failures and continues with later graphs', async () => {
    const first = createMonitorGraph({
      id: '4cf9d88e-75b1-4d7b-abfe-d5f57ae9276f',
      externalWorkflowRunId: 'run-status-fails',
    })
    const second = createMonitorGraph({
      id: 'a7a874a8-f919-4fb9-88ea-f1a40ca6f479',
      externalWorkflowRunId: 'run-succeeds',
    })
    const prisma = createMonitorPrisma([first, second])
    const client = createClient()
    client.runs.get_status.mockImplementation(async (runId) => {
      if (runId === 'run-status-fails') throw new Error('secret status lookup')
      return 'COMPLETED'
    })
    const logger = { error: vi.fn() } satisfies KBIngestionLogger

    await monitorActiveChatbotKnowledgeGraphIngestions({
      prisma,
      client,
      env: {},
      now: () => NOW,
      logger,
    })

    expect(client.runs.get_status.mock.calls.map(([runId]) => runId)).toEqual([
      'run-status-fails',
      'run-succeeds',
    ])
    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledTimes(1)
    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
      where: {
        ...activeGraphGuard(second),
        selectionRevision: second.activeBuildRevision,
      },
      data: {
        status: 'READY',
        statusMessage: null,
        builtRevision: second.activeBuildRevision,
        lastBuiltAt: NOW,
        ...clearedActiveGraph,
      },
    })
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret')
  })

  it('isolates guarded transition failures and continues with later graphs', async () => {
    const first = createMonitorGraph({
      id: '4cf9d88e-75b1-4d7b-abfe-d5f57ae9276f',
      externalWorkflowRunId: 'run-update-fails',
    })
    const second = createMonitorGraph({
      id: 'a7a874a8-f919-4fb9-88ea-f1a40ca6f479',
      externalWorkflowRunId: 'run-update-succeeds',
    })
    const prisma = createMonitorPrisma([first, second])
    prisma.chatbotKnowledgeGraph.updateMany
      .mockRejectedValueOnce(new Error('secret database response'))
      .mockResolvedValueOnce({ count: 1 })
    const client = createClient()
    client.runs.get_status.mockResolvedValue('COMPLETED')
    const logger = { error: vi.fn() } satisfies KBIngestionLogger

    await monitorActiveChatbotKnowledgeGraphIngestions({
      prisma,
      client,
      env: {},
      now: () => NOW,
      logger,
    })

    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledTimes(2)
    expect(
      prisma.chatbotKnowledgeGraph.updateMany.mock.calls[1]![0]
    ).toMatchObject({ where: { id: second.id }, data: { status: 'READY' } })
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain('secret')
  })
})

describe('chatbot knowledge graph build failure guard', () => {
  it('marks the current revision FAILED and clears active metadata', async () => {
    const prisma = createPrisma()

    await markChatbotKnowledgeGraphBuildFailed(graphInput, prisma)

    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledTimes(1)
    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenCalledWith({
      where: {
        id: GRAPH_ID,
        chatbotId: CHATBOT_ID,
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        selectionRevision: 3,
      },
      data: {
        status: 'FAILED',
        statusMessage: 'The external ingestion workflow could not be started.',
        activeAttemptId: null,
        activeBuildRevision: null,
        externalWorkflowRunId: null,
        externalStartedAt: null,
      },
    })
  })

  it('marks a changed revision DIRTY without overwriting it as FAILED', async () => {
    const prisma = createPrisma()
    prisma.chatbotKnowledgeGraph.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 })

    await markChatbotKnowledgeGraphBuildFailed(graphInput, prisma)

    expect(prisma.chatbotKnowledgeGraph.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        id: GRAPH_ID,
        chatbotId: CHATBOT_ID,
        activeAttemptId: ATTEMPT_ID,
        activeBuildRevision: 3,
        selectionRevision: { not: 3 },
      },
      data: {
        status: 'DIRTY',
        statusMessage: null,
        activeAttemptId: null,
        activeBuildRevision: null,
        externalWorkflowRunId: null,
        externalStartedAt: null,
      },
    })
  })
})

describe('chatbot knowledge graph Hatchet declaration', () => {
  it('registers three retries, dispatches externally, and conditionally handles failure', async () => {
    vi.resetModules()
    const mockedPrisma = { chatbotKnowledgeGraph: {} }
    const dispatchChatbotKnowledgeGraphIngestion = vi
      .fn()
      .mockResolvedValue('external-run-id')
    const markChatbotKnowledgeGraphBuildFailed = vi
      .fn()
      .mockResolvedValue(undefined)

    vi.doMock('../src/client.js', () => ({ hatchetClient: {} }))
    vi.doMock('@klicker-uzh/prisma', () => ({ prisma: mockedPrisma }))
    vi.doMock('../src/kbGraphIngestion.js', async () => {
      const actual = await vi.importActual('../src/kbGraphIngestion.js')
      return {
        ...actual,
        dispatchChatbotKnowledgeGraphIngestion,
        markChatbotKnowledgeGraphBuildFailed,
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
    const definition = declarations.get('build-chatbot-knowledge-graph')
    const logger = { info: vi.fn(), error: vi.fn() }

    expect(definition).toMatchObject({
      name: 'build-chatbot-knowledge-graph',
      retries: 3,
      onFailure: { retries: 3 },
    })
    await definition.fn(graphInput, { logger })
    expect(dispatchChatbotKnowledgeGraphIngestion).toHaveBeenCalledWith(
      graphInput,
      { prisma: mockedPrisma, logger }
    )
    await definition.onFailure.fn(graphInput)
    expect(markChatbotKnowledgeGraphBuildFailed).toHaveBeenCalledWith(
      graphInput,
      mockedPrisma
    )
    expect(prepared).toHaveProperty('buildChatbotKnowledgeGraph')
    expect(prepared).toHaveProperty('ingestKBResource')
  })
})

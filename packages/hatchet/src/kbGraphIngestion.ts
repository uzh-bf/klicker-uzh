import {
  ChatbotKnowledgeGraphStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import type { BuildChatbotKnowledgeGraphInput } from '@klicker-uzh/types'
import {
  cancelExternalKBIngestionRunBestEffort,
  getExternalHatchetClient,
  getExternalHatchetConfig,
  getKBIngestionSourceUrl,
  getKBIngestionTimeoutSeconds,
  recoverExternalKBIngestionRun,
  type ExternalHatchetClient,
  type ExternalKBIngestionPayload,
  type KBIngestionLogger,
} from './kbIngestion.js'

export const KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY =
  'klickerKBGraphIngestionAttemptId'
export const KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY =
  'klickerKBGraphIngestionChatbotId'

type ChatbotKnowledgeGraphPrisma = Pick<PrismaClient, 'chatbotKnowledgeGraph'>

export type DispatchChatbotKnowledgeGraphDependencies = {
  prisma: ChatbotKnowledgeGraphPrisma
  client?: ExternalHatchetClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
}

export type MonitorChatbotKnowledgeGraphIngestionsDependencies = {
  prisma: ChatbotKnowledgeGraphPrisma
  client?: ExternalHatchetClient
  env?: NodeJS.ProcessEnv
  now?: () => Date
  logger?: KBIngestionLogger
}

function graphIdentifiers(input: BuildChatbotKnowledgeGraphInput) {
  return {
    graphId: input.graphId,
    chatbotId: input.chatbotId,
    attemptId: input.attemptId,
  }
}

async function logInfoBestEffort(
  logger: KBIngestionLogger | undefined,
  message: string,
  identifiers: Record<string, string>
) {
  try {
    await logger?.info?.(message, identifiers)
  } catch {
    // A persisted external run must not fail because logging is unavailable.
  }
}

async function logErrorBestEffort(
  logger: KBIngestionLogger | undefined,
  message: string,
  identifiers: Record<string, string>
) {
  try {
    await logger?.error?.(message, identifiers)
  } catch {
    // Error handling must continue when logging is unavailable.
  }
}

export function buildExternalChatbotKnowledgeGraphPayload(
  input: BuildChatbotKnowledgeGraphInput,
  sourceUrls: string[]
): ExternalKBIngestionPayload {
  if (sourceUrls.length !== input.resources.length) {
    throw new Error('Knowledge graph source URL count does not match')
  }

  return {
    course_id: input.chatbotId,
    sources: input.resources.map((resource, index) => ({
      source_id: resource.resourceId,
      source_url: sourceUrls[index]!,
    })),
    upload_markdown: true,
    export_to_falkordb: true,
    falkordb_graph_name: `klickeruzh:${input.chatbotId}`,
    speed_mode: input.speedMode,
  }
}

export async function monitorActiveChatbotKnowledgeGraphIngestions(
  dependencies: MonitorChatbotKnowledgeGraphIngestionsDependencies
): Promise<void> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const timeoutMilliseconds = getKBIngestionTimeoutSeconds(env) * 1000
  const graphs = await dependencies.prisma.chatbotKnowledgeGraph.findMany({
    where: {
      status: {
        in: [
          ChatbotKnowledgeGraphStatus.QUEUED,
          ChatbotKnowledgeGraphStatus.PROCESSING,
        ],
      },
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
  if (graphs.length === 0) return

  const client = dependencies.client ?? getExternalHatchetClient(env)
  for (const graph of graphs) {
    const {
      activeAttemptId,
      activeBuildRevision,
      externalWorkflowRunId,
      externalStartedAt,
    } = graph
    if (
      !activeAttemptId ||
      activeBuildRevision === null ||
      !externalWorkflowRunId ||
      !externalStartedAt
    ) {
      continue
    }

    const identifiers = {
      graphId: graph.id,
      chatbotId: graph.chatbotId,
      attemptId: activeAttemptId,
    }
    const activeAttempt = {
      id: graph.id,
      chatbotId: graph.chatbotId,
      activeAttemptId,
      activeBuildRevision,
      externalWorkflowRunId,
      status: {
        in: [
          ChatbotKnowledgeGraphStatus.QUEUED,
          ChatbotKnowledgeGraphStatus.PROCESSING,
        ],
      },
    }
    const clearActiveAttempt = {
      activeAttemptId: null,
      activeBuildRevision: null,
      externalWorkflowRunId: null,
      externalStartedAt: null,
    }
    const finishAttempt = async (currentRevisionData: {
      status:
        | typeof ChatbotKnowledgeGraphStatus.READY
        | typeof ChatbotKnowledgeGraphStatus.FAILED
      statusMessage: string | null
      builtRevision?: number
      lastBuiltAt?: Date
    }) => {
      const publishable = activeBuildRevision === graph.selectionRevision
      await dependencies.prisma.chatbotKnowledgeGraph.updateMany({
        where: {
          ...activeAttempt,
          selectionRevision: publishable
            ? activeBuildRevision
            : { not: activeBuildRevision },
        },
        data: publishable
          ? { ...currentRevisionData, ...clearActiveAttempt }
          : {
              status: ChatbotKnowledgeGraphStatus.DIRTY,
              statusMessage: null,
              ...clearActiveAttempt,
            },
      })
    }

    try {
      const externalStatus = await client.runs.get_status(externalWorkflowRunId)
      const observedAt = now()

      if (externalStatus === 'COMPLETED') {
        await finishAttempt({
          status: ChatbotKnowledgeGraphStatus.READY,
          statusMessage: null,
          builtRevision: activeBuildRevision,
          lastBuiltAt: observedAt,
        })
        continue
      }
      if (externalStatus === 'FAILED') {
        await finishAttempt({
          status: ChatbotKnowledgeGraphStatus.FAILED,
          statusMessage: 'External ingestion workflow failed.',
        })
        continue
      }
      if (externalStatus === 'CANCELLED') {
        await finishAttempt({
          status: ChatbotKnowledgeGraphStatus.FAILED,
          statusMessage: 'External ingestion workflow was cancelled.',
        })
        continue
      }

      const elapsedMilliseconds =
        observedAt.getTime() - externalStartedAt.getTime()
      if (elapsedMilliseconds > timeoutMilliseconds) {
        await cancelExternalKBIngestionRunBestEffort({
          client,
          runId: externalWorkflowRunId,
          identifiers,
          logger: dependencies.logger,
        })
        await finishAttempt({
          status: ChatbotKnowledgeGraphStatus.FAILED,
          statusMessage: 'External ingestion timed out.',
        })
        continue
      }

      if (externalStatus === 'RUNNING') {
        await dependencies.prisma.chatbotKnowledgeGraph.updateMany({
          where: activeAttempt,
          data: {
            status: ChatbotKnowledgeGraphStatus.PROCESSING,
            statusMessage: null,
          },
        })
      }
    } catch {
      await logErrorBestEffort(
        dependencies.logger,
        'External chatbot knowledge graph monitor failed',
        identifiers
      )
    }
  }
}

export async function dispatchChatbotKnowledgeGraphIngestion(
  input: BuildChatbotKnowledgeGraphInput,
  dependencies: DispatchChatbotKnowledgeGraphDependencies
): Promise<string | undefined> {
  const env = dependencies.env ?? process.env
  const now = dependencies.now ?? (() => new Date())
  const identifiers = graphIdentifiers(input)

  try {
    const graph = await dependencies.prisma.chatbotKnowledgeGraph.findUnique({
      where: { id: input.graphId },
      select: {
        chatbotId: true,
        status: true,
        createdAt: true,
        activeAttemptId: true,
        activeBuildRevision: true,
        externalWorkflowRunId: true,
      },
    })
    if (
      !graph ||
      graph.chatbotId !== input.chatbotId ||
      graph.activeAttemptId !== input.attemptId ||
      graph.activeBuildRevision !== input.selectionRevision ||
      (graph.status !== ChatbotKnowledgeGraphStatus.QUEUED &&
        graph.status !== ChatbotKnowledgeGraphStatus.PROCESSING)
    ) {
      return undefined
    }
    if (graph.externalWorkflowRunId) {
      return graph.externalWorkflowRunId
    }

    const config = getExternalHatchetConfig(env)
    const client = dependencies.client ?? getExternalHatchetClient(env)
    const additionalMetadata = {
      [KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY]: input.attemptId,
      [KB_GRAPH_INGESTION_CHATBOT_METADATA_KEY]: input.chatbotId,
    }
    const recoveredRun = await recoverExternalKBIngestionRun({
      client,
      workflowName: config.workflowName,
      additionalMetadata,
      primaryMetadataKey: KB_GRAPH_INGESTION_ATTEMPT_METADATA_KEY,
      recoveryAnchor: graph.createdAt,
    })

    let runId: string
    let startedAt: Date
    if (recoveredRun) {
      runId = recoveredRun.runId
      startedAt = recoveredRun.startedAt
    } else {
      const sourceUrls = input.resources.map((resource) =>
        getKBIngestionSourceUrl(resource, { env, now })
      )
      const payload = buildExternalChatbotKnowledgeGraphPayload(
        input,
        sourceUrls
      )
      startedAt = now()
      const run = await client.runNoWait(config.workflowName, payload, {
        additionalMetadata,
      })
      runId = await run.getWorkflowRunId()
    }

    const persisted =
      await dependencies.prisma.chatbotKnowledgeGraph.updateMany({
        where: {
          id: input.graphId,
          chatbotId: input.chatbotId,
          activeAttemptId: input.attemptId,
          activeBuildRevision: input.selectionRevision,
          status: {
            in: [
              ChatbotKnowledgeGraphStatus.QUEUED,
              ChatbotKnowledgeGraphStatus.PROCESSING,
            ],
          },
          externalWorkflowRunId: null,
        },
        data: {
          externalWorkflowRunId: runId,
          externalStartedAt: startedAt,
        },
      })
    if (persisted.count !== 1) {
      const currentGraph =
        await dependencies.prisma.chatbotKnowledgeGraph.findUnique({
          where: { id: input.graphId },
          select: {
            activeAttemptId: true,
            activeBuildRevision: true,
            externalWorkflowRunId: true,
          },
        })
      if (
        currentGraph?.activeAttemptId === input.attemptId &&
        currentGraph.activeBuildRevision === input.selectionRevision &&
        currentGraph.externalWorkflowRunId === runId
      ) {
        return runId
      }

      await cancelExternalKBIngestionRunBestEffort({
        client,
        runId,
        identifiers,
        logger: dependencies.logger,
      })
      return undefined
    }

    await logInfoBestEffort(
      dependencies.logger,
      'External chatbot knowledge graph ingestion dispatched',
      identifiers
    )
    return runId
  } catch {
    await logErrorBestEffort(
      dependencies.logger,
      'External chatbot knowledge graph ingestion dispatch failed',
      identifiers
    )
    throw new Error('External chatbot knowledge graph dispatch failed')
  }
}

export async function markChatbotKnowledgeGraphBuildFailed(
  input: BuildChatbotKnowledgeGraphInput,
  prisma: ChatbotKnowledgeGraphPrisma
): Promise<void> {
  const activeAttempt = {
    id: input.graphId,
    chatbotId: input.chatbotId,
    activeAttemptId: input.attemptId,
    activeBuildRevision: input.selectionRevision,
  }
  const clearActiveAttempt = {
    activeAttemptId: null,
    activeBuildRevision: null,
    externalWorkflowRunId: null,
    externalStartedAt: null,
  }

  const failed = await prisma.chatbotKnowledgeGraph.updateMany({
    where: {
      ...activeAttempt,
      selectionRevision: input.selectionRevision,
    },
    data: {
      status: ChatbotKnowledgeGraphStatus.FAILED,
      statusMessage: 'The external ingestion workflow could not be started.',
      ...clearActiveAttempt,
    },
  })
  if (failed.count === 1) return

  await prisma.chatbotKnowledgeGraph.updateMany({
    where: {
      ...activeAttempt,
      selectionRevision: { not: input.selectionRevision },
    },
    data: {
      status: ChatbotKnowledgeGraphStatus.DIRTY,
      statusMessage: null,
      ...clearActiveAttempt,
    },
  })
}

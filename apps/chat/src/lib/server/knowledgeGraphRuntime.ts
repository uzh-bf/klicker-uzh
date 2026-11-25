import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type {
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { createRequire } from 'node:module'
import { resolveEffectiveChatModeOptions } from './effectiveChatModes'
import {
  type GraphKnowledgeBaseChoice,
  resolveGraphKnowledgeBaseChoices,
  ownedKnowledgeBaseLinks,
} from '../../services/mcpScope'

export type PublishedKnowledgeGraph = {
  kbId: string
  buildId: string
  graphName: string
  isStale: boolean
  sources: { resourceId: string; title: string }[]
}

type KnowledgeGraphPublicationCode =
  | 'EMPTY'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FAILED'

type KnowledgeGraphModule = {
  KnowledgeGraphNotPublishedError: new (
    code: KnowledgeGraphPublicationCode
  ) => Error & { readonly code: KnowledgeGraphPublicationCode }
  getPublishedKnowledgeGraph: (
    client: PrismaClient,
    kbId: string
  ) => Promise<PublishedKnowledgeGraph>
  readKnowledgeGraphOverview: (
    context: PublishedKnowledgeGraph
  ) => Promise<KnowledgeGraphResponse>
  searchKnowledgeGraph: (
    context: PublishedKnowledgeGraph,
    query: string
  ) => Promise<KnowledgeGraphResponse>
  readKnowledgeGraphNeighbors: (
    context: PublishedKnowledgeGraph,
    nodeId: string
  ) => Promise<KnowledgeGraphResponse>
  readKnowledgeGraphSearchHints: (
    context: PublishedKnowledgeGraph,
    query: string
  ) => Promise<string[]>
  readKnowledgeGraphMentions: (
    context: PublishedKnowledgeGraph,
    text: string
  ) => Promise<KnowledgeGraphMention[]>
}

export type KnowledgeGraphMention = { node: KnowledgeGraphNode; text: string }

const nodeRequire = createRequire(import.meta.url)
let knowledgeGraph: KnowledgeGraphModule | undefined
let knowledgeGraphPromise: Promise<KnowledgeGraphModule> | undefined

function loadKnowledgeGraph(): Promise<KnowledgeGraphModule> {
  knowledgeGraphPromise ??= (async () => {
    // Turbopack cannot evaluate FalkorDB's CommonJS Temporal/JSBI dependency
    // chain. Use Node in development and let the production bundler resolve it.
    const loaded =
      process.env.NODE_ENV === 'development'
        ? (nodeRequire('@klicker-uzh/knowledge-graph') as KnowledgeGraphModule)
        : ((await import(
            '@klicker-uzh/knowledge-graph'
          )) as KnowledgeGraphModule)

    knowledgeGraph = loaded
    return loaded
  })()

  return knowledgeGraphPromise
}

export async function getPublishedKnowledgeGraph(
  client: PrismaClient,
  kbId: string
): Promise<PublishedKnowledgeGraph> {
  return (await loadKnowledgeGraph()).getPublishedKnowledgeGraph(client, kbId)
}

export async function getPublishedKnowledgeGraphForChatbot(
  client: PrismaClient,
  chatbotId: string,
  kbId?: string
): Promise<PublishedKnowledgeGraph> {
  const choices = await readChatbotKnowledgeGraphChoices(client, chatbotId)
  const knowledgeGraphModule = await loadKnowledgeGraph()
  if (choices.length === 0) {
    throw new knowledgeGraphModule.KnowledgeGraphNotPublishedError('EMPTY')
  }

  const selected =
    kbId === undefined
      ? choices.length === 1
        ? choices[0]
        : undefined
      : choices.find((choice) => choice.id === kbId)
  if (!selected) {
    throw new KnowledgeGraphSelectionRequiredError(choices)
  }

  return knowledgeGraphModule.getPublishedKnowledgeGraph(client, selected.id)
}

/**
 * Sources the learner may browse in the graph surface. A source qualifies only
 * when an approved, learner-visible mode resolves it as its one live Doc Query
 * source and that knowledge base has a published graph enabled. Merely
 * attaching a KB, or selecting it only in a draft, never makes it browsable.
 */
export async function readChatbotKnowledgeGraphChoices(
  client: PrismaClient,
  chatbotId: string
): Promise<GraphKnowledgeBaseChoice[]> {
  const chatbot = await client.chatbot.findUnique({
    where: { id: chatbotId },
    select: {
      customModeConfig: true,
      ownerId: true,
      standardModeConfig: true,
      systemPrompts: true,
      knowledgeBases: {
        select: {
          id: true,
          kbId: true,
          isEnabled: true,
          isDefault: true,
          kb: {
            select: {
              deletedAt: true,
              ownerId: true,
              knowledgeGraphEnabled: true,
              name: true,
            },
          },
        },
        orderBy: { id: 'asc' },
      },
      mcpConfigurations: {
        select: {
          allowedTools: true,
          chatMode: true,
          isEnabled: true,
          parameters: true,
          priority: true,
          mcpServer: { select: { id: true, name: true } },
        },
        orderBy: { priority: 'asc' },
      },
    },
  })
  if (!chatbot) return []

  const modeOptions = resolveEffectiveChatModeOptions(
    chatbot.systemPrompts,
    chatbot.mcpConfigurations,
    chatbot.standardModeConfig,
    { customModeConfig: chatbot.customModeConfig }
  )

  return resolveGraphKnowledgeBaseChoices({
    modes: Object.keys(modeOptions),
    customModeConfig: chatbot.customModeConfig,
    knowledgeBaseLinks: ownedKnowledgeBaseLinks(
      chatbot.knowledgeBases,
      chatbot.ownerId
    ),
    mcpConfigurations: chatbot.mcpConfigurations,
  })
}

export class KnowledgeGraphSelectionRequiredError extends Error {
  constructor(readonly choices: { id: string; name: string }[]) {
    super('Select an attached knowledge graph')
    this.name = 'KnowledgeGraphSelectionRequiredError'
  }
}

export async function readKnowledgeGraphOverview(
  context: PublishedKnowledgeGraph
): Promise<KnowledgeGraphResponse> {
  return (await loadKnowledgeGraph()).readKnowledgeGraphOverview(context)
}

export async function searchKnowledgeGraph(
  context: PublishedKnowledgeGraph,
  query: string
): Promise<KnowledgeGraphResponse> {
  return (await loadKnowledgeGraph()).searchKnowledgeGraph(context, query)
}

export async function readKnowledgeGraphNeighbors(
  context: PublishedKnowledgeGraph,
  nodeId: string
): Promise<KnowledgeGraphResponse> {
  return (await loadKnowledgeGraph()).readKnowledgeGraphNeighbors(
    context,
    nodeId
  )
}

export async function readKnowledgeGraphSearchHints(
  context: PublishedKnowledgeGraph,
  query: string
): Promise<string[]> {
  return (await loadKnowledgeGraph()).readKnowledgeGraphSearchHints(
    context,
    query
  )
}

export async function readKnowledgeGraphMentions(
  context: PublishedKnowledgeGraph,
  text: string
): Promise<KnowledgeGraphMention[]> {
  return (await loadKnowledgeGraph()).readKnowledgeGraphMentions(context, text)
}

export function isKnowledgeGraphNotPublishedError(
  error: unknown
): error is Error & { readonly code: KnowledgeGraphPublicationCode } {
  return (
    knowledgeGraph !== undefined &&
    error instanceof knowledgeGraph.KnowledgeGraphNotPublishedError
  )
}

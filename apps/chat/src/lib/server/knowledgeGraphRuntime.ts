import type { PrismaClient } from '@klicker-uzh/prisma/client'
import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
import { createRequire } from 'node:module'

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
}

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
  const bindings = await client.kBChatbot.findMany({
    where: {
      chatbotId,
      isEnabled: true,
      kb: { deletedAt: null, knowledgeGraphEnabled: true },
    },
    select: { kbId: true, kb: { select: { name: true } } },
    orderBy: { kbId: 'asc' },
  })

  const choices = bindings.map((binding) => ({
    id: binding.kbId,
    name: binding.kb.name,
  }))
  if (
    (kbId !== undefined &&
      !bindings.some((binding) => binding.kbId === kbId)) ||
    (kbId === undefined && bindings.length > 1)
  ) {
    throw new KnowledgeGraphSelectionRequiredError(choices)
  }

  const knowledgeGraphModule = await loadKnowledgeGraph()
  const selectedKbId = kbId ?? bindings[0]?.kbId
  if (selectedKbId === undefined) {
    throw new knowledgeGraphModule.KnowledgeGraphNotPublishedError('EMPTY')
  }

  return knowledgeGraphModule.getPublishedKnowledgeGraph(client, selectedKbId)
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

export function isKnowledgeGraphNotPublishedError(
  error: unknown
): error is Error & { readonly code: KnowledgeGraphPublicationCode } {
  return (
    knowledgeGraph !== undefined &&
    error instanceof knowledgeGraph.KnowledgeGraphNotPublishedError
  )
}

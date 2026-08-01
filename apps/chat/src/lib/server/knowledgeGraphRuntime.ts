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
}

const nodeRequire = createRequire(import.meta.url)
const knowledgeGraphPackage = ['@klicker-uzh', 'knowledge-graph'].join('/')
let knowledgeGraph: KnowledgeGraphModule | undefined
let knowledgeGraphPromise: Promise<KnowledgeGraphModule> | undefined

function loadKnowledgeGraph(): Promise<KnowledgeGraphModule> {
  knowledgeGraphPromise ??= (async () => {
    // Turbopack cannot evaluate FalkorDB's CommonJS Temporal/JSBI dependency
    // chain. Use Node in development and let the production bundler resolve it.
    const loaded =
      process.env.NODE_ENV === 'development'
        ? (nodeRequire(knowledgeGraphPackage) as KnowledgeGraphModule)
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
  chatbotId: string
): Promise<PublishedKnowledgeGraph> {
  const binding = await client.kBChatbot.findFirst({
    where: {
      chatbotId,
      isEnabled: true,
      kb: { deletedAt: null },
    },
    select: { kbId: true },
    orderBy: { updatedAt: 'desc' },
  })

  const knowledgeGraphModule = await loadKnowledgeGraph()
  if (binding === null) {
    throw new knowledgeGraphModule.KnowledgeGraphNotPublishedError('EMPTY')
  }

  return knowledgeGraphModule.getPublishedKnowledgeGraph(client, binding.kbId)
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

export function isKnowledgeGraphNotPublishedError(
  error: unknown
): error is Error & { readonly code: KnowledgeGraphPublicationCode } {
  return (
    knowledgeGraph !== undefined &&
    error instanceof knowledgeGraph.KnowledgeGraphNotPublishedError
  )
}

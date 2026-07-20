import type { PrismaClient } from '@klicker-uzh/prisma/client'

export type KnowledgeGraphSourceMetadata = {
  resourceId: string
  title: string
}

export type PublishedKnowledgeGraph = {
  chatbotId: string
  builtRevision: number
  graphName: string
  sources: KnowledgeGraphSourceMetadata[]
}

export type KnowledgeGraphPublicationCode =
  | 'EMPTY'
  | 'DIRTY'
  | 'QUEUED'
  | 'PROCESSING'
  | 'FAILED'

export class KnowledgeGraphNotPublishedError extends Error {
  readonly code: KnowledgeGraphPublicationCode

  constructor(code: KnowledgeGraphPublicationCode) {
    super('Knowledge graph is not published')
    this.name = 'KnowledgeGraphNotPublishedError'
    this.code = code
  }
}

export function getKnowledgeGraphName(chatbotId: string): string {
  return `klickeruzh:${chatbotId}`
}

function unpublishedCode(
  graph: {
    status: string
    selectionRevision: number
    builtRevision: number | null
    resources: unknown[]
  } | null
): KnowledgeGraphPublicationCode | null {
  if (
    graph === null ||
    graph.resources.length === 0 ||
    graph.status === 'EMPTY'
  ) {
    return 'EMPTY'
  }

  if (
    graph.status === 'READY' &&
    graph.builtRevision !== null &&
    graph.builtRevision === graph.selectionRevision
  ) {
    return null
  }

  if (graph.status === 'QUEUED' || graph.status === 'PROCESSING') {
    return graph.status
  }

  if (graph.status === 'FAILED') {
    return 'FAILED'
  }

  return 'DIRTY'
}

export async function getPublishedKnowledgeGraph(
  prisma: PrismaClient,
  chatbotId: string
): Promise<PublishedKnowledgeGraph> {
  const graph = await prisma.chatbotKnowledgeGraph.findUnique({
    where: { chatbotId },
    select: {
      status: true,
      selectionRevision: true,
      builtRevision: true,
      resources: {
        select: { id: true, title: true },
        orderBy: { id: 'asc' },
      },
    },
  })

  const code = unpublishedCode(graph)
  if (code !== null) {
    throw new KnowledgeGraphNotPublishedError(code)
  }

  // The publication predicate above proves this value is non-null.
  const builtRevision = graph?.builtRevision
  if (builtRevision === null || builtRevision === undefined || graph === null) {
    throw new KnowledgeGraphNotPublishedError('DIRTY')
  }

  return {
    chatbotId,
    builtRevision,
    graphName: getKnowledgeGraphName(chatbotId),
    sources: graph.resources.map((resource) => ({
      resourceId: resource.id,
      title: resource.title,
    })),
  }
}

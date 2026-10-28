import { prisma } from '@klicker-uzh/prisma'
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'
import {
  getPublishedKnowledgeGraphForChatbot,
  readKnowledgeGraphMentions,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from './knowledgeGraphRuntime'

export {
  isKnowledgeGraphNotPublishedError,
  KnowledgeGraphSelectionRequiredError,
} from './knowledgeGraphRuntime'

export type ChatbotKnowledgeGraphReadRequest = { kbId?: string } & (
  | { operation: 'overview' }
  | { operation: 'mentions'; text: string }
  | { operation: 'search'; query: string }
  | { operation: 'neighbors'; nodeId: string; kbId: string; buildId: string }
)

/** A concept named verbatim in an answer, located by its text there. */
export type ChatbotKnowledgeGraphMention = { nodeId: string; text: string }

export type ChatbotKnowledgeGraphReadResponse = KnowledgeGraphResponse & {
  mentions?: ChatbotKnowledgeGraphMention[]
}

export class KnowledgeGraphBuildChangedError extends Error {
  constructor() {
    super('Knowledge graph build changed')
    this.name = 'KnowledgeGraphBuildChangedError'
  }
}

function browserSafeSourceReference(
  source: KnowledgeGraphSourceReference
): KnowledgeGraphSourceReference {
  return {
    resourceId: source.resourceId,
    title: source.title,
    ...(source.reference === undefined ? {} : { reference: source.reference }),
    ...(source.pages === undefined ? {} : { pages: source.pages }),
  }
}

function browserSafeNode(node: KnowledgeGraphNode): KnowledgeGraphNode {
  return {
    id: node.id,
    labels: node.labels,
    kind: node.kind,
    displayLabel: node.displayLabel,
    ...(node.summary === undefined ? {} : { summary: node.summary }),
    ...(node.content === undefined ? {} : { content: node.content }),
    degree: node.degree,
    sourceReferences: node.sourceReferences.map(browserSafeSourceReference),
  }
}

function browserSafeEdge(edge: KnowledgeGraphEdge): KnowledgeGraphEdge {
  return {
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: edge.type,
    label: edge.label,
    relationType: edge.relationType,
    relationStatus: edge.relationStatus,
    sourceReferences: edge.sourceReferences.map(browserSafeSourceReference),
    properties: edge.properties,
  }
}

function browserSafeResponse(
  response: KnowledgeGraphResponse
): KnowledgeGraphResponse {
  return {
    kbId: response.kbId,
    buildId: response.buildId,
    isStale: response.isStale,
    nodes: response.nodes.map(browserSafeNode),
    edges: response.edges.map(browserSafeEdge),
    truncated: response.truncated,
  }
}

export async function readPublishedChatbotKnowledgeGraph(
  chatbotId: string,
  request: ChatbotKnowledgeGraphReadRequest
): Promise<ChatbotKnowledgeGraphReadResponse> {
  const publication = await getPublishedKnowledgeGraphForChatbot(
    prisma,
    chatbotId,
    request.kbId
  )

  if (publication.isStale) throw new KnowledgeGraphBuildChangedError()

  if (
    request.operation === 'neighbors' &&
    (publication.kbId !== request.kbId ||
      publication.buildId !== request.buildId)
  ) {
    throw new KnowledgeGraphBuildChangedError()
  }

  let mentions: ChatbotKnowledgeGraphMention[] | undefined
  let response: KnowledgeGraphResponse
  if (request.operation === 'mentions') {
    const found = await readKnowledgeGraphMentions(publication, request.text)
    mentions = found.map(({ node, text }) => ({ nodeId: node.id, text }))
    response = {
      kbId: publication.kbId,
      buildId: publication.buildId,
      isStale: publication.isStale,
      nodes: found.map(({ node }) => node),
      edges: [],
      truncated: false,
    }
  } else {
    response =
      request.operation === 'overview'
        ? await readKnowledgeGraphOverview(publication)
        : request.operation === 'search'
          ? await searchKnowledgeGraph(publication, request.query)
          : await readKnowledgeGraphNeighbors(publication, request.nodeId)
  }

  const current = await getPublishedKnowledgeGraphForChatbot(
    prisma,
    chatbotId,
    publication.kbId
  )
  if (current.isStale || current.buildId !== publication.buildId) {
    throw new KnowledgeGraphBuildChangedError()
  }
  const safe = browserSafeResponse(response)
  return mentions === undefined ? safe : { ...safe, mentions }
}

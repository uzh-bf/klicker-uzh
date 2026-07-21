import { prisma } from '@klicker-uzh/prisma'
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
  KnowledgeGraphSourceReference,
} from '@klicker-uzh/types'
import {
  getPublishedKnowledgeGraph,
  readKnowledgeGraphNeighbors,
  readKnowledgeGraphOverview,
  searchKnowledgeGraph,
} from './knowledgeGraphRuntime'

export { isKnowledgeGraphNotPublishedError } from './knowledgeGraphRuntime'

export type ChatbotKnowledgeGraphReadRequest =
  | { operation: 'overview' }
  | { operation: 'search'; query: string }
  | { operation: 'neighbors'; nodeId: string }

function browserSafeSourceReference(
  source: KnowledgeGraphSourceReference
): KnowledgeGraphSourceReference {
  return {
    resourceId: source.resourceId,
    title: source.title,
    ...(source.reference === undefined ? {} : { reference: source.reference }),
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
    properties: edge.properties,
  }
}

function browserSafeResponse(
  response: KnowledgeGraphResponse
): KnowledgeGraphResponse {
  return {
    chatbotId: response.chatbotId,
    builtRevision: response.builtRevision,
    nodes: response.nodes.map(browserSafeNode),
    edges: response.edges.map(browserSafeEdge),
    truncated: response.truncated,
  }
}

export async function readPublishedChatbotKnowledgeGraph(
  chatbotId: string,
  request: ChatbotKnowledgeGraphReadRequest
): Promise<KnowledgeGraphResponse> {
  const publication = await getPublishedKnowledgeGraph(prisma, chatbotId)

  const response =
    request.operation === 'overview'
      ? await readKnowledgeGraphOverview(publication)
      : request.operation === 'search'
        ? await searchKnowledgeGraph(publication, request.query)
        : await readKnowledgeGraphNeighbors(publication, request.nodeId)

  return browserSafeResponse(response)
}

import {
  KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT,
  KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT,
} from './config.js'

export type KnowledgeGraphNodeRow = {
  id: unknown
  labels: unknown
  properties: unknown
  degree: unknown
}

export type KnowledgeGraphEdgeRow = {
  id: unknown
  source: unknown
  target: unknown
  type: unknown
  properties: unknown
}

type FixedQuery = {
  cypher: string
  params: Record<string, string | string[]>
}

export class KnowledgeGraphInputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'KnowledgeGraphInputError'
  }
}

function validateNodeId(nodeId: string): void {
  if (!/^\d{1,20}$/.test(nodeId)) {
    throw new KnowledgeGraphInputError('Node ID must be a decimal integer')
  }
}

export function getOverviewNodesQuery(): FixedQuery {
  return {
    cypher: `
      MATCH (n)
      WITH n LIMIT ${KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT + 1}
      RETURN id(n) AS id, labels(n) AS labels, properties(n) AS properties,
        indegree(n) + outdegree(n) AS degree
    `,
    params: {},
  }
}

export function getSearchNodesQuery(searchText: string): FixedQuery {
  const normalizedSearchText = searchText.trim()
  if (normalizedSearchText.length === 0 || normalizedSearchText.length > 100) {
    throw new KnowledgeGraphInputError(
      'Search text must contain between 1 and 100 characters'
    )
  }

  return {
    cypher: `
      MATCH (n)
      WHERE any(candidate IN [n.name, n.title, n.entity]
        WHERE candidate IS NOT NULL
          AND toLower(toString(candidate)) CONTAINS toLower($searchText))
      WITH n LIMIT ${KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT + 1}
      RETURN id(n) AS id, labels(n) AS labels, properties(n) AS properties,
        indegree(n) + outdegree(n) AS degree
    `,
    params: { searchText: normalizedSearchText },
  }
}

export function getNeighborhoodNodesQuery(nodeId: string): FixedQuery {
  validateNodeId(nodeId)

  return {
    cypher: `
      MATCH (center)--(neighbor)
      WHERE id(center) = toInteger($nodeId)
      WITH DISTINCT neighbor LIMIT ${KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT + 1}
      RETURN id(neighbor) AS id, labels(neighbor) AS labels,
        properties(neighbor) AS properties,
        indegree(neighbor) + outdegree(neighbor) AS degree
    `,
    params: { nodeId },
  }
}

export function getEdgesForNodeIdsQuery(
  nodeIds: string[],
  operation: 'overview' | 'neighbors'
): FixedQuery {
  nodeIds.forEach(validateNodeId)

  const resultLimit =
    operation === 'overview'
      ? KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT + 1
      : KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT + 1

  return {
    cypher: `
      MATCH (source)-[relationship]->(target)
      WHERE id(source) IN [nodeId IN $nodeIds | toInteger(nodeId)]
        AND id(target) IN [nodeId IN $nodeIds | toInteger(nodeId)]
      RETURN id(relationship) AS id, id(source) AS source,
        id(target) AS target, type(relationship) AS type,
        properties(relationship) AS properties
      LIMIT ${resultLimit}
    `,
    params: { nodeIds },
  }
}

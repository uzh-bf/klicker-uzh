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
  if (!/^\d+$/.test(nodeId)) {
    throw new KnowledgeGraphInputError('Node ID must be a decimal integer')
  }
}

export function getOverviewNodesQuery(): FixedQuery {
  return {
    cypher: `
      MATCH (n)
      OPTIONAL MATCH (n)--(adjacent)
      WITH n, count(adjacent) AS degree
      RETURN id(n) AS id, labels(n) AS labels, properties(n) AS properties,
        degree AS degree
      ORDER BY degree DESC, id(n) ASC
      LIMIT ${KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT + 1}
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
      OPTIONAL MATCH (n)--(adjacent)
      WITH n, count(adjacent) AS degree
      RETURN id(n) AS id, labels(n) AS labels, properties(n) AS properties,
        degree AS degree
      ORDER BY degree DESC, id(n) ASC
      LIMIT ${KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT + 1}
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
      WITH DISTINCT neighbor
      OPTIONAL MATCH (neighbor)--(adjacent)
      WITH neighbor, count(adjacent) AS degree
      RETURN id(neighbor) AS id, labels(neighbor) AS labels,
        properties(neighbor) AS properties, degree AS degree
      ORDER BY degree DESC, id(neighbor) ASC
      LIMIT ${KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT + 1}
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
      ORDER BY id(relationship) ASC
      LIMIT ${resultLimit}
    `,
    params: { nodeIds },
  }
}

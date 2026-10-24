import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { FalkorDB, type Graph } from 'falkordb'

import {
  getKnowledgeGraphConfig,
  KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT,
  KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT,
  KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT,
  type KnowledgeGraphConfig,
} from './config.js'
import {
  normalizeKnowledgeGraphEdge,
  normalizeKnowledgeGraphNode,
} from './normalize.js'
import type { PublishedKnowledgeGraph } from './publication.js'
import {
  getEdgesForNodeIdsQuery,
  getNeighborhoodNodesQuery,
  getNodesByIdQuery,
  getOverviewNodesQuery,
  getSearchNodesQuery,
  type KnowledgeGraphEdgeRow,
  type KnowledgeGraphNodeRow,
} from './queries.js'
import {
  GRAPH_MENTION_LIMIT,
  GRAPH_SEARCH_HINT_LIMIT,
  GRAPH_SEARCH_NODE_SCAN_LIMIT,
  GRAPH_SEARCH_QUERY_TIMEOUT_MS,
  graphSearchNeighborsQuery,
  graphSearchSeedsQuery,
  graphSearchTerms,
  type KnowledgeGraphMention,
  selectGraphMentions,
  selectGraphSearchSeeds,
} from './retrieval.js'

type ClientSession = {
  client: FalkorDB
  config: KnowledgeGraphConfig
}

let clientSessionPromise: Promise<ClientSession> | undefined
let beforeExitRegistered = false

function handleClientError(): void {
  // Keep credentials, connection strings, queries, and raw SDK errors out of
  // application logs while retaining a safe operational signal.
  console.error('Knowledge graph database connection error')
}

function closeBeforeExit(): void {
  void closeKnowledgeGraphClient()
}

function registerBeforeExit(): void {
  if (!beforeExitRegistered) {
    process.once('beforeExit', closeBeforeExit)
    beforeExitRegistered = true
  }
}

async function getClientSession(): Promise<ClientSession> {
  if (clientSessionPromise !== undefined) {
    return clientSessionPromise
  }

  const config = getKnowledgeGraphConfig()
  clientSessionPromise = FalkorDB.connect({
    username: config.username,
    password: config.password,
    socket: {
      host: config.host,
      port: config.port,
      tls: config.tls,
      connectTimeout: config.queryTimeoutMs,
    },
  })
    .then((client) => {
      client.on('error', handleClientError)
      registerBeforeExit()
      return { client, config }
    })
    .catch((error: unknown) => {
      clientSessionPromise = undefined
      throw error
    })

  return clientSessionPromise
}

export async function closeKnowledgeGraphClient(): Promise<void> {
  const sessionPromise = clientSessionPromise
  clientSessionPromise = undefined

  if (beforeExitRegistered) {
    process.removeListener('beforeExit', closeBeforeExit)
    beforeExitRegistered = false
  }

  if (sessionPromise === undefined) {
    return
  }

  let session: ClientSession
  try {
    session = await sessionPromise
  } catch {
    return
  }
  session.client.removeListener('error', handleClientError)
  await session.client.close()
}

/**
 * Remove one completed build's private FalkorDB graph. Callers must validate
 * ownership before invoking this; the client deliberately has no notion of KB
 * lifecycle or retention policy.
 *
 * FalkorDB rejects `GRAPH.DELETE` for a key that holds no graph, so an absent
 * graph counts as a satisfied request: a build that never wrote one and a graph
 * that was already removed must both be able to finish their cleanup instead of
 * failing on every sweep.
 */
export async function deleteKnowledgeGraph(graphName: string): Promise<void> {
  const { client, graph } = await graphSession(graphName)

  try {
    await graph.delete()
  } catch (error) {
    if (await isGraphAbsent(client, graphName)) {
      return
    }

    throw error
  }
}

// A failed deletion is only tolerable when the graph is really gone; an
// unreadable graph list keeps the original failure.
async function isGraphAbsent(
  client: FalkorDB,
  graphName: string
): Promise<boolean> {
  try {
    const graphNames = await client.list()
    return !graphNames.includes(graphName)
  } catch {
    return false
  }
}

// The graph name comes from the published build rather than being recomputed, so
// a build that is being served is always read under the name it was written to.
async function graphSession(graphName: string): Promise<{
  client: FalkorDB
  graph: Graph
  config: KnowledgeGraphConfig
}> {
  const { client, config } = await getClientSession()
  return {
    client,
    graph: client.selectGraph(graphName),
    config,
  }
}

async function readRows<Row>(
  graph: Graph,
  config: KnowledgeGraphConfig,
  query: { cypher: string; params: Record<string, string | string[]> }
): Promise<Row[]> {
  const result = await graph.roQuery<Row>(query.cypher, {
    params: query.params,
    TIMEOUT: Math.min(config.queryTimeoutMs, 1000),
  })
  return result.data ?? []
}

function sourceMap(context: PublishedKnowledgeGraph) {
  return new Map(
    context.sources.map((source) => [source.resourceId, source] as const)
  )
}

function normalizedNodes(
  rows: KnowledgeGraphNodeRow[],
  context: PublishedKnowledgeGraph
): KnowledgeGraphNode[] {
  const nodes = new Map<string, KnowledgeGraphNode>()
  const sources = sourceMap(context)

  for (const row of rows) {
    const node = normalizeKnowledgeGraphNode(row, sources)
    if (node !== null && !nodes.has(node.id)) {
      nodes.set(node.id, node)
    }
  }

  return Array.from(nodes.values())
}

function normalizedEdges(
  rows: KnowledgeGraphEdgeRow[],
  context: PublishedKnowledgeGraph
): KnowledgeGraphEdge[] {
  const edges = new Map<string, KnowledgeGraphEdge>()
  const sources = sourceMap(context)

  for (const row of rows) {
    const edge = normalizeKnowledgeGraphEdge(row, sources)
    if (edge !== null && !edges.has(edge.id)) {
      edges.set(edge.id, edge)
    }
  }

  return Array.from(edges.values())
}

function response(
  context: PublishedKnowledgeGraph,
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[],
  truncated: boolean
): KnowledgeGraphResponse {
  return {
    kbId: context.kbId,
    buildId: context.buildId,
    isStale: context.isStale,
    nodes,
    edges,
    truncated,
  }
}

export async function readKnowledgeGraphOverview(
  context: PublishedKnowledgeGraph
): Promise<KnowledgeGraphResponse> {
  const { graph, config } = await graphSession(context.graphName)
  const nodeRows = await readRows<KnowledgeGraphNodeRow>(
    graph,
    config,
    getOverviewNodesQuery()
  )
  const nodes = normalizedNodes(
    nodeRows.slice(0, KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT),
    context
  )
  const edgeRows =
    nodes.length === 0
      ? []
      : await readRows<KnowledgeGraphEdgeRow>(
          graph,
          config,
          getEdgesForNodeIdsQuery(
            nodes.map((node) => node.id),
            'overview'
          )
        )
  const edges = normalizedEdges(
    edgeRows.slice(0, KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT),
    context
  )

  return response(
    context,
    nodes,
    edges,
    nodeRows.length > KNOWLEDGE_GRAPH_OVERVIEW_NODE_LIMIT ||
      edgeRows.length > KNOWLEDGE_GRAPH_OVERVIEW_EDGE_LIMIT
  )
}

export async function searchKnowledgeGraph(
  context: PublishedKnowledgeGraph,
  searchText: string
): Promise<KnowledgeGraphResponse> {
  const query = getSearchNodesQuery(searchText)
  const { graph, config } = await graphSession(context.graphName)
  const rows = await readRows<KnowledgeGraphNodeRow>(graph, config, query)

  return response(
    context,
    normalizedNodes(rows.slice(0, KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT), context),
    [],
    rows.length > KNOWLEDGE_GRAPH_SEARCH_NODE_LIMIT
  )
}

export async function readKnowledgeGraphNeighbors(
  context: PublishedKnowledgeGraph,
  nodeId: string
): Promise<KnowledgeGraphResponse> {
  const query = getNeighborhoodNodesQuery(nodeId)
  const { graph, config } = await graphSession(context.graphName)
  const nodeRows = await readRows<KnowledgeGraphNodeRow>(graph, config, query)
  const allNodes = normalizedNodes(nodeRows, context).filter(
    (node) => node.id !== nodeId
  )
  const nodes = allNodes.slice(0, KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT)
  const edgeRows = await readRows<KnowledgeGraphEdgeRow>(
    graph,
    config,
    getEdgesForNodeIdsQuery(
      [nodeId, ...nodes.map((node) => node.id)],
      'neighbors'
    )
  )
  const edges = normalizedEdges(
    edgeRows.slice(0, KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT),
    context
  )

  return response(
    context,
    nodes,
    edges,
    allNodes.length > KNOWLEDGE_GRAPH_NEIGHBOR_NODE_LIMIT ||
      edgeRows.length > KNOWLEDGE_GRAPH_NEIGHBOR_EDGE_LIMIT
  )
}

/** Related concept names are search hints, never source evidence. */
export async function readKnowledgeGraphSearchHints(
  context: PublishedKnowledgeGraph,
  query: string
): Promise<string[]> {
  if (context.isStale) return []
  const terms = graphSearchTerms(query)
  if (terms.length === 0) return []
  const { graph, config } = await graphSession(context.graphName)
  const boundedConfig = {
    ...config,
    queryTimeoutMs: Math.min(
      config.queryTimeoutMs,
      GRAPH_SEARCH_QUERY_TIMEOUT_MS
    ),
  }
  const candidates = await readRows<KnowledgeGraphNodeRow>(
    graph,
    boundedConfig,
    graphSearchSeedsQuery()
  )
  if (candidates.length > GRAPH_SEARCH_NODE_SCAN_LIMIT) return []
  const seeds = selectGraphSearchSeeds(
    normalizedNodes(candidates, context),
    query
  )
  if (seeds.length === 0) return []
  const neighbors = normalizedNodes(
    await readRows<KnowledgeGraphNodeRow>(
      graph,
      boundedConfig,
      graphSearchNeighborsQuery(
        seeds.map((node) => node.id),
        terms
      )
    ),
    context
  )
  return [...new Set(neighbors.map((node) => node.displayLabel))]
    .filter(
      (name) =>
        name.length <= 100 &&
        /^[\p{L}\p{N}\s()&.,+/-]+$/u.test(name) &&
        !/^Concept \d+$/.test(name) &&
        !query.toLowerCase().includes(name.toLowerCase())
    )
    .slice(0, GRAPH_SEARCH_HINT_LIMIT)
}

const MENTION_LABEL_CACHE_LIMIT = 16
// A published graph name identifies one immutable build, so its concept labels
// can be reused until the entry is evicted.
const mentionLabelCache = new Map<string, Promise<KnowledgeGraphNode[]>>()

function mentionNodes(
  context: PublishedKnowledgeGraph
): Promise<KnowledgeGraphNode[]> {
  const cached = mentionLabelCache.get(context.graphName)
  if (cached) return cached
  const loaded = (async () => {
    const { graph, config } = await graphSession(context.graphName)
    const rows = await readRows<KnowledgeGraphNodeRow>(
      graph,
      config,
      graphSearchSeedsQuery()
    )
    return rows.length > GRAPH_SEARCH_NODE_SCAN_LIMIT
      ? []
      : normalizedNodes(rows, context)
  })()
  mentionLabelCache.set(context.graphName, loaded)
  loaded.catch(() => mentionLabelCache.delete(context.graphName))
  if (mentionLabelCache.size > MENTION_LABEL_CACHE_LIMIT) {
    const oldest = mentionLabelCache.keys().next().value
    if (oldest !== undefined) mentionLabelCache.delete(oldest)
  }
  return loaded
}

/** Concepts whose labels a text names verbatim, for linking them in the UI. */
export async function readKnowledgeGraphMentions(
  context: PublishedKnowledgeGraph,
  text: string
): Promise<KnowledgeGraphMention[]> {
  if (context.isStale) return []
  const mentions = selectGraphMentions(
    await mentionNodes(context),
    text,
    GRAPH_MENTION_LIMIT
  )
  if (mentions.length === 0) return []
  // The label scan reads names only; the UI focuses a concept with its details.
  const { graph, config } = await graphSession(context.graphName)
  const full = new Map(
    normalizedNodes(
      await readRows<KnowledgeGraphNodeRow>(
        graph,
        config,
        getNodesByIdQuery(mentions.map((mention) => mention.node.id))
      ),
      context
    ).map((node) => [node.id, node] as const)
  )
  return mentions.flatMap((mention) => {
    const node = full.get(mention.node.id)
    return node ? [{ node, text: mention.text }] : []
  })
}

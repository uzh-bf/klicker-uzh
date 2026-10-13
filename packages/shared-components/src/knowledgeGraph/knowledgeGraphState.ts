import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'

import { limitKnowledgeGraphSuggestions } from './knowledgeGraphSearch'

/**
 * Identifies the published graph that a neighbor read is derived from. Both ids
 * travel with the read so a replaced publication is rejected instead of merged.
 */
export type KnowledgeGraphNeighborOrigin = {
  kbId: string
  buildId: string
}

export type KnowledgeGraphDataSource = {
  overview: () => Promise<KnowledgeGraphResponse>
  search: (query: string) => Promise<KnowledgeGraphResponse>
  neighbors: (
    nodeId: string,
    origin: KnowledgeGraphNeighborOrigin
  ) => Promise<KnowledgeGraphResponse>
}

export class KnowledgeGraphUnavailableError extends Error {
  constructor(message = 'Knowledge graph is unavailable') {
    super(message)
    this.name = 'KnowledgeGraphUnavailableError'
  }
}

/**
 * The published revision changed between the overview and a neighbor read. The
 * viewer drops the mixed view and reloads the overview instead of merging
 * concepts that belong to different builds.
 */
export class KnowledgeGraphBuildChangedError extends Error {
  constructor(message = 'The published knowledge graph changed') {
    super(message)
    this.name = 'KnowledgeGraphBuildChangedError'
  }
}

export function isKnowledgeGraphBuildChangedError(error: unknown): boolean {
  if (error instanceof KnowledgeGraphBuildChangedError) {
    return true
  }
  if (typeof error !== 'object' || error === null) {
    return false
  }
  return (error as { code?: unknown }).code === 'KNOWLEDGE_GRAPH_BUILD_CHANGED'
}

export type KnowledgeGraphRequestOperation = 'overview' | 'search' | 'neighbors'

export type KnowledgeGraphFailedRequest = {
  operation: KnowledgeGraphRequestOperation
  input: string | null
}

export type KnowledgeGraphViewerStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'
  | 'unavailable'

export type KnowledgeGraphView = 'initial' | 'overview' | 'focused'

export type KnowledgeGraphSuggestionStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'error'

type ActiveRequestIds = Record<KnowledgeGraphRequestOperation, number | null>

/**
 * Bounded canvas size. An overview or neighborhood can return far more concepts
 * than the browser can lay out, so admission stops at these caps.
 */
export const KNOWLEDGE_GRAPH_MAX_NODES = 500
export const KNOWLEDGE_GRAPH_MAX_EDGES = 1000

export type KnowledgeGraphState = {
  kbId: string | null
  buildId: string | null
  isStale: boolean
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  truncated: boolean
  viewLimitReached: boolean
  view: KnowledgeGraphView
  selectedNodeId: string | null
  selectedEdgeId: string | null
  focusedNodeId: string | null
  searchResults: KnowledgeGraphNode[]
  suggestionStatus: KnowledgeGraphSuggestionStatus
  suggestions: KnowledgeGraphNode[]
  suggestionResponse: KnowledgeGraphResponse | null
  suggestionRequestId: number | null
  status: KnowledgeGraphViewerStatus
  errorMessage: string | null
  unavailableMessage: string | null
  failedRequest: KnowledgeGraphFailedRequest | null
  announcement: string
  activeRequestIds: ActiveRequestIds
}

export type KnowledgeGraphAction =
  | {
      type: 'request-started'
      operation: KnowledgeGraphRequestOperation
      requestId: number
      input?: string
    }
  | {
      type: 'request-succeeded'
      operation: KnowledgeGraphRequestOperation
      requestId: number
      response: KnowledgeGraphResponse
      announcement?: string
    }
  | {
      type: 'request-failed'
      operation: KnowledgeGraphRequestOperation
      requestId: number
      message: string
      input?: string
    }
  | {
      type: 'request-unavailable'
      operation: KnowledgeGraphRequestOperation
      requestId: number
      message: string
      input?: string
    }
  | { type: 'suggestions-started'; requestId: number }
  | {
      type: 'suggestions-succeeded'
      requestId: number
      response: KnowledgeGraphResponse
    }
  | { type: 'suggestions-failed'; requestId: number }
  | { type: 'dismiss-suggestions' }
  | {
      type: 'select-suggestion'
      response: KnowledgeGraphResponse
      nodeId: string
      announcement?: string
    }
  | { type: 'select-node'; nodeId: string; announcement?: string }
  | { type: 'select-edge'; edgeId: string; announcement?: string }
  | { type: 'focus-search-result'; nodeId: string; announcement?: string }
  | { type: 'close-details'; announcement?: string }
  | { type: 'clear-search' }
  | { type: 'reset' }

const emptyActiveRequestIds: ActiveRequestIds = {
  overview: null,
  search: null,
  neighbors: null,
}

export const initialKnowledgeGraphState: KnowledgeGraphState = {
  kbId: null,
  buildId: null,
  isStale: false,
  nodes: [],
  edges: [],
  truncated: false,
  viewLimitReached: false,
  view: 'initial',
  selectedNodeId: null,
  selectedEdgeId: null,
  focusedNodeId: null,
  searchResults: [],
  suggestionStatus: 'idle',
  suggestions: [],
  suggestionResponse: null,
  suggestionRequestId: null,
  status: 'idle',
  errorMessage: null,
  unavailableMessage: null,
  failedRequest: null,
  announcement: '',
  activeRequestIds: emptyActiveRequestIds,
}

function deduplicateById<T extends { id: string }>(
  current: T[],
  incoming: T[]
): T[] {
  const entries = new Map<string, T>()
  for (const entry of current) {
    entries.set(entry.id, entry)
  }
  for (const entry of incoming) {
    entries.set(entry.id, entry)
  }
  return Array.from(entries.values())
}

type LimitedKnowledgeGraphElements = {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  viewLimitReached: boolean
}

function admitKnowledgeGraphElements(
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[]
): LimitedKnowledgeGraphElements {
  let dropped = false

  const limitedNodes = deduplicateById([], nodes)
  if (limitedNodes.length > KNOWLEDGE_GRAPH_MAX_NODES) {
    limitedNodes.length = KNOWLEDGE_GRAPH_MAX_NODES
    dropped = true
  }

  const nodeIds = new Set(limitedNodes.map((node) => node.id))
  const admittedEdges: KnowledgeGraphEdge[] = []
  for (const edge of deduplicateById([], edges)) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      dropped = true
      continue
    }
    if (admittedEdges.length >= KNOWLEDGE_GRAPH_MAX_EDGES) {
      dropped = true
      continue
    }
    admittedEdges.push(edge)
  }

  return {
    nodes: limitedNodes,
    edges: admittedEdges,
    viewLimitReached: dropped,
  }
}

function limitReplacedElements(
  incoming: KnowledgeGraphResponse
): LimitedKnowledgeGraphElements {
  return admitKnowledgeGraphElements(incoming.nodes, incoming.edges)
}

function limitMergedElements(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): LimitedKnowledgeGraphElements {
  // Existing concepts keep their order and are only extended by fitting
  // incoming ones; an incoming id replaces the existing entry in place.
  return admitKnowledgeGraphElements(
    deduplicateById(state.nodes, incoming.nodes),
    deduplicateById(state.edges, incoming.edges)
  )
}

function replacesCurrentGraph(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): boolean {
  return (
    state.buildId === null ||
    state.buildId !== incoming.buildId ||
    state.kbId !== incoming.kbId
  )
}

function replaceKnowledgeGraphResponse(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): KnowledgeGraphState {
  const limited = limitReplacedElements(incoming)
  return {
    ...state,
    kbId: incoming.kbId,
    buildId: incoming.buildId,
    isStale: incoming.isStale,
    nodes: limited.nodes,
    edges: limited.edges,
    truncated: incoming.truncated,
    viewLimitReached: limited.viewLimitReached,
    selectedNodeId: null,
    selectedEdgeId: null,
    focusedNodeId: null,
    searchResults: [],
  }
}

export function mergeKnowledgeGraphResponse(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): KnowledgeGraphState {
  if (replacesCurrentGraph(state, incoming)) {
    return replaceKnowledgeGraphResponse(state, incoming)
  }

  const limited = limitMergedElements(state, incoming)
  return {
    ...state,
    isStale: incoming.isStale,
    nodes: limited.nodes,
    edges: limited.edges,
    truncated: state.truncated || incoming.truncated,
    viewLimitReached: state.viewLimitReached || limited.viewLimitReached,
  }
}

function withoutActiveRequest(
  state: KnowledgeGraphState,
  operation: KnowledgeGraphRequestOperation
): ActiveRequestIds {
  return { ...state.activeRequestIds, [operation]: null }
}

function isStaleRequest(
  state: KnowledgeGraphState,
  operation: KnowledgeGraphRequestOperation,
  requestId: number
): boolean {
  return state.activeRequestIds[operation] !== requestId
}

function hasNode(state: KnowledgeGraphState, nodeId: string): boolean {
  return state.nodes.some((node) => node.id === nodeId)
}

function hasEdge(state: KnowledgeGraphState, edgeId: string): boolean {
  return state.edges.some((edge) => edge.id === edgeId)
}

export function knowledgeGraphReducer(
  state: KnowledgeGraphState,
  action: KnowledgeGraphAction
): KnowledgeGraphState {
  switch (action.type) {
    case 'request-started': {
      // A view request replaces the whole canvas, so every pending operation,
      // including a slower neighbor read, is invalidated as it starts.
      const replacesPendingOperations =
        action.operation === 'overview' || action.operation === 'search'
      return {
        ...state,
        status: action.operation === 'overview' ? 'loading' : state.status,
        errorMessage: null,
        unavailableMessage:
          action.operation === 'overview' ? null : state.unavailableMessage,
        failedRequest: null,
        searchResults: action.operation === 'search' ? [] : state.searchResults,
        activeRequestIds: replacesPendingOperations
          ? { ...emptyActiveRequestIds, [action.operation]: action.requestId }
          : { ...state.activeRequestIds, [action.operation]: action.requestId },
      }
    }

    case 'request-succeeded': {
      if (isStaleRequest(state, action.operation, action.requestId)) {
        return state
      }

      const incoming = action.response
      const replacesGraph =
        action.operation === 'overview' ||
        action.operation === 'search' ||
        replacesCurrentGraph(state, incoming)
      const firstSearchResult =
        action.operation === 'search' ? incoming.nodes[0] : undefined
      const limited = replacesGraph
        ? limitReplacedElements(incoming)
        : limitMergedElements(state, incoming)
      const view: KnowledgeGraphView =
        action.operation === 'overview'
          ? 'overview'
          : action.operation === 'search'
            ? 'focused'
            : state.view

      return {
        ...state,
        kbId: incoming.kbId,
        buildId: incoming.buildId,
        isStale: incoming.isStale,
        nodes: limited.nodes,
        edges: limited.edges,
        truncated: replacesGraph
          ? incoming.truncated
          : state.truncated || incoming.truncated,
        viewLimitReached: replacesGraph
          ? limited.viewLimitReached
          : state.viewLimitReached || limited.viewLimitReached,
        view,
        status: 'ready',
        errorMessage: null,
        unavailableMessage: null,
        failedRequest: null,
        selectedNodeId:
          firstSearchResult?.id ??
          (replacesGraph ? null : state.selectedNodeId),
        selectedEdgeId:
          firstSearchResult !== undefined
            ? null
            : replacesGraph
              ? null
              : state.selectedEdgeId,
        focusedNodeId:
          firstSearchResult?.id ?? (replacesGraph ? null : state.focusedNodeId),
        searchResults:
          action.operation === 'search'
            ? deduplicateById([], incoming.nodes)
            : replacesGraph
              ? []
              : state.searchResults,
        announcement:
          action.announcement ??
          (action.operation === 'search'
            ? `${incoming.nodes.length} search results loaded.`
            : `${incoming.nodes.length} concepts loaded.`),
        activeRequestIds: replacesGraph
          ? emptyActiveRequestIds
          : withoutActiveRequest(state, action.operation),
      }
    }

    case 'request-failed':
      if (isStaleRequest(state, action.operation, action.requestId)) {
        return state
      }
      return {
        ...state,
        status: action.operation === 'overview' ? 'error' : state.status,
        errorMessage: action.message,
        failedRequest: {
          operation: action.operation,
          input: action.input ?? null,
        },
        announcement: action.message,
        activeRequestIds: withoutActiveRequest(state, action.operation),
      }

    case 'request-unavailable':
      if (isStaleRequest(state, action.operation, action.requestId)) {
        return state
      }
      return {
        ...initialKnowledgeGraphState,
        status: 'unavailable',
        unavailableMessage: action.message,
        failedRequest: {
          operation: action.operation,
          input: action.input ?? null,
        },
        announcement: action.message,
      }

    case 'suggestions-started':
      return {
        ...state,
        suggestionStatus: 'loading',
        suggestions: [],
        suggestionResponse: null,
        suggestionRequestId: action.requestId,
      }

    case 'suggestions-succeeded': {
      if (state.suggestionRequestId !== action.requestId) {
        return state
      }
      return {
        ...state,
        suggestionStatus: 'ready',
        suggestions: limitKnowledgeGraphSuggestions(action.response.nodes),
        suggestionResponse: action.response,
      }
    }

    case 'suggestions-failed': {
      if (state.suggestionRequestId !== action.requestId) {
        return state
      }
      // A suggestion failure is reported once; typing again is the only retry.
      return {
        ...state,
        suggestionStatus: 'error',
        suggestions: [],
        suggestionResponse: null,
      }
    }

    case 'dismiss-suggestions':
      // Clearing the request id drops any result that is still in flight, so a
      // dismissed list never reopens through a late response.
      return {
        ...state,
        suggestionStatus: 'idle',
        suggestions: [],
        suggestionResponse: null,
        suggestionRequestId: null,
      }

    case 'select-suggestion': {
      const selected = action.response.nodes.find(
        (node) => node.id === action.nodeId
      )
      if (selected === undefined) {
        return state
      }
      const limited = limitReplacedElements(action.response)
      return {
        ...state,
        kbId: action.response.kbId,
        buildId: action.response.buildId,
        isStale: action.response.isStale,
        nodes: limited.nodes,
        edges: limited.edges,
        truncated: action.response.truncated,
        viewLimitReached: limited.viewLimitReached,
        view: 'focused',
        selectedNodeId: action.nodeId,
        selectedEdgeId: null,
        focusedNodeId: action.nodeId,
        searchResults: [],
        suggestionStatus: 'idle',
        suggestions: [],
        suggestionResponse: null,
        suggestionRequestId: null,
        status: 'ready',
        errorMessage: null,
        unavailableMessage: null,
        failedRequest: null,
        activeRequestIds: emptyActiveRequestIds,
        announcement:
          action.announcement ?? `Selected ${selected.displayLabel}.`,
      }
    }

    case 'select-node':
    case 'focus-search-result':
      if (!hasNode(state, action.nodeId)) {
        return state
      }
      return {
        ...state,
        selectedNodeId: action.nodeId,
        selectedEdgeId: null,
        focusedNodeId: action.nodeId,
        announcement:
          action.announcement ??
          `Selected ${
            state.nodes.find((node) => node.id === action.nodeId)
              ?.displayLabel ?? 'concept'
          }.`,
      }

    case 'select-edge':
      if (!hasEdge(state, action.edgeId)) {
        return state
      }
      return {
        ...state,
        selectedNodeId: null,
        selectedEdgeId: action.edgeId,
        announcement: action.announcement ?? 'Selected relationship.',
      }

    case 'close-details':
      return {
        ...state,
        selectedNodeId: null,
        selectedEdgeId: null,
        announcement: action.announcement ?? 'Details closed.',
      }

    case 'clear-search':
      return { ...state, searchResults: [] }

    case 'reset':
      return initialKnowledgeGraphState
  }
}

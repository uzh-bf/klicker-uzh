import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'

export type KnowledgeGraphDataSource = {
  overview: () => Promise<KnowledgeGraphResponse>
  search: (query: string) => Promise<KnowledgeGraphResponse>
  neighbors: (nodeId: string) => Promise<KnowledgeGraphResponse>
}

export class KnowledgeGraphUnavailableError extends Error {
  constructor(message = 'Knowledge graph is unavailable') {
    super(message)
    this.name = 'KnowledgeGraphUnavailableError'
  }
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

type ActiveRequestIds = Record<KnowledgeGraphRequestOperation, number | null>

export type KnowledgeGraphState = {
  chatbotId: string | null
  builtRevision: number | null
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
  truncated: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  focusedNodeId: string | null
  searchResults: KnowledgeGraphNode[]
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
  chatbotId: null,
  builtRevision: null,
  nodes: [],
  edges: [],
  truncated: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  focusedNodeId: null,
  searchResults: [],
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

function replacesCurrentGraph(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): boolean {
  return (
    state.builtRevision === null ||
    state.builtRevision !== incoming.builtRevision ||
    state.chatbotId !== incoming.chatbotId
  )
}

function replaceKnowledgeGraphResponse(
  state: KnowledgeGraphState,
  incoming: KnowledgeGraphResponse
): KnowledgeGraphState {
  return {
    ...state,
    chatbotId: incoming.chatbotId,
    builtRevision: incoming.builtRevision,
    nodes: deduplicateById([], incoming.nodes),
    edges: deduplicateById([], incoming.edges),
    truncated: incoming.truncated,
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

  return {
    ...state,
    nodes: deduplicateById(state.nodes, incoming.nodes),
    edges: deduplicateById(state.edges, incoming.edges),
    truncated: state.truncated || incoming.truncated,
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
    case 'request-started':
      return {
        ...state,
        status: action.operation === 'overview' ? 'loading' : state.status,
        errorMessage: null,
        unavailableMessage:
          action.operation === 'overview' ? null : state.unavailableMessage,
        failedRequest: null,
        searchResults: action.operation === 'search' ? [] : state.searchResults,
        activeRequestIds: {
          ...state.activeRequestIds,
          [action.operation]: action.requestId,
        },
      }

    case 'request-succeeded': {
      if (isStaleRequest(state, action.operation, action.requestId)) {
        return state
      }

      const replacesGraph =
        action.operation === 'overview' ||
        replacesCurrentGraph(state, action.response)
      const nextGraph = replacesGraph
        ? replaceKnowledgeGraphResponse(state, action.response)
        : mergeKnowledgeGraphResponse(state, action.response)
      const firstSearchResult =
        action.operation === 'search' ? action.response.nodes[0] : undefined

      return {
        ...nextGraph,
        status: 'ready',
        errorMessage: null,
        unavailableMessage: null,
        failedRequest: null,
        selectedNodeId: firstSearchResult?.id ?? nextGraph.selectedNodeId,
        selectedEdgeId:
          firstSearchResult === undefined ? nextGraph.selectedEdgeId : null,
        focusedNodeId: firstSearchResult?.id ?? nextGraph.focusedNodeId,
        searchResults:
          action.operation === 'search'
            ? deduplicateById([], action.response.nodes)
            : nextGraph.searchResults,
        announcement:
          action.announcement ??
          (action.operation === 'search'
            ? `${action.response.nodes.length} search results loaded.`
            : `${action.response.nodes.length} concepts loaded.`),
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

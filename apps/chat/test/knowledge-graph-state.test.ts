import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'
import { KNOWLEDGE_GRAPH_MAX_SUGGESTIONS } from '../../../packages/shared-components/src/knowledgeGraph/knowledgeGraphSearch.js'
import {
  initialKnowledgeGraphState,
  isKnowledgeGraphBuildChangedError,
  KNOWLEDGE_GRAPH_MAX_EDGES,
  KNOWLEDGE_GRAPH_MAX_NODES,
  KnowledgeGraphBuildChangedError,
  type KnowledgeGraphState,
  knowledgeGraphReducer,
  mergeKnowledgeGraphResponse,
} from '../../../packages/shared-components/src/knowledgeGraph/knowledgeGraphState.js'
import {
  edgeAskSelection,
  nextKnowledgeGraphZoom,
  nodeAskSelection,
  relationshipLabels,
} from '../../../packages/shared-components/src/knowledgeGraph/knowledgeGraphView.js'

function node(id: string, overrides: Partial<KnowledgeGraphNode> = {}) {
  return {
    id,
    labels: ['Konzept'],
    kind: 'Concept',
    displayLabel: `Node ${id}`,
    degree: 1,
    sourceReferences: [],
    ...overrides,
  }
}

function edge(id: string, source: string, target: string): KnowledgeGraphEdge {
  return {
    id,
    source,
    target,
    type: 'RELATED',
    label: 'RELATED',
    properties: {},
  }
}

function response(
  buildId: string | number,
  nodes: KnowledgeGraphNode[],
  edges: KnowledgeGraphEdge[] = [],
  overrides: Partial<KnowledgeGraphResponse> = {}
): KnowledgeGraphResponse {
  return {
    kbId: 'kb-a',
    buildId: String(buildId),
    isStale: false,
    nodes,
    edges,
    truncated: false,
    ...overrides,
  }
}

describe('knowledge graph state', () => {
  it('deduplicates nodes and edges by ID while preferring incoming values', () => {
    const current = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      nodes: [node('1', { displayLabel: 'Old' }), node('1')],
      edges: [edge('10', '1', '2'), edge('10', '1', '2')],
    }

    const merged = mergeKnowledgeGraphResponse(
      current,
      response(
        1,
        [node('1', { displayLabel: 'Updated' }), node('2')],
        [edge('10', '1', '2'), edge('11', '2', '1')]
      )
    )

    expect(merged.nodes.map((entry) => entry.id)).toEqual(['1', '2'])
    expect(merged.nodes[0]?.displayLabel).toBe('Updated')
    expect(merged.edges.map((entry) => entry.id)).toEqual(['10', '11'])
  })

  it('replaces the whole graph when the published revision changes', () => {
    const current = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      nodes: [node('old')],
      edges: [edge('old-edge', 'old', 'other')],
      selectedNodeId: 'old',
    }

    const replaced = mergeKnowledgeGraphResponse(
      current,
      response(2, [node('new')])
    )

    expect(replaced).toMatchObject({
      buildId: '2',
      nodes: [node('new')],
      edges: [],
      selectedNodeId: null,
      selectedEdgeId: null,
    })
  })

  it('merges a same-revision neighborhood without losing the overview', () => {
    let state = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'request-started',
      operation: 'overview',
      requestId: 1,
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'overview',
      requestId: 1,
      response: response(3, [node('1')]),
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'neighbors',
      requestId: 2,
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'neighbors',
      requestId: 2,
      response: response(3, [node('2')], [edge('10', '1', '2')]),
    })

    expect(state.nodes.map((entry) => entry.id)).toEqual(['1', '2'])
    expect(state.edges.map((entry) => entry.id)).toEqual(['10'])
  })

  it('keeps node and edge selection mutually exclusive and closes to deselect', () => {
    const loaded = {
      ...initialKnowledgeGraphState,
      nodes: [node('1'), node('2')],
      edges: [edge('10', '1', '2')],
    }

    const selectedNode = knowledgeGraphReducer(loaded, {
      type: 'select-node',
      nodeId: '1',
    })
    expect(selectedNode).toMatchObject({
      selectedNodeId: '1',
      selectedEdgeId: null,
      focusedNodeId: '1',
    })

    const selectedEdge = knowledgeGraphReducer(selectedNode, {
      type: 'select-edge',
      edgeId: '10',
    })
    expect(selectedEdge).toMatchObject({
      selectedNodeId: null,
      selectedEdgeId: '10',
    })

    expect(
      knowledgeGraphReducer(selectedEdge, { type: 'close-details' })
    ).toMatchObject({ selectedNodeId: null, selectedEdgeId: null })
  })

  it('makes room for an explicit search result when the canvas is full', () => {
    const full = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      nodes: Array.from({ length: KNOWLEDGE_GRAPH_MAX_NODES }, (_, i) =>
        node(String(i))
      ),
    }
    const pending = knowledgeGraphReducer(full, {
      type: 'request-started',
      operation: 'search',
      requestId: 1,
    })
    const focused = knowledgeGraphReducer(pending, {
      type: 'request-succeeded',
      operation: 'search',
      requestId: 1,
      response: response(1, [node('new')]),
    })
    expect(focused.nodes.map((entry) => entry.id)).toEqual(['new'])
    expect(focused.selectedNodeId).toBe('new')
    expect(focused.viewLimitReached).toBe(false)
  })

  it('focuses the first successful search result', () => {
    const loaded = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '4',
      nodes: [node('1')],
    }
    let state = knowledgeGraphReducer(loaded, {
      type: 'request-started',
      operation: 'search',
      requestId: 7,
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'search',
      requestId: 7,
      response: response(4, [node('2'), node('3')]),
    })

    expect(state.searchResults.map((entry) => entry.id)).toEqual(['2', '3'])
    expect(state).toMatchObject({
      selectedNodeId: '2',
      focusedNodeId: '2',
    })
  })

  it('models initial loading, temporary error, retry, and unavailable states', () => {
    const loading = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'request-started',
      operation: 'overview',
      requestId: 1,
    })
    expect(loading.status).toBe('loading')

    const error = knowledgeGraphReducer(loading, {
      type: 'request-failed',
      operation: 'overview',
      requestId: 1,
      message: 'Knowledge graph is temporarily unavailable.',
    })
    expect(error).toMatchObject({
      status: 'error',
      errorMessage: 'Knowledge graph is temporarily unavailable.',
      failedRequest: { operation: 'overview', input: null },
    })

    const retrying = knowledgeGraphReducer(error, {
      type: 'request-started',
      operation: 'overview',
      requestId: 2,
    })
    expect(retrying).toMatchObject({ status: 'loading', errorMessage: null })

    const unavailable = knowledgeGraphReducer(retrying, {
      type: 'request-unavailable',
      operation: 'overview',
      requestId: 2,
      message: 'Build the current selection before opening the graph.',
    })
    expect(unavailable).toMatchObject({
      status: 'unavailable',
      nodes: [],
      edges: [],
      unavailableMessage:
        'Build the current selection before opening the graph.',
    })
  })

  it('suppresses stale success, failure, and unavailable responses', () => {
    let state = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'request-started',
      operation: 'overview',
      requestId: 1,
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'overview',
      requestId: 2,
    })

    const staleSuccess = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'overview',
      requestId: 1,
      response: response(1, [node('stale')]),
    })
    const staleFailure = knowledgeGraphReducer(staleSuccess, {
      type: 'request-failed',
      operation: 'overview',
      requestId: 1,
      message: 'stale error',
    })
    const staleUnavailable = knowledgeGraphReducer(staleFailure, {
      type: 'request-unavailable',
      operation: 'overview',
      requestId: 1,
      message: 'stale unavailable',
    })

    expect(staleUnavailable).toEqual(state)

    const current = knowledgeGraphReducer(staleUnavailable, {
      type: 'request-succeeded',
      operation: 'overview',
      requestId: 2,
      response: response(2, [node('current')]),
    })
    expect(current.nodes.map((entry) => entry.id)).toEqual(['current'])
  })

  it('invalidates requests and graph data when the data source resets', () => {
    let state: KnowledgeGraphState = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-old',
      buildId: '1',
      nodes: [node('old')],
    }
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'overview',
      requestId: 20,
    })
    state = knowledgeGraphReducer(state, { type: 'reset' })
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'overview',
      requestId: 21,
    })

    const stale = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'overview',
      requestId: 20,
      response: response(1, [node('old')], [], { kbId: 'kb-old' }),
    })

    expect(stale).toEqual(state)
    expect(stale.nodes).toEqual([])
    expect(stale.status).toBe('loading')
  })

  it('retains the failed operation input for an exact retry', () => {
    let state: KnowledgeGraphState = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      nodes: [node('1')],
      status: 'ready' as const,
    }
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'neighbors',
      requestId: 30,
      input: '1',
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-failed',
      operation: 'neighbors',
      requestId: 30,
      input: '1',
      message: 'Connections are temporarily unavailable. Try again.',
    })

    expect(state.failedRequest).toEqual({
      operation: 'neighbors',
      input: '1',
    })

    const retrying = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'neighbors',
      requestId: 31,
      input: '1',
    })
    expect(retrying.failedRequest).toBeNull()
    expect(retrying.errorMessage).toBeNull()
  })

  it('clamps zoom and resolves relationship endpoints to concept labels', () => {
    expect(nextKnowledgeGraphZoom(2.9, 1.25)).toBe(3)
    expect(nextKnowledgeGraphZoom(0.16, 0.8)).toBe(0.15)
    expect(nextKnowledgeGraphZoom(1, 1.25)).toBe(1.25)

    const nodes = new Map([
      ['1', node('1', { displayLabel: 'Alpha' })],
      ['2', node('2', { displayLabel: 'Beta' })],
    ])
    expect(relationshipLabels(edge('10', '1', '2'), nodes)).toEqual({
      source: 'Alpha',
      target: 'Beta',
    })
  })
})

describe('knowledge graph bounded view and suggestions', () => {
  function manyNodes(count: number, prefix = 'n'): KnowledgeGraphNode[] {
    return Array.from({ length: count }, (_, index) =>
      node(`${prefix}${index}`)
    )
  }

  function repeatedEdges(count: number): KnowledgeGraphEdge[] {
    return Array.from({ length: count }, (_, index) =>
      edge(`e${index}`, 'n0', 'n1')
    )
  }

  it('caps an overview replacement and drops edges without an admitted endpoint', () => {
    const loading = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'request-started',
      operation: 'overview',
      requestId: 1,
    })
    const capped = knowledgeGraphReducer(loading, {
      type: 'request-succeeded',
      operation: 'overview',
      requestId: 1,
      response: response(1, manyNodes(KNOWLEDGE_GRAPH_MAX_NODES + 1), [
        edge('dangling', 'n0', 'missing'),
      ]),
    })

    expect(capped.view).toBe('overview')
    expect(capped.nodes).toHaveLength(KNOWLEDGE_GRAPH_MAX_NODES)
    expect(capped.nodes[KNOWLEDGE_GRAPH_MAX_NODES - 1]?.id).toBe(
      `n${KNOWLEDGE_GRAPH_MAX_NODES - 1}`
    )
    expect(capped.edges).toEqual([])
    // The canvas limit is reported separately from the backend truncation flag.
    expect(capped.viewLimitReached).toBe(true)
    expect(capped.truncated).toBe(false)
  })

  it('admits only fitting incoming concepts and edges when merging a neighborhood', () => {
    let state: KnowledgeGraphState = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      status: 'ready',
      nodes: manyNodes(KNOWLEDGE_GRAPH_MAX_NODES),
      edges: repeatedEdges(KNOWLEDGE_GRAPH_MAX_EDGES),
    }
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'neighbors',
      requestId: 2,
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'neighbors',
      requestId: 2,
      response: response(
        1,
        [node('extra'), node('n0', { displayLabel: 'Updated' })],
        [edge('e-new', 'n0', 'n1'), edge('dangling', 'extra', 'n0')]
      ),
    })

    expect(state.nodes).toHaveLength(KNOWLEDGE_GRAPH_MAX_NODES)
    expect(state.nodes.some((entry) => entry.id === 'extra')).toBe(false)
    expect(state.nodes[0]?.displayLabel).toBe('Updated')
    expect(state.edges).toHaveLength(KNOWLEDGE_GRAPH_MAX_EDGES)
    expect(state.edges.some((entry) => entry.id === 'e-new')).toBe(false)
    expect(state.edges.some((entry) => entry.id === 'dangling')).toBe(false)
    expect(state.viewLimitReached).toBe(true)
    expect(state.truncated).toBe(false)
  })

  it('invalidates a pending neighborhood when a replacement view starts', () => {
    let state: KnowledgeGraphState = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      status: 'ready',
      nodes: [node('1')],
    }
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'neighbors',
      requestId: 5,
      input: '1',
    })
    state = knowledgeGraphReducer(state, {
      type: 'request-started',
      operation: 'search',
      requestId: 6,
      input: 'alpha',
    })
    expect(state.activeRequestIds.neighbors).toBeNull()

    const late = knowledgeGraphReducer(state, {
      type: 'request-succeeded',
      operation: 'neighbors',
      requestId: 5,
      response: response(1, [node('late')]),
    })

    expect(late.nodes.map((entry) => entry.id)).toEqual(['1'])
    expect(late.activeRequestIds.neighbors).toBeNull()
  })

  it('keeps only the newest suggestion response and bounds the list', () => {
    let state = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'suggestions-started',
      requestId: 3,
    })
    expect(state.suggestionStatus).toBe('loading')

    const stale = knowledgeGraphReducer(state, {
      type: 'suggestions-succeeded',
      requestId: 2,
      response: response(1, manyNodes(3, 's')),
    })
    expect(stale.suggestionStatus).toBe('loading')

    state = knowledgeGraphReducer(state, {
      type: 'suggestions-succeeded',
      requestId: 3,
      response: response(
        1,
        manyNodes(KNOWLEDGE_GRAPH_MAX_SUGGESTIONS + 5, 's')
      ),
    })
    expect(state.suggestionStatus).toBe('ready')
    expect(state.suggestions).toHaveLength(KNOWLEDGE_GRAPH_MAX_SUGGESTIONS)
    expect(state.suggestionResponse?.buildId).toBe('1')
  })

  it('reports a suggestion failure once and dismisses an in-flight response', () => {
    let state = knowledgeGraphReducer(initialKnowledgeGraphState, {
      type: 'suggestions-started',
      requestId: 4,
    })
    const failed = knowledgeGraphReducer(state, {
      type: 'suggestions-failed',
      requestId: 4,
    })
    expect(failed).toMatchObject({
      suggestionStatus: 'error',
      suggestions: [],
      suggestionResponse: null,
    })

    state = knowledgeGraphReducer(state, { type: 'dismiss-suggestions' })
    expect(state).toMatchObject({
      suggestionStatus: 'idle',
      suggestions: [],
      suggestionRequestId: null,
    })

    const late = knowledgeGraphReducer(state, {
      type: 'suggestions-succeeded',
      requestId: 4,
      response: response(1, manyNodes(2, 's')),
    })
    expect(late.suggestions).toEqual([])
    expect(late).toEqual(state)
  })

  it('selecting a suggestion replaces the view with its originating build and focuses the node', () => {
    const suggestionResponse = response(
      9,
      [node('target', { displayLabel: 'Target' }), node('peer')],
      [edge('t-e', 'target', 'peer')]
    )
    let state: KnowledgeGraphState = {
      ...initialKnowledgeGraphState,
      kbId: 'kb-a',
      buildId: '1',
      status: 'ready',
      view: 'focused',
      nodes: [node('old')],
      edges: [edge('old-edge', 'old', 'old')],
      selectedNodeId: 'old',
    }
    state = knowledgeGraphReducer(state, {
      type: 'suggestions-started',
      requestId: 8,
    })
    state = knowledgeGraphReducer(state, {
      type: 'suggestions-succeeded',
      requestId: 8,
      response: suggestionResponse,
    })

    const unknown = knowledgeGraphReducer(state, {
      type: 'select-suggestion',
      response: suggestionResponse,
      nodeId: 'missing',
    })
    expect(unknown).toEqual(state)

    const selected = knowledgeGraphReducer(state, {
      type: 'select-suggestion',
      response: suggestionResponse,
      nodeId: 'target',
    })

    expect(selected).toMatchObject({
      buildId: '9',
      view: 'focused',
      selectedNodeId: 'target',
      focusedNodeId: 'target',
      selectedEdgeId: null,
      searchResults: [],
      suggestionStatus: 'idle',
      suggestionRequestId: null,
      activeRequestIds: { overview: null, search: null, neighbors: null },
    })
    expect(selected.nodes.map((entry) => entry.id)).toEqual(['target', 'peer'])
    expect(selected.edges.map((entry) => entry.id)).toEqual(['t-e'])
  })

  it('recognises the build-changed protocol error', () => {
    expect(
      isKnowledgeGraphBuildChangedError(new KnowledgeGraphBuildChangedError())
    ).toBe(true)
    expect(
      isKnowledgeGraphBuildChangedError({
        code: 'KNOWLEDGE_GRAPH_BUILD_CHANGED',
      })
    ).toBe(true)
    expect(isKnowledgeGraphBuildChangedError({ status: 409 })).toBe(false)
    expect(isKnowledgeGraphBuildChangedError(new Error('plain'))).toBe(false)
    expect(isKnowledgeGraphBuildChangedError(null)).toBe(false)
  })
})

// Composer handoff carries display labels only, with bounded payload size.
describe('knowledge graph question selection', () => {
  it('bounds labels and omits graph metadata from the composer handoff', () => {
    const selected = node('internal-id', {
      displayLabel: 'x'.repeat(300),
      summary: 'Do not copy',
    })
    expect(nodeAskSelection(selected)).toEqual({
      kind: 'node',
      label: 'x'.repeat(200),
    })
    const relationship: KnowledgeGraphEdge = {
      id: 'edge-id',
      source: selected.id,
      target: 'missing-internal-id',
      type: 'RELATED',
      label: 'y'.repeat(300),
      properties: { hidden: 'Do not copy' },
    }
    expect(
      edgeAskSelection(
        relationship,
        new Map([[selected.id, selected]]),
        'Unknown'
      )
    ).toEqual({
      kind: 'edge',
      label: 'y'.repeat(200),
      source: 'x'.repeat(200),
      target: 'Unknown',
    })
  })
})

import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphResponse,
} from '@klicker-uzh/types'
import { describe, expect, it } from 'vitest'

import {
  type KnowledgeGraphState,
  initialKnowledgeGraphState,
  knowledgeGraphReducer,
  mergeKnowledgeGraphResponse,
} from '../../../packages/shared-components/src/knowledgeGraph/knowledgeGraphState.js'
import {
  nextKnowledgeGraphZoom,
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

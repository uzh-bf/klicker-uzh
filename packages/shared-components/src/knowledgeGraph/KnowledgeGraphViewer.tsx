'use client'

import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@klicker-uzh/types'
import cytoscape from 'cytoscape'
import React, {
  type FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'

import { KnowledgeGraphDetails } from './KnowledgeGraphDetails'
import {
  type KnowledgeGraphViewerLabelOverrides,
  type KnowledgeGraphViewerLabels,
  resolveKnowledgeGraphLabels,
} from './knowledgeGraphLabels'
import {
  type KnowledgeGraphDataSource,
  type KnowledgeGraphRequestOperation,
  KnowledgeGraphUnavailableError,
  initialKnowledgeGraphState,
  knowledgeGraphReducer,
} from './knowledgeGraphState'
import {
  KNOWLEDGE_GRAPH_MAX_ZOOM,
  KNOWLEDGE_GRAPH_MIN_ZOOM,
  nextKnowledgeGraphZoom,
  relationshipLabels,
} from './knowledgeGraphView'

const UZH_KIND_STYLES = [
  {
    color: '#BDC9E8',
    borderColor: '#001E7C',
    shape: 'ellipse',
    legendClassName: 'rounded-full bg-[#BDC9E8] border-[#001E7C]',
    shapeLabelKey: 'shapeCircle',
  },
  {
    color: '#F78CAA',
    borderColor: '#8F0A2E',
    shape: 'diamond',
    legendClassName: 'rotate-45 bg-[#F78CAA] border-[#8F0A2E]',
    shapeLabelKey: 'shapeDiamond',
  },
  {
    color: '#FFE9B5',
    borderColor: '#A27200',
    shape: 'round-rectangle',
    legendClassName: 'rounded bg-[#FFE9B5] border-[#A27200]',
    shapeLabelKey: 'shapeRoundedSquare',
  },
  {
    color: '#E7E7E7',
    borderColor: '#4D4D4D',
    shape: 'hexagon',
    legendClassName: 'rounded-sm bg-[#E7E7E7] border-[#4D4D4D]',
    shapeLabelKey: 'shapeHexagon',
  },
] as const

const CYTOSCAPE_STYLE: cytoscape.StylesheetJson = [
  {
    selector: 'node',
    style: {
      width: 48,
      height: 48,
      shape:
        'data(shape)' as cytoscape.Css.PropertyValueNode<cytoscape.Css.NodeShape>,
      'background-color': 'data(color)',
      'border-color': 'data(borderColor)',
      'border-width': 2,
      label: 'data(displayLabel)',
      color: '#121212',
      'font-family': 'Source Sans 3, Source Sans Pro, sans-serif',
      'font-size': 12,
      'font-weight': 600,
      'text-wrap': 'wrap',
      'text-max-width': '120px',
      'text-valign': 'bottom',
      'text-margin-y': 8,
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'node:selected',
    style: {
      'background-color': '#0028A5',
      'border-color': '#001452',
      'border-width': 4,
      'underlay-color': '#BDC9E8',
      'underlay-opacity': 0.45,
      'underlay-padding': 8,
    },
  },
  {
    selector: 'edge',
    style: {
      width: 1.5,
      'line-color': '#A3A3A3',
      'target-arrow-color': '#A3A3A3',
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'overlay-opacity': 0,
    },
  },
  {
    selector: 'edge:selected',
    style: {
      width: 3,
      'line-color': '#0028A5',
      'target-arrow-color': '#0028A5',
    },
  },
]

type KnowledgeGraphViewerProps = {
  dataSource: KnowledgeGraphDataSource
  className?: string
  unavailableMessage?: string
  labels?: KnowledgeGraphViewerLabelOverrides
}

function kindStyle(kind: string) {
  let hash = 0
  for (const character of kind) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0
  }
  return UZH_KIND_STYLES[hash % UZH_KIND_STYLES.length]!
}

function cytoscapeNodeId(nodeId: string) {
  return `node:${nodeId}`
}

function cytoscapeEdgeId(edgeId: string) {
  return `edge:${edgeId}`
}

function nodeDefinition(node: KnowledgeGraphNode): cytoscape.NodeDefinition {
  const style = kindStyle(node.kind)
  return {
    group: 'nodes',
    data: {
      id: cytoscapeNodeId(node.id),
      graphId: node.id,
      displayLabel: node.displayLabel,
      kind: node.kind,
      color: style.color,
      borderColor: style.borderColor,
      shape: style.shape,
    },
  }
}

function edgeDefinition(edge: KnowledgeGraphEdge): cytoscape.EdgeDefinition {
  return {
    group: 'edges',
    data: {
      id: cytoscapeEdgeId(edge.id),
      graphId: edge.id,
      source: cytoscapeNodeId(edge.source),
      target: cytoscapeNodeId(edge.target),
      label: edge.label,
      type: edge.type,
    },
  }
}

function isUnavailableError(error: unknown): boolean {
  if (error instanceof KnowledgeGraphUnavailableError) {
    return true
  }

  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as { code?: unknown; status?: unknown }
  return candidate.code === 'UNAVAILABLE' || candidate.status === 409
}

function safeRequestError(
  operation: 'overview' | 'search' | 'neighbors',
  labels: KnowledgeGraphViewerLabels
) {
  if (operation === 'search') {
    return labels.searchUnavailable
  }
  if (operation === 'neighbors') {
    return labels.connectionsUnavailable
  }
  return labels.graphUnavailable
}

export function KnowledgeGraphViewer({
  dataSource,
  className = '',
  unavailableMessage,
  labels: labelOverrides,
}: KnowledgeGraphViewerProps) {
  const labels = useMemo(
    () => resolveKnowledgeGraphLabels(labelOverrides),
    [labelOverrides]
  )
  const resolvedUnavailableMessage =
    unavailableMessage ?? labels.defaultUnavailableMessage
  const [state, dispatch] = useReducer(
    knowledgeGraphReducer,
    initialKnowledgeGraphState
  )
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const cyRef = useRef<cytoscape.Core | null>(null)
  const dataSourceRef = useRef(dataSource)
  const stateRef = useRef(state)
  const requestIdRef = useRef(0)
  const latestRequestIdsRef = useRef<
    Record<KnowledgeGraphRequestOperation, number | null>
  >({ overview: null, search: null, neighbors: null })
  const sourceGenerationRef = useRef(0)
  const mountedDataSourceRef = useRef<KnowledgeGraphDataSource | null>(null)
  const positionsRef = useRef(new Map<string, cytoscape.Position>())
  const renderedRevisionRef = useRef<number | null>(null)
  const expansionOriginRef = useRef<string | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const prefersReducedMotionRef = useRef(false)
  const expandNodeRef = useRef<(nodeId: string) => void>(() => undefined)
  const labelsRef = useRef(labels)

  dataSourceRef.current = dataSource
  stateRef.current = state
  labelsRef.current = labels

  const runRequest = useCallback(
    async (
      operation: KnowledgeGraphRequestOperation,
      input: string | null,
      request: () => ReturnType<KnowledgeGraphDataSource['overview']>
    ) => {
      const requestId = ++requestIdRef.current
      const sourceGeneration = sourceGenerationRef.current
      latestRequestIdsRef.current[operation] = requestId
      dispatch({
        type: 'request-started',
        operation,
        requestId,
        ...(input === null ? {} : { input }),
      })

      try {
        const graphResponse = await request()
        if (
          sourceGenerationRef.current !== sourceGeneration ||
          latestRequestIdsRef.current[operation] !== requestId
        ) {
          return null
        }
        dispatch({
          type: 'request-succeeded',
          operation,
          requestId,
          response: graphResponse,
          announcement:
            operation === 'search'
              ? labelsRef.current.searchResultsLoadedAnnouncement(
                  graphResponse.nodes.length
                )
              : labelsRef.current.conceptsLoadedAnnouncement(
                  graphResponse.nodes.length
                ),
        })
        return graphResponse
      } catch (error) {
        if (
          sourceGenerationRef.current !== sourceGeneration ||
          latestRequestIdsRef.current[operation] !== requestId
        ) {
          return null
        }
        if (isUnavailableError(error)) {
          dispatch({
            type: 'request-unavailable',
            operation,
            requestId,
            message: resolvedUnavailableMessage,
            ...(input === null ? {} : { input }),
          })
        } else {
          dispatch({
            type: 'request-failed',
            operation,
            requestId,
            message: safeRequestError(operation, labelsRef.current),
            ...(input === null ? {} : { input }),
          })
        }
        return null
      }
    },
    [resolvedUnavailableMessage]
  )

  const loadOverview = useCallback(async () => {
    await runRequest('overview', null, () => dataSourceRef.current.overview())
  }, [runRequest])

  const expandNode = useCallback(
    async (nodeId: string) => {
      expansionOriginRef.current = nodeId
      const loadedNodeIds = new Set(
        stateRef.current.nodes.map((node) => node.id)
      )
      const result = await runRequest('neighbors', nodeId, () =>
        dataSourceRef.current.neighbors(nodeId)
      )
      const hasNewNodes =
        result?.nodes.some(
          (node) => node.id !== nodeId && !loadedNodeIds.has(node.id)
        ) ?? false
      if (
        (!hasNewNodes || result === null) &&
        expansionOriginRef.current === nodeId
      ) {
        expansionOriginRef.current = null
      }
    },
    [runRequest]
  )
  expandNodeRef.current = (nodeId) => {
    void expandNode(nodeId)
  }

  useLayoutEffect(() => {
    if (mountedDataSourceRef.current === dataSource) {
      return
    }

    mountedDataSourceRef.current = dataSource
    dataSourceRef.current = dataSource
    sourceGenerationRef.current += 1
    latestRequestIdsRef.current = {
      overview: null,
      search: null,
      neighbors: null,
    }
    stateRef.current = initialKnowledgeGraphState
    positionsRef.current.clear()
    renderedRevisionRef.current = null
    expansionOriginRef.current = null
    pendingFocusRef.current = null
    cyRef.current?.elements().remove()
    setSearchQuery('')
    dispatch({ type: 'reset' })
    void loadOverview()
  }, [dataSource, loadOverview])

  useEffect(() => {
    const container = containerRef.current
    if (container === null) {
      return
    }

    prefersReducedMotionRef.current = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches
    const options: cytoscape.CytoscapeOptions & {
      multiClickDebounceTime: number
    } = {
      container,
      elements: [],
      style: CYTOSCAPE_STYLE,
      layout: { name: 'preset', fit: false },
      minZoom: KNOWLEDGE_GRAPH_MIN_ZOOM,
      maxZoom: KNOWLEDGE_GRAPH_MAX_ZOOM,
      panningEnabled: true,
      userPanningEnabled: true,
      zoomingEnabled: true,
      userZoomingEnabled: true,
      autoungrabify: false,
      multiClickDebounceTime: 250,
    }
    const cy = cytoscape(options)
    cyRef.current = cy

    const onNodeTap: cytoscape.EventHandler = (event) => {
      const nodeId = String(event.target.data('graphId'))
      const displayLabel = String(event.target.data('displayLabel'))
      dispatch({
        type: 'select-node',
        nodeId,
        announcement:
          labelsRef.current.selectedConceptAnnouncement(displayLabel),
      })
    }
    const onNodeDoubleTap: cytoscape.EventHandler = (event) => {
      const nodeId = String(event.target.data('graphId'))
      expansionOriginRef.current = nodeId
      expandNodeRef.current(nodeId)
    }
    const onEdgeTap: cytoscape.EventHandler = (event) => {
      dispatch({
        type: 'select-edge',
        edgeId: String(event.target.data('graphId')),
        announcement: labelsRef.current.selectedRelationshipAnnouncement,
      })
    }
    const rememberPosition: cytoscape.EventHandler = (event) => {
      positionsRef.current.set(
        String(event.target.data('graphId')),
        event.target.position()
      )
    }

    cy.on('onetap', 'node', onNodeTap)
    cy.on('dbltap', 'node', onNodeDoubleTap)
    cy.on('onetap', 'edge', onEdgeTap)
    cy.on('dragfree', 'node', rememberPosition)

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => cy.resize())
    resizeObserver?.observe(container)

    return () => {
      resizeObserver?.disconnect()
      cy.off('onetap', 'node', onNodeTap)
      cy.off('dbltap', 'node', onNodeDoubleTap)
      cy.off('onetap', 'edge', onEdgeTap)
      cy.off('dragfree', 'node', rememberPosition)
      cy.destroy()
      cyRef.current = null
      positionsRef.current.clear()
    }
  }, [])

  useEffect(() => {
    const cy = cyRef.current
    if (cy === null) {
      return
    }

    cy.nodes().forEach((node) => {
      positionsRef.current.set(String(node.data('graphId')), node.position())
    })

    const revisionChanged = renderedRevisionRef.current !== state.builtRevision
    if (revisionChanged) {
      cy.elements().remove()
      positionsRef.current.clear()
      renderedRevisionRef.current = state.builtRevision
    }

    const nodeIds = new Set(state.nodes.map((node) => node.id))
    const edgeIds = new Set(state.edges.map((edge) => edge.id))
    const expansionOriginWasLoaded =
      expansionOriginRef.current !== null &&
      !cy.getElementById(cytoscapeNodeId(expansionOriginRef.current)).empty()
    cy.edges()
      .filter((edge) => !edgeIds.has(String(edge.data('graphId'))))
      .remove()
    cy.nodes()
      .filter((node) => !nodeIds.has(String(node.data('graphId'))))
      .remove()

    const newNodeIds = new Set<string>()
    for (const node of state.nodes) {
      const existing = cy.getElementById(cytoscapeNodeId(node.id))
      const definition = nodeDefinition(node)
      if (existing.empty()) {
        cy.add(definition)
        newNodeIds.add(node.id)
      } else {
        existing.data(definition.data)
        const savedPosition = positionsRef.current.get(node.id)
        if (savedPosition !== undefined) {
          existing.position(savedPosition)
        }
      }
    }

    for (const edge of state.edges) {
      const existing = cy.getElementById(cytoscapeEdgeId(edge.id))
      const endpointsExist =
        !cy.getElementById(cytoscapeNodeId(edge.source)).empty() &&
        !cy.getElementById(cytoscapeNodeId(edge.target)).empty()
      if (existing.empty() && endpointsExist) {
        cy.add(edgeDefinition(edge))
      } else if (!existing.empty()) {
        existing.data(edgeDefinition(edge).data)
      }
    }

    const newNodes = cy
      .nodes()
      .filter((node) => newNodeIds.has(String(node.data('graphId'))))
    if (newNodes.empty()) {
      if (expansionOriginWasLoaded) {
        expansionOriginRef.current = null
      }
      return
    }

    const origin =
      expansionOriginRef.current === null
        ? cy.collection()
        : cy.getElementById(cytoscapeNodeId(expansionOriginRef.current))
    const viewportExtent = cy.extent()
    const originPosition = origin.empty()
      ? {
          x: (viewportExtent.x1 + viewportExtent.x2) / 2,
          y: (viewportExtent.y1 + viewportExtent.y2) / 2,
        }
      : origin.position()
    newNodes.forEach((node, index) => {
      const angle = (index / Math.max(newNodes.length, 1)) * Math.PI * 2
      node.position({
        x: originPosition.x + Math.cos(angle) * 100,
        y: originPosition.y + Math.sin(angle) * 100,
      })
    })

    const isInitialLayout = revisionChanged
    const subsetEdges = cy.edges().filter((edge) => {
      return (
        newNodeIds.has(String(edge.source().data('graphId'))) &&
        newNodeIds.has(String(edge.target().data('graphId')))
      )
    })
    const layoutElements = isInitialLayout
      ? cy.elements()
      : newNodes.union(subsetEdges)
    const layout = layoutElements.layout({
      name: 'cose',
      animate: !prefersReducedMotionRef.current,
      randomize: isInitialLayout,
      fit: false,
      padding: 30,
      nodeRepulsion: 6_000,
      idealEdgeLength: 90,
    })
    layout.one('layoutstop', () => {
      cy.nodes().forEach((node) => {
        positionsRef.current.set(String(node.data('graphId')), node.position())
      })
      if (isInitialLayout) {
        cy.fit(cy.elements(), 40)
      }
    })
    layout.run()
    if (expansionOriginWasLoaded) {
      expansionOriginRef.current = null
    }
  }, [state.builtRevision, state.edges, state.nodes])

  useEffect(() => {
    const cy = cyRef.current
    if (cy === null) {
      return
    }

    cy.elements().unselect()
    const selectedId = state.selectedNodeId ?? state.selectedEdgeId
    if (selectedId !== null) {
      const cytoscapeId =
        state.selectedNodeId === null
          ? cytoscapeEdgeId(selectedId)
          : cytoscapeNodeId(selectedId)
      cy.getElementById(cytoscapeId).select()
    }

    if (
      state.focusedNodeId !== null &&
      pendingFocusRef.current === state.focusedNodeId
    ) {
      const focusedNode = cy.getElementById(
        cytoscapeNodeId(state.focusedNodeId)
      )
      if (!focusedNode.empty()) {
        cy.center(focusedNode)
        pendingFocusRef.current = null
      }
    }
  }, [state.focusedNodeId, state.selectedEdgeId, state.selectedNodeId])

  const indexes = useMemo(() => {
    return {
      nodes: new Map(state.nodes.map((node) => [node.id, node])),
      edges: new Map(state.edges.map((edge) => [edge.id, edge])),
    }
  }, [state.edges, state.nodes])
  const selectedNode =
    state.selectedNodeId === null
      ? undefined
      : indexes.nodes.get(state.selectedNodeId)
  const selectedEdge =
    state.selectedEdgeId === null
      ? undefined
      : indexes.edges.get(state.selectedEdgeId)
  const selectedEdgeEndpoints =
    selectedEdge === undefined
      ? undefined
      : relationshipLabels(selectedEdge, indexes.nodes)
  const relationshipEntries = useMemo(
    () =>
      state.edges.map((edge) => ({
        edge,
        ...relationshipLabels(edge, indexes.nodes),
      })),
    [indexes.nodes, state.edges]
  )

  const legendEntries = useMemo(() => {
    const kinds = new Map<string, ReturnType<typeof kindStyle>>()
    for (const node of state.nodes) {
      if (!kinds.has(node.kind)) {
        kinds.set(node.kind, kindStyle(node.kind))
      }
    }
    return Array.from(kinds.entries()).slice(0, 8)
  }, [state.nodes])

  function focusNode(nodeId: string) {
    pendingFocusRef.current = nodeId
    const displayLabel =
      indexes.nodes.get(nodeId)?.displayLabel ?? labels.details.concept
    dispatch({
      type: 'focus-search-result',
      nodeId,
      announcement: labels.selectedConceptAnnouncement(displayLabel),
    })
  }

  const searchGraph = useCallback(
    async (query: string) => {
      const loadedNodeIds = new Set(
        stateRef.current.nodes.map((node) => node.id)
      )
      const result = await runRequest('search', query, () =>
        dataSourceRef.current.search(query)
      )
      const firstResult = result?.nodes[0]
      if (firstResult === undefined) {
        return
      }

      pendingFocusRef.current = firstResult.id
      if (!loadedNodeIds.has(firstResult.id)) {
        await expandNode(firstResult.id)
      }
    },
    [expandNode, runRequest]
  )

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const query = searchQuery.trim()
    if (query.length === 0 || query.length > 100) {
      return
    }

    await searchGraph(query)
  }

  function retryFailedRequest() {
    const failedRequest = stateRef.current.failedRequest
    if (failedRequest === null || failedRequest.operation === 'overview') {
      void loadOverview()
      return
    }

    if (failedRequest.operation === 'search') {
      if (failedRequest.input !== null) {
        setSearchQuery(failedRequest.input)
        void searchGraph(failedRequest.input)
      }
      return
    }

    if (failedRequest.input !== null) {
      void expandNode(failedRequest.input)
    }
  }

  function fitGraph() {
    const cy = cyRef.current
    if (cy !== null && !cy.elements().empty()) {
      cy.fit(cy.elements(), 40)
    }
  }

  function changeZoom(scale: number) {
    const cy = cyRef.current
    if (cy === null) {
      return
    }

    cy.zoom({
      level: nextKnowledgeGraphZoom(
        cy.zoom(),
        scale,
        cy.minZoom(),
        cy.maxZoom()
      ),
      renderedPosition: { x: cy.width() / 2, y: cy.height() / 2 },
    })
  }

  function resetLayout() {
    const cy = cyRef.current
    if (cy === null || cy.nodes().empty()) {
      return
    }

    const layout = cy.elements().layout({
      name: 'cose',
      animate: !prefersReducedMotionRef.current,
      randomize: true,
      fit: false,
      padding: 30,
      nodeRepulsion: 6_000,
      idealEdgeLength: 90,
    })
    layout.run()
  }

  const showFullError = state.status === 'error' && state.nodes.length === 0
  const isSearching = state.activeRequestIds.search !== null
  const isExpanding = state.activeRequestIds.neighbors !== null

  return (
    <section
      aria-label={labels.explorerAriaLabel}
      className={`relative flex h-full min-h-[32rem] w-full min-w-0 overflow-hidden rounded-lg border border-[#E9E9E9] bg-white ${className}`}
      data-cy="knowledge-graph-viewer"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[#E9E9E9] bg-white p-3 md:p-4">
          <form
            role="search"
            aria-label={labels.searchAriaLabel}
            onSubmit={(event) => void handleSearch(event)}
            className="flex gap-2"
          >
            <label htmlFor="knowledge-graph-search" className="sr-only">
              {labels.searchLabel}
            </label>
            <input
              id="knowledge-graph-search"
              type="search"
              value={searchQuery}
              minLength={1}
              maxLength={100}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={labels.searchPlaceholder}
              className="min-h-11 min-w-0 flex-1 rounded border border-[#E9E9E9] px-3 py-2 text-base text-[#121212] placeholder:text-[#666666] focus:border-[#0028A5] focus:outline-none focus:ring-2 focus:ring-[#BDC9E8]"
              data-cy="knowledge-graph-search"
            />
            <button
              type="submit"
              disabled={isSearching || searchQuery.trim().length === 0}
              className="min-h-11 rounded-full border border-[#0028A5] bg-[#0028A5] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSearching ? labels.searching : labels.search}
            </button>
          </form>

          {state.truncated ? (
            <p className="mt-2 text-sm text-[#4C4C4C]" role="note">
              {labels.truncatedNotice}
            </p>
          ) : null}

          {state.errorMessage !== null && !showFullError ? (
            <div
              role="alert"
              className="mt-2 flex items-center justify-between gap-3 rounded border border-[#F78CAA] bg-[#FBC6D4] px-3 py-2 text-sm text-[#60061F]"
            >
              <span>{state.errorMessage}</span>
              <button
                type="button"
                onClick={retryFailedRequest}
                className="min-h-11 shrink-0 rounded-full border border-[#8F0A2E] bg-white px-4 font-semibold text-[#60061F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
                data-cy="knowledge-graph-retry"
              >
                {labels.retry}
              </button>
            </div>
          ) : null}
        </div>

        <div className="relative min-h-80 flex-1 bg-[#FAFAFA]">
          <div
            id="knowledge-graph-canvas"
            ref={containerRef}
            role="img"
            aria-label={labels.canvasAriaLabel}
            className="h-full w-full"
          />

          <div className="absolute left-3 right-3 top-3 flex flex-wrap gap-2 md:right-auto">
            <button
              type="button"
              onClick={() => changeZoom(1.25)}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              aria-label={labels.zoomInAriaLabel}
              data-cy="knowledge-graph-zoom-in"
            >
              {labels.zoomIn}
            </button>
            <button
              type="button"
              onClick={() => changeZoom(0.8)}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              aria-label={labels.zoomOutAriaLabel}
              data-cy="knowledge-graph-zoom-out"
            >
              {labels.zoomOut}
            </button>
            <button
              type="button"
              onClick={fitGraph}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              data-cy="knowledge-graph-fit"
            >
              {labels.fitView}
            </button>
            <button
              type="button"
              onClick={resetLayout}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              data-cy="knowledge-graph-reset"
            >
              {labels.resetLayout}
            </button>
          </div>

          {legendEntries.length === 0 ? null : (
            <div
              aria-label={labels.legendAriaLabel}
              className="absolute bottom-3 right-3 hidden max-w-48 rounded-lg border border-[#E9E9E9] bg-white/95 p-3 text-xs text-[#121212] shadow-sm sm:block md:bottom-auto md:top-3"
            >
              <p className="mb-2 font-semibold">{labels.conceptTypes}</p>
              <ul className="space-y-1.5">
                {legendEntries.map(([kind, style]) => (
                  <li key={kind} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className={`h-3.5 w-3.5 shrink-0 border ${style.legendClassName}`}
                      style={
                        style.shape === 'hexagon'
                          ? {
                              clipPath:
                                'polygon(25% 0, 75% 0, 100% 50%, 75% 100%, 25% 100%, 0 50%)',
                            }
                          : undefined
                      }
                    />
                    <span className="min-w-0 truncate">
                      {kind} ({labels[style.shapeLabelKey]})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {state.status === 'loading' || state.status === 'idle' ? (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center text-[#4C4C4C]"
            >
              {labels.loading}
            </div>
          ) : null}

          {showFullError ? (
            <div
              role="alert"
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/95 p-6 text-center"
            >
              <div>
                <h2 className="text-lg font-semibold text-[#121212]">
                  {labels.unavailableTitle}
                </h2>
                <p className="mt-1 text-sm text-[#4C4C4C]">
                  {state.errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={retryFailedRequest}
                className="min-h-11 rounded-full border border-[#0028A5] bg-[#0028A5] px-5 text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] focus-visible:ring-offset-2"
                data-cy="knowledge-graph-retry"
              >
                {labels.retry}
              </button>
            </div>
          ) : null}

          {state.status === 'unavailable' ? (
            <div
              role="status"
              className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-white/95 p-6 text-center"
            >
              <div>
                <h2 className="text-lg font-semibold text-[#121212]">
                  {labels.notReadyTitle}
                </h2>
                <p className="mt-1 max-w-md text-sm text-[#4C4C4C]">
                  {state.unavailableMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={retryFailedRequest}
                className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-5 text-sm font-semibold text-[#121212] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
                data-cy="knowledge-graph-retry"
              >
                {labels.checkAgain}
              </button>
            </div>
          ) : null}
        </div>

        <div
          className={`grid max-h-64 shrink-0 grid-cols-1 overflow-y-auto border-t border-[#E9E9E9] bg-white md:h-56 md:overflow-hidden ${state.searchResults.length === 0 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
        >
          {state.searchResults.length === 0 ? null : (
            <section
              aria-labelledby="knowledge-graph-search-results-heading"
              className="max-h-44 overflow-y-auto border-b border-[#E9E9E9] p-3 md:max-h-none md:border-b-0 md:border-r"
            >
              <h2
                id="knowledge-graph-search-results-heading"
                className="mb-2 text-sm font-semibold text-[#121212]"
              >
                {labels.searchResults}
              </h2>
              <ul className="space-y-1">
                {state.searchResults.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      onClick={() => focusNode(node.id)}
                      className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
                    >
                      <span className="font-semibold">{node.displayLabel}</span>
                      <span className="block text-[#4C4C4C]">{node.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            aria-labelledby="knowledge-graph-loaded-nodes-heading"
            className="max-h-44 overflow-y-auto border-b border-[#E9E9E9] p-3 [content-visibility:auto] md:max-h-none md:border-b-0 md:border-r"
            data-cy="knowledge-graph-loaded-nodes"
          >
            <h2
              id="knowledge-graph-loaded-nodes-heading"
              className="mb-2 text-sm font-semibold text-[#121212]"
            >
              {labels.loadedConcepts(state.nodes.length)}
            </h2>
            {state.nodes.length === 0 ? (
              <p className="text-sm text-[#4C4C4C]">
                {labels.noConceptsLoaded}
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-1">
                {state.nodes.map((node) => (
                  <li key={node.id}>
                    <button
                      type="button"
                      aria-pressed={state.selectedNodeId === node.id}
                      onClick={() => focusNode(node.id)}
                      className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] aria-pressed:bg-[#F5F5FB] aria-pressed:text-[#0028A5]"
                    >
                      <span className="font-semibold">{node.displayLabel}</span>
                      <span className="block text-[#4C4C4C]">{node.kind}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section
            aria-labelledby="knowledge-graph-loaded-relationships-heading"
            className="max-h-44 overflow-y-auto p-3 [content-visibility:auto] md:max-h-none"
            data-cy="knowledge-graph-loaded-relationships"
          >
            <h2
              id="knowledge-graph-loaded-relationships-heading"
              className="mb-2 text-sm font-semibold text-[#121212]"
            >
              {labels.loadedRelationships(relationshipEntries.length)}
            </h2>
            {relationshipEntries.length === 0 ? (
              <p className="text-sm text-[#4C4C4C]">
                {labels.noRelationshipsLoaded}
              </p>
            ) : (
              <ul className="space-y-1">
                {relationshipEntries.map(({ edge, source, target }) => (
                  <li key={edge.id}>
                    <button
                      type="button"
                      aria-label={labels.selectRelationshipAriaLabel(
                        source,
                        target,
                        edge.label
                      )}
                      aria-pressed={state.selectedEdgeId === edge.id}
                      onClick={() =>
                        dispatch({
                          type: 'select-edge',
                          edgeId: edge.id,
                          announcement: labels.selectedRelationshipAnnouncement,
                        })
                      }
                      className="min-h-11 w-full rounded px-3 py-2 text-left text-sm text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5] aria-pressed:bg-[#F5F5FB] aria-pressed:text-[#0028A5]"
                    >
                      <span className="block font-semibold">
                        {source} → {target}
                      </span>
                      <span className="block text-[#4C4C4C]">{edge.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <KnowledgeGraphDetails
        node={selectedNode}
        edge={selectedEdge}
        edgeEndpoints={selectedEdgeEndpoints}
        isExpanding={isExpanding}
        labels={labels.details}
        onClose={() =>
          dispatch({
            type: 'close-details',
            announcement: labels.detailsClosedAnnouncement,
          })
        }
        onExpand={(nodeId) => void expandNode(nodeId)}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
    </section>
  )
}

export default KnowledgeGraphViewer

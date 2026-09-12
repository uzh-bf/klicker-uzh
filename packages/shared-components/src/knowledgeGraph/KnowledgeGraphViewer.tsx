'use client'

import type { KnowledgeGraphResponse } from '@klicker-uzh/types'
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
  CYTOSCAPE_STYLE,
  cytoscapeEdgeId,
  cytoscapeNodeId,
  edgeDefinition,
  kindStyle,
  nodeDefinition,
} from './knowledgeGraphCytoscape'
import {
  type KnowledgeGraphViewerLabelOverrides,
  type KnowledgeGraphViewerLabels,
  resolveKnowledgeGraphLabels,
} from './knowledgeGraphLabels'
import {
  isKnowledgeGraphSubmitQuery,
  isKnowledgeGraphSuggestionQuery,
  KNOWLEDGE_GRAPH_SUGGESTION_DEBOUNCE_MS,
  normalizeKnowledgeGraphQuery,
} from './knowledgeGraphSearch'
import {
  initialKnowledgeGraphState,
  isKnowledgeGraphBuildChangedError,
  type KnowledgeGraphDataSource,
  type KnowledgeGraphNeighborOrigin,
  type KnowledgeGraphRequestOperation,
  type KnowledgeGraphState,
  KnowledgeGraphUnavailableError,
  knowledgeGraphReducer,
} from './knowledgeGraphState'
import {
  edgeAskSelection,
  KNOWLEDGE_GRAPH_MAX_ZOOM,
  KNOWLEDGE_GRAPH_MIN_ZOOM,
  type KnowledgeGraphAskSelection,
  nextKnowledgeGraphZoom,
  nodeAskSelection,
  relationshipLabels,
} from './knowledgeGraphView'

type KnowledgeGraphViewerProps = {
  dataSource: KnowledgeGraphDataSource
  className?: string
  unavailableMessage?: string
  labels?: KnowledgeGraphViewerLabelOverrides
  /** 'search' opens the search entry without automatically fetching an overview. */
  initialView?: 'overview' | 'search'
  /** Enables the debounced suggestion combobox; the lecturer entry keeps it off. */
  searchSuggestions?: boolean
  /** Shows the overview entry's return control once the view is focused. */
  overviewNavigation?: boolean
  /** Emits the bounded ask payload for the selected concept or relationship. */
  onAsk?: (selection: KnowledgeGraphAskSelection) => void
  /** Label of the ask control; the details pane falls back to its own default. */
  askLabel?: string
  /** 'contained' overlays the details pane inside the graph. */
  detailsLayout?: 'sidebar' | 'contained'
  /** Keeps the current zoom and pan when the canvas container resizes. */
  preserveViewportOnResize?: boolean
}

function fitGraphElements(cy: cytoscape.Core) {
  if (cy.elements().empty()) return
  cy.fit(cy.elements(), 40)
  // A small neighborhood should not magnify labels beyond their normal size.
  if (cy.zoom() > 1) {
    cy.zoom(1)
    cy.center()
  }
}

function isUnavailableError(error: unknown): boolean {
  if (error instanceof KnowledgeGraphUnavailableError) {
    return true
  }

  if (isKnowledgeGraphBuildChangedError(error)) {
    return false
  }

  if (typeof error !== 'object' || error === null) {
    return false
  }

  const candidate = error as { code?: unknown; status?: unknown }
  return candidate.code === 'UNAVAILABLE' || candidate.status === 409
}

type KnowledgeGraphRequestOutcome =
  | { status: 'succeeded'; response: KnowledgeGraphResponse }
  | { status: 'stale' }
  | { status: 'build-changed' }
  | { status: 'failed' }

function neighborOrigin(
  state: KnowledgeGraphState
): KnowledgeGraphNeighborOrigin | undefined {
  if (state.kbId === null || state.buildId === null) {
    return undefined
  }
  return { kbId: state.kbId, buildId: state.buildId }
}

function suggestionOptionId(index: number): string {
  return `knowledge-graph-suggestion-${index}`
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
  initialView = 'overview',
  searchSuggestions = false,
  overviewNavigation = false,
  onAsk,
  askLabel,
  detailsLayout = 'sidebar',
  preserveViewportOnResize = false,
}: KnowledgeGraphViewerProps) {
  const searchFirst = initialView === 'search'
  const initialViewRef = useRef(initialView)
  initialViewRef.current = initialView
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
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1)
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
  const renderedBuildIdRef = useRef<string | null>(null)
  const expansionOriginRef = useRef<string | null>(null)
  const pendingFocusRef = useRef<string | null>(null)
  const prefersReducedMotionRef = useRef(false)
  const preserveViewportOnResizeRef = useRef(preserveViewportOnResize)
  const expandNodeRef = useRef<(nodeId: string) => void>(() => undefined)
  const labelsRef = useRef(labels)
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const suggestionRequestIdRef = useRef(0)
  const suggestionInFlightRef = useRef(false)
  const pendingSuggestionRef = useRef<{
    requestId: number
    query: string
  } | null>(null)
  const executeSuggestionRequestRef = useRef<
    (requestId: number, query: string) => Promise<void>
  >(async () => undefined)
  const composingRef = useRef(false)
  const layoutTokenRef = useRef(0)
  const activeLayoutRef = useRef<{ stop: () => void } | null>(null)
  const recoverFromBuildChangeRef = useRef<() => void>(() => undefined)

  dataSourceRef.current = dataSource
  stateRef.current = state
  labelsRef.current = labels
  preserveViewportOnResizeRef.current = preserveViewportOnResize

  const cancelSuggestions = useCallback(() => {
    if (suggestionTimerRef.current !== null) {
      clearTimeout(suggestionTimerRef.current)
      suggestionTimerRef.current = null
    }
    pendingSuggestionRef.current = null
    // Invalidating the id drops a response that is still in flight.
    suggestionRequestIdRef.current += 1
    dispatch({ type: 'dismiss-suggestions' })
  }, [])

  const beginViewRequest = useCallback(() => {
    latestRequestIdsRef.current = {
      overview: null,
      search: null,
      neighbors: null,
    }
    pendingFocusRef.current = null
    activeLayoutRef.current?.stop()
    activeLayoutRef.current = null
    layoutTokenRef.current += 1
    cancelSuggestions()
  }, [cancelSuggestions])

  const executeSuggestionRequest = useCallback(
    async (requestId: number, query: string) => {
      if (suggestionRequestIdRef.current !== requestId) {
        return
      }

      const sourceGeneration = sourceGenerationRef.current
      suggestionInFlightRef.current = true
      try {
        const graphResponse = await dataSourceRef.current.search(query)
        if (
          sourceGenerationRef.current === sourceGeneration &&
          suggestionRequestIdRef.current === requestId
        ) {
          dispatch({
            type: 'suggestions-succeeded',
            requestId,
            response: graphResponse,
          })
        }
      } catch {
        if (
          sourceGenerationRef.current === sourceGeneration &&
          suggestionRequestIdRef.current === requestId
        ) {
          dispatch({
            type: 'suggestions-failed',
            requestId,
          })
        }
      } finally {
        suggestionInFlightRef.current = false
        const pending = pendingSuggestionRef.current
        pendingSuggestionRef.current = null
        if (pending !== null) {
          void executeSuggestionRequestRef.current(
            pending.requestId,
            pending.query
          )
        }
      }
    },
    []
  )
  executeSuggestionRequestRef.current = executeSuggestionRequest

  const queueSuggestionRequest = useCallback(
    (requestId: number, query: string) => {
      if (suggestionRequestIdRef.current !== requestId) {
        return
      }
      if (suggestionInFlightRef.current) {
        // Only the latest pending query survives while a request is in flight.
        pendingSuggestionRef.current = { requestId, query }
        return
      }
      void executeSuggestionRequestRef.current(requestId, query)
    },
    []
  )

  const scheduleSuggestions = useCallback(
    (raw: string) => {
      // Typing invalidates the previous query right away, so a response for the
      // old text cannot surface during the debounce window.
      cancelSuggestions()

      const query = normalizeKnowledgeGraphQuery(raw)
      if (!isKnowledgeGraphSuggestionQuery(query)) {
        return
      }

      suggestionTimerRef.current = setTimeout(() => {
        suggestionTimerRef.current = null
        const requestId = ++suggestionRequestIdRef.current
        dispatch({ type: 'suggestions-started', requestId })
        queueSuggestionRequest(requestId, query)
      }, KNOWLEDGE_GRAPH_SUGGESTION_DEBOUNCE_MS)
    },
    [cancelSuggestions, queueSuggestionRequest]
  )

  const runRequest = useCallback(
    async (
      operation: KnowledgeGraphRequestOperation,
      input: string | null,
      request: () => ReturnType<KnowledgeGraphDataSource['overview']>,
      origin?: KnowledgeGraphNeighborOrigin
    ): Promise<KnowledgeGraphRequestOutcome> => {
      const requestId = ++requestIdRef.current
      const sourceGeneration = sourceGenerationRef.current
      latestRequestIdsRef.current[operation] = requestId
      dispatch({
        type: 'request-started',
        operation,
        requestId,
        ...(input === null ? {} : { input }),
      })

      const isCurrent = () =>
        sourceGenerationRef.current === sourceGeneration &&
        latestRequestIdsRef.current[operation] === requestId

      try {
        const graphResponse = await request()
        if (!isCurrent()) {
          return { status: 'stale' }
        }
        if (
          operation === 'neighbors' &&
          origin !== undefined &&
          (graphResponse.kbId !== origin.kbId ||
            graphResponse.buildId !== origin.buildId)
        ) {
          // A neighbor response from another build is never merged into the
          // current view; the viewer reloads the overview instead.
          return { status: 'build-changed' }
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
        return { status: 'succeeded', response: graphResponse }
      } catch (error) {
        if (!isCurrent()) {
          return { status: 'stale' }
        }
        if (
          operation === 'neighbors' &&
          isKnowledgeGraphBuildChangedError(error)
        ) {
          return { status: 'build-changed' }
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
        return { status: 'failed' }
      }
    },
    [resolvedUnavailableMessage]
  )

  const loadOverview = useCallback(async () => {
    const outcome = await runRequest('overview', null, () =>
      dataSourceRef.current.overview()
    )
    return outcome
  }, [runRequest])

  const expandNode = useCallback(
    async (nodeId: string, origin: KnowledgeGraphNeighborOrigin) => {
      expansionOriginRef.current = nodeId
      const loadedNodeIds = new Set(
        stateRef.current.nodes.map((node) => node.id)
      )
      const outcome = await runRequest(
        'neighbors',
        nodeId,
        () => dataSourceRef.current.neighbors(nodeId, origin),
        origin
      )
      if (outcome.status === 'build-changed') {
        recoverFromBuildChangeRef.current()
        return
      }
      if (outcome.status !== 'succeeded') {
        if (expansionOriginRef.current === nodeId) {
          expansionOriginRef.current = null
        }
        return
      }
      const hasNewNodes = outcome.response.nodes.some(
        (node) => node.id !== nodeId && !loadedNodeIds.has(node.id)
      )
      if (!hasNewNodes && expansionOriginRef.current === nodeId) {
        expansionOriginRef.current = null
      }
    },
    [runRequest]
  )
  expandNodeRef.current = (nodeId) => {
    const origin = neighborOrigin(stateRef.current)
    if (origin !== undefined) {
      void expandNode(nodeId, origin)
    }
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
    activeLayoutRef.current?.stop()
    activeLayoutRef.current = null
    layoutTokenRef.current += 1
    cancelSuggestions()
    stateRef.current = initialKnowledgeGraphState
    positionsRef.current.clear()
    renderedBuildIdRef.current = null
    expansionOriginRef.current = null
    pendingFocusRef.current = null
    cyRef.current?.elements().remove()
    setSearchQuery('')
    setActiveSuggestionIndex(-1)
    dispatch({ type: 'reset' })
    if (initialViewRef.current !== 'search') {
      void loadOverview()
    }
  }, [dataSource, loadOverview, cancelSuggestions])

  useEffect(() => {
    return () => {
      // Unmounting invalidates every pending callback: the source generation
      // stops late requests from dispatching and the timers are cleared.
      // Clearing the mounted source re-runs the initial load when React
      // re-mounts the same source, which is what Strict Mode does.
      mountedDataSourceRef.current = null
      sourceGenerationRef.current += 1
      latestRequestIdsRef.current = {
        overview: null,
        search: null,
        neighbors: null,
      }
      if (suggestionTimerRef.current !== null) {
        clearTimeout(suggestionTimerRef.current)
        suggestionTimerRef.current = null
      }
      suggestionRequestIdRef.current += 1
      pendingSuggestionRef.current = null
      activeLayoutRef.current?.stop()
      activeLayoutRef.current = null
    }
  }, [])

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
        : new ResizeObserver(() => {
            cy.resize()
            // A host that swaps the viewer between its docked and fullscreen
            // slot keeps the zoom and pan it had; the default lecture view
            // still refits the graph on every resize.
            if (!preserveViewportOnResizeRef.current) {
              fitGraphElements(cy)
            }
          })
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

    activeLayoutRef.current?.stop()
    activeLayoutRef.current = null
    layoutTokenRef.current += 1
    cy.nodes().forEach((node) => {
      positionsRef.current.set(String(node.data('graphId')), node.position())
    })

    const buildChanged = renderedBuildIdRef.current !== state.buildId
    if (buildChanged) {
      cy.elements().remove()
      positionsRef.current.clear()
      renderedBuildIdRef.current = state.buildId
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

    const isInitialLayout = buildChanged
    if (!isInitialLayout) {
      // Keep added neighbors around their origin. An isolated subset layout
      // recenters them at zero and can overlap already positioned concepts.
      newNodes.forEach((node) => {
        positionsRef.current.set(String(node.data('graphId')), node.position())
      })
      fitGraphElements(cy)
      expansionOriginRef.current = null
      return
    }
    const layout = cy.elements().layout({
      name: 'cose',
      animate: false,
      randomize: isInitialLayout,
      fit: false,
      padding: 30,
      nodeRepulsion: 6_000,
      idealEdgeLength: 90,
    })
    const layoutToken = layoutTokenRef.current
    activeLayoutRef.current = layout
    layout.one('layoutstop', () => {
      activeLayoutRef.current = null
      if (layoutTokenRef.current !== layoutToken) {
        return
      }
      cy.nodes().forEach((node) => {
        positionsRef.current.set(String(node.data('graphId')), node.position())
      })
      if (isInitialLayout) {
        fitGraphElements(cy)
      }
    })
    layout.run()
    if (expansionOriginWasLoaded) {
      expansionOriginRef.current = null
    }
  }, [state.buildId, state.edges, state.nodes])

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
  let askSelection: KnowledgeGraphAskSelection | undefined
  if (selectedNode !== undefined) {
    askSelection = nodeAskSelection(selectedNode)
  } else if (selectedEdge !== undefined) {
    askSelection = edgeAskSelection(
      selectedEdge,
      indexes.nodes,
      labels.details.missingEndpoint
    )
  }
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
      beginViewRequest()
      setActiveSuggestionIndex(-1)
      const outcome = await runRequest('search', query, () =>
        dataSourceRef.current.search(query)
      )
      if (outcome.status !== 'succeeded') {
        return
      }
      const firstResult = outcome.response.nodes[0]
      if (firstResult === undefined) {
        return
      }

      pendingFocusRef.current = firstResult.id
      await expandNode(firstResult.id, {
        kbId: outcome.response.kbId,
        buildId: outcome.response.buildId,
      })
    },
    [beginViewRequest, expandNode, runRequest]
  )

  async function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (composingRef.current) return
    const query = normalizeKnowledgeGraphQuery(searchQuery)
    if (!isKnowledgeGraphSubmitQuery(query)) {
      return
    }

    await searchGraph(query)
  }

  function handleQueryChange(value: string) {
    setSearchQuery(value)
    setActiveSuggestionIndex(-1)
    if (searchSuggestions && !composingRef.current) {
      scheduleSuggestions(value)
    }
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (!searchSuggestions) {
      return
    }
    // A composition key press never navigates or selects a suggestion.
    if (composingRef.current || event.nativeEvent.isComposing) {
      return
    }

    if (event.key === 'Escape') {
      event.preventDefault()
      cancelSuggestions()
      setActiveSuggestionIndex(-1)
      return
    }

    if (event.key === 'ArrowDown') {
      if (state.suggestions.length === 0) {
        return
      }
      event.preventDefault()
      setActiveSuggestionIndex((index) =>
        index + 1 >= state.suggestions.length ? 0 : index + 1
      )
      return
    }

    if (event.key === 'ArrowUp') {
      if (state.suggestions.length === 0) {
        return
      }
      event.preventDefault()
      setActiveSuggestionIndex((index) =>
        index <= 0 ? state.suggestions.length - 1 : index - 1
      )
      return
    }

    if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      if (state.suggestions[activeSuggestionIndex] === undefined) {
        return
      }
      event.preventDefault()
      void selectSuggestion(activeSuggestionIndex)
    }
  }

  async function selectSuggestion(index: number) {
    const suggestion = state.suggestions[index]
    const response = state.suggestionResponse
    if (suggestion === undefined || response === null) {
      return
    }

    // The suggestion keeps its originating build and node id; its label is
    // never used to refetch the concept.
    beginViewRequest()
    setActiveSuggestionIndex(-1)
    positionsRef.current.clear()
    // A selected concept replaces the view, so it always fits the canvas.
    renderedBuildIdRef.current = null
    pendingFocusRef.current = suggestion.id
    dispatch({
      type: 'select-suggestion',
      response,
      nodeId: suggestion.id,
      announcement: labels.selectedConceptAnnouncement(suggestion.displayLabel),
    })
    await expandNode(suggestion.id, {
      kbId: response.kbId,
      buildId: response.buildId,
    })
  }

  const resetToOverview = useCallback(() => {
    beginViewRequest()
    setSearchQuery('')
    setActiveSuggestionIndex(-1)
    positionsRef.current.clear()
    renderedBuildIdRef.current = null
    expansionOriginRef.current = null
    dispatch({ type: 'reset' })
    void loadOverview()
  }, [beginViewRequest, loadOverview])
  recoverFromBuildChangeRef.current = resetToOverview

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
      expandNodeRef.current(failedRequest.input)
    }
  }

  function fitGraph() {
    const cy = cyRef.current
    if (cy !== null && !cy.elements().empty()) {
      fitGraphElements(cy)
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
  const suggestionOptions = searchSuggestions ? state.suggestions : []
  const suggestionsOpen = searchSuggestions && state.suggestionStatus !== 'idle'
  const activeSuggestionId =
    suggestionsOpen &&
    activeSuggestionIndex >= 0 &&
    activeSuggestionIndex < suggestionOptions.length
      ? suggestionOptionId(activeSuggestionIndex)
      : undefined
  const showOverviewControl = overviewNavigation && state.view === 'focused'

  const sectionMinHeight =
    detailsLayout === 'contained' ? 'min-h-0' : 'min-h-[32rem]'
  const canvasMinHeight = detailsLayout === 'contained' ? 'min-h-0' : 'min-h-80'

  return (
    <section
      aria-label={labels.explorerAriaLabel}
      className={`relative flex h-full w-full min-w-0 overflow-hidden rounded-lg border border-[#E9E9E9] bg-white ${sectionMinHeight} ${className}`}
      data-cy="knowledge-graph-viewer"
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="border-b border-[#E9E9E9] bg-white p-3 md:p-4">
          {showOverviewControl ? (
            <div className="mb-2 flex">
              <button
                type="button"
                onClick={resetToOverview}
                className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
                data-cy="knowledge-graph-back-to-overview"
              >
                {labels.backToOverview}
              </button>
            </div>
          ) : null}

          <form
            role="search"
            aria-label={labels.searchAriaLabel}
            onSubmit={(event) => void handleSearch(event)}
            className="flex gap-2"
          >
            <label htmlFor="knowledge-graph-search" className="sr-only">
              {labels.searchLabel}
            </label>
            <div className="relative min-w-0 flex-1">
              {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: The input is the ARIA 1.2 combobox. The rule reads the implicit searchbox role and misses the conditionally rendered role below. */}
              <input
                id="knowledge-graph-search"
                type="search"
                value={searchQuery}
                minLength={1}
                maxLength={100}
                role={searchSuggestions ? 'combobox' : undefined}
                aria-expanded={searchSuggestions ? suggestionsOpen : undefined}
                aria-controls={
                  searchSuggestions ? 'knowledge-graph-suggestions' : undefined
                }
                aria-activedescendant={activeSuggestionId}
                aria-autocomplete={searchSuggestions ? 'list' : undefined}
                aria-haspopup={searchSuggestions ? 'listbox' : undefined}
                onChange={(event) => handleQueryChange(event.target.value)}
                onKeyDown={handleInputKeyDown}
                onCompositionStart={() => {
                  composingRef.current = true
                  cancelSuggestions()
                }}
                onCompositionEnd={(event) => {
                  composingRef.current = false
                  // IME commits bypass the change handler on some platforms, so
                  // the committed text schedules the debounced suggestions.
                  if (searchSuggestions) {
                    scheduleSuggestions(event.currentTarget.value)
                  }
                }}
                onBlur={() => {
                  if (searchSuggestions) {
                    cancelSuggestions()
                  }
                }}
                placeholder={labels.searchPlaceholder}
                className="min-h-11 w-full rounded border border-[#E9E9E9] px-3 py-2 text-base text-[#121212] placeholder:text-[#666666] focus:border-[#0028A5] focus:outline-none focus:ring-2 focus:ring-[#BDC9E8]"
                data-cy="knowledge-graph-search"
              />
              {suggestionsOpen ? (
                suggestionOptions.length === 0 ? (
                  <p
                    role="status"
                    className="absolute z-20 mt-1 w-full rounded border border-[#E9E9E9] bg-white px-3 py-2 text-sm text-[#4C4C4C] shadow-lg"
                    data-cy="knowledge-graph-suggestions-status"
                  >
                    {state.suggestionStatus === 'error'
                      ? labels.suggestionsUnavailable
                      : state.suggestionStatus === 'loading'
                        ? labels.searching
                        : labels.noSuggestions}
                  </p>
                ) : (
                  <div
                    role="listbox"
                    id="knowledge-graph-suggestions"
                    aria-label={labels.suggestionsAriaLabel}
                    className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded border border-[#E9E9E9] bg-white py-1 shadow-lg"
                    data-cy="knowledge-graph-suggestions"
                  >
                    {suggestionOptions.map((node, index) => (
                      <div
                        key={node.id}
                        id={suggestionOptionId(index)}
                        role="option"
                        aria-selected={index === activeSuggestionIndex}
                        tabIndex={-1}
                        onMouseDown={(event) => {
                          // Selecting on pointer press keeps the combobox
                          // focused and runs before the blur a click causes.
                          event.preventDefault()
                          void selectSuggestion(index)
                        }}
                        className={`min-h-11 cursor-pointer px-3 py-2 text-sm text-[#121212] ${
                          index === activeSuggestionIndex ? 'bg-[#F5F5FB]' : ''
                        }`}
                        data-cy="knowledge-graph-suggestion"
                      >
                        <span className="font-semibold">
                          {node.displayLabel}
                        </span>
                        <span className="block text-[#4C4C4C]">
                          {node.kind}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              ) : null}
            </div>
            <button
              type="submit"
              data-cy="knowledge-graph-search-submit"
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

          {state.viewLimitReached ? (
            <p
              className="mt-2 text-sm text-[#4C4C4C]"
              role="note"
              data-cy="knowledge-graph-view-limit"
            >
              {labels.viewLimitNotice}
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

        <div className={`relative flex-1 bg-[#FAFAFA] ${canvasMinHeight}`}>
          <div
            id="knowledge-graph-canvas"
            ref={containerRef}
            role="img"
            aria-label={labels.canvasAriaLabel}
            className="h-full w-full"
          />

          <div
            className={`absolute left-3 right-3 top-3 flex flex-wrap gap-2 ${detailsLayout === 'contained' ? '' : 'md:right-auto'}`}
          >
            <button
              type="button"
              onClick={() => changeZoom(1.25)}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              aria-label={labels.zoomInAriaLabel}
              data-cy="knowledge-graph-zoom-in"
            >
              {detailsLayout === 'contained' ? '+' : labels.zoomIn}
            </button>
            <button
              type="button"
              onClick={() => changeZoom(0.8)}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              aria-label={labels.zoomOutAriaLabel}
              data-cy="knowledge-graph-zoom-out"
            >
              {detailsLayout === 'contained' ? '−' : labels.zoomOut}
            </button>
            <button
              type="button"
              onClick={fitGraph}
              aria-label={labels.fitView}
              title={labels.fitView}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              data-cy="knowledge-graph-fit"
            >
              {detailsLayout === 'contained' ? '↗' : labels.fitView}
            </button>
            <button
              type="button"
              onClick={resetLayout}
              aria-label={labels.resetLayout}
              title={labels.resetLayout}
              className="min-h-11 rounded-full border border-[#E9E9E9] bg-white px-4 text-sm font-semibold text-[#121212] shadow-sm hover:bg-[#F5F5FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0028A5]"
              data-cy="knowledge-graph-reset"
            >
              {detailsLayout === 'contained' ? '↺' : labels.resetLayout}
            </button>
          </div>

          {legendEntries.length === 0 ? null : (
            <div
              aria-label={labels.legendAriaLabel}
              className={`absolute bottom-3 right-3 hidden max-w-48 rounded-lg border border-[#E9E9E9] bg-white/95 p-3 text-xs text-[#121212] shadow-sm ${detailsLayout === 'contained' ? '' : 'sm:block md:bottom-auto md:top-3'}`}
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

          {state.status === 'loading' ||
          (state.status === 'idle' && !searchFirst) ? (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center text-[#4C4C4C]"
            >
              {labels.loading}
            </div>
          ) : null}

          {state.status === 'idle' && searchFirst ? (
            <div
              role="status"
              className="absolute inset-0 flex items-center justify-center bg-white/90 p-6 text-center text-[#4C4C4C]"
            >
              {labels.searchFirstPrompt}
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
          className={`grid shrink-0 grid-cols-1 overflow-y-auto border-t border-[#E9E9E9] bg-white ${detailsLayout === 'contained' ? 'max-h-24 lg:max-h-44 lg:h-44' : 'max-h-64 md:h-56 md:overflow-hidden'} ${state.searchResults.length === 0 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
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
                      data-cy="knowledge-graph-search-result"
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
                      data-cy="knowledge-graph-loaded-node"
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
                      data-cy="knowledge-graph-loaded-relationship"
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
        layout={detailsLayout}
        onClose={() =>
          dispatch({
            type: 'close-details',
            announcement: labels.detailsClosedAnnouncement,
          })
        }
        onExpand={(nodeId) => expandNodeRef.current(nodeId)}
        onAsk={onAsk}
        askLabel={askLabel}
        askSelection={askSelection}
      />

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {state.announcement}
      </p>
    </section>
  )
}

export default KnowledgeGraphViewer

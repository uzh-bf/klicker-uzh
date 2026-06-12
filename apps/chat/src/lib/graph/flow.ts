import type { ChatbotGraphSnapshot } from '@klicker-uzh/falkordb'
import type { Edge, Node } from '@xyflow/react'

type GraphNodeData = {
  accent: string
  formula?: string
  isDimmed: boolean
  isRelated: boolean
  isSelected: boolean
  kind?: string
  label: string
  summary?: string
}

export type ChatbotGraphFlowNode = Node<GraphNodeData>
export type ChatbotGraphFlowEdge = Edge

export type ChatbotGraphFlowOptions = {
  selectedNodeId?: string
}

export type ChatbotGraphFlow = {
  edges: ChatbotGraphFlowEdge[]
  nodes: ChatbotGraphFlowNode[]
}

const TOPIC_RADIUS = 260
const CONCEPT_RADIUS = 150
const DETAIL_RADIUS = 105
const FALLBACK_RADIUS = 430
const HIERARCHY_EDGE_COLOR = '#2563eb'
const FOCUS_EDGE_COLOR = '#0f766e'
const DEPENDENCY_EDGE_TYPES = new Set(['DEPENDS_ON', 'USES'])
const TOPIC_EDGE_TYPES = ['HAS_TOPIC']
const CONCEPT_EDGE_TYPES = ['HAS_CONCEPT']
const DETAIL_EDGE_TYPES = [
  'HAS_FORMULA',
  'EXAMPLE_OF',
  'DEPENDS_ON',
  'EXPLAINS',
]

const NODE_ACCENT_BY_KIND: Record<string, string> = {
  assumption: '#f43f5e',
  concept: '#0f3fbd',
  domain: '#0028a5',
  example: '#10b981',
  explanation: '#7c3aed',
  formula: '#67e8f9',
  topic: '#1d4ed8',
}

export function mapGraphSnapshotToFlow(
  snapshot: ChatbotGraphSnapshot,
  options: ChatbotGraphFlowOptions = {}
): ChatbotGraphFlow {
  const selectedNodeId = getSelectedNodeId(snapshot, options.selectedNodeId)
  const hierarchy = createGraphHierarchy(snapshot)
  const selectedRelationEdges = getSelectedRelationEdges(
    snapshot,
    selectedNodeId,
    hierarchy.edges
  )
  const displayEdges = uniqueEdges([
    ...hierarchy.edges,
    ...selectedRelationEdges,
  ])
  const relatedNodeIds = getRelatedNodeIds(displayEdges, selectedNodeId)
  const nodePositions = createNodePositions(snapshot, hierarchy)
  const hierarchyEdgeIds = new Set(hierarchy.edges.map((edge) => edge.id))
  const selectedRelationEdgeIds = new Set(
    selectedRelationEdges.map((edge) => edge.id)
  )
  const nodes = snapshot.nodes.map<ChatbotGraphFlowNode>((node) => {
    const kind = node.kind ?? 'concept'
    const isSelected = node.id === selectedNodeId
    const isRelated = relatedNodeIds.has(node.id)
    const hasSelection = Boolean(selectedNodeId)

    return {
      id: node.id,
      data: {
        accent: NODE_ACCENT_BY_KIND[kind] ?? NODE_ACCENT_BY_KIND.concept,
        formula: node.formula,
        isDimmed: hasSelection && !isSelected && !isRelated,
        isRelated,
        isSelected,
        kind,
        label: node.label,
        summary: node.summary,
      },
      origin: [0.5, 0.5],
      position: nodePositions.get(node.id) ?? { x: 0, y: 0 },
      style: { background: 'transparent', border: 0, padding: 0 },
      type: 'concept',
    }
  })

  const edges = displayEdges.map<ChatbotGraphFlowEdge>((edge) => {
    const isDependencyEdge = DEPENDENCY_EDGE_TYPES.has(edge.type)
    const isFocusRelationEdge =
      selectedRelationEdgeIds.has(edge.id) && !hierarchyEdgeIds.has(edge.id)
    const isRelated =
      !selectedNodeId ||
      edge.source === selectedNodeId ||
      edge.target === selectedNodeId

    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'straight',
      animated: Boolean(selectedNodeId) && isRelated && isDependencyEdge,
      label: isFocusRelationEdge ? edge.label : undefined,
      labelBgPadding: [4, 2],
      labelBgStyle: {
        fill: '#f8fafc',
        fillOpacity: 0.95,
      },
      labelStyle: {
        fill: '#334155',
        fontSize: 10,
        fontWeight: 600,
      },
      style: {
        opacity: selectedNodeId ? (isRelated ? 1 : 0.2) : 0.85,
        stroke:
          isFocusRelationEdge && isRelated
            ? FOCUS_EDGE_COLOR
            : !selectedNodeId || isRelated
              ? HIERARCHY_EDGE_COLOR
              : '#d8dee9',
        strokeDasharray:
          Boolean(selectedNodeId) && isRelated && isDependencyEdge
            ? '6 5'
            : undefined,
        strokeWidth: isRelated ? 2.25 : 1.25,
      },
    }
  })

  return {
    edges,
    nodes,
  }
}

function getSelectedNodeId(
  snapshot: ChatbotGraphSnapshot,
  selectedNodeId: string | undefined
): string | undefined {
  if (
    selectedNodeId &&
    snapshot.nodes.some((node) => node.id === selectedNodeId)
  ) {
    return selectedNodeId
  }

  return undefined
}

function getRelatedNodeIds(
  edges: ChatbotGraphSnapshot['edges'],
  selectedNodeId: string | undefined
): Set<string> {
  const relatedNodeIds = new Set<string>()
  if (!selectedNodeId) return relatedNodeIds

  for (const edge of edges) {
    if (edge.source === selectedNodeId) {
      relatedNodeIds.add(edge.target)
    }
    if (edge.target === selectedNodeId) {
      relatedNodeIds.add(edge.source)
    }
  }

  return relatedNodeIds
}

type GraphHierarchy = {
  conceptNodesByTopicId: Map<string, ChatbotGraphSnapshot['nodes']>
  detailNodesByConceptId: Map<string, ChatbotGraphSnapshot['nodes']>
  edges: ChatbotGraphSnapshot['edges']
  rootNode?: ChatbotGraphSnapshot['nodes'][number]
  topicNodes: ChatbotGraphSnapshot['nodes']
}

function createGraphHierarchy(snapshot: ChatbotGraphSnapshot): GraphHierarchy {
  const rootNode = getRootNode(snapshot)
  if (!rootNode) {
    return {
      conceptNodesByTopicId: new Map(),
      detailNodesByConceptId: new Map(),
      edges: [],
      topicNodes: [],
    }
  }

  const hierarchyEdges: ChatbotGraphSnapshot['edges'] = []
  const topicNodes = getPrimaryTopicNodes(snapshot, rootNode.id)
  const conceptNodesByTopicId = new Map<string, ChatbotGraphSnapshot['nodes']>()
  const detailNodesByConceptId = new Map<
    string,
    ChatbotGraphSnapshot['nodes']
  >()

  for (const topicNode of topicNodes) {
    const topicEdge = findHierarchyEdge(snapshot, rootNode.id, topicNode.id, [
      ...TOPIC_EDGE_TYPES,
    ])
    if (topicEdge) hierarchyEdges.push(topicEdge)

    const conceptNodes = getConceptNodesForTopic(snapshot, topicNode.id)
    conceptNodesByTopicId.set(topicNode.id, conceptNodes)

    for (const conceptNode of conceptNodes) {
      const conceptEdge = findHierarchyEdge(
        snapshot,
        topicNode.id,
        conceptNode.id,
        CONCEPT_EDGE_TYPES
      )
      if (conceptEdge) hierarchyEdges.push(conceptEdge)

      const detailNodes = getDetailNodesForConcept(snapshot, conceptNode.id)
      detailNodesByConceptId.set(conceptNode.id, detailNodes)

      for (const detailNode of detailNodes) {
        const detailEdge = findHierarchyEdge(
          snapshot,
          conceptNode.id,
          detailNode.id,
          DETAIL_EDGE_TYPES
        )
        if (detailEdge) hierarchyEdges.push(detailEdge)
      }
    }
  }

  return {
    conceptNodesByTopicId,
    detailNodesByConceptId,
    edges: uniqueEdges(hierarchyEdges),
    rootNode,
    topicNodes,
  }
}

function createNodePositions(
  snapshot: ChatbotGraphSnapshot,
  hierarchy: GraphHierarchy
) {
  const positions = new Map<string, { x: number; y: number }>()
  const rootNode = hierarchy.rootNode
  if (!rootNode) return positions

  positions.set(rootNode.id, { x: 0, y: 0 })

  const topicNodes = hierarchy.topicNodes
  topicNodes.forEach((topicNode, index) => {
    const angle = getRingAngle(index, topicNodes.length, -Math.PI / 2)
    positions.set(topicNode.id, polarToPoint(TOPIC_RADIUS, angle))

    const conceptNodes = hierarchy.conceptNodesByTopicId.get(topicNode.id) ?? []
    placeChildrenAroundParent(
      positions,
      conceptNodes,
      topicNode.id,
      angle,
      CONCEPT_RADIUS
    )

    conceptNodes.forEach((conceptNode, conceptIndex) => {
      const conceptAngle = angleForChild(
        angle,
        conceptIndex,
        conceptNodes.length
      )
      const detailNodes =
        hierarchy.detailNodesByConceptId.get(conceptNode.id) ?? []
      placeChildrenAroundParent(
        positions,
        detailNodes,
        conceptNode.id,
        conceptAngle,
        DETAIL_RADIUS
      )
    })
  })

  const unplacedNodes = snapshot.nodes.filter((node) => !positions.has(node.id))
  unplacedNodes.forEach((node, index) => {
    positions.set(
      node.id,
      polarToPoint(FALLBACK_RADIUS, getRingAngle(index, unplacedNodes.length))
    )
  })

  return positions
}

function getRootNode(snapshot: ChatbotGraphSnapshot) {
  return (
    snapshot.nodes.find((node) => node.depth === 0) ??
    snapshot.nodes.find((node) => node.label.toLowerCase() === 'finance') ??
    snapshot.nodes[0]
  )
}

function getPrimaryTopicNodes(
  snapshot: ChatbotGraphSnapshot,
  rootNodeId: string
) {
  const rootNeighbors = getConnectedNodes(
    snapshot,
    rootNodeId,
    TOPIC_EDGE_TYPES
  )
  const depthOneNeighbors = rootNeighbors.filter((node) => node.depth === 1)

  if (depthOneNeighbors.length > 0) {
    return depthOneNeighbors
  }

  return rootNeighbors
}

function getConceptNodesForTopic(
  snapshot: ChatbotGraphSnapshot,
  topicNodeId: string
) {
  return getConnectedNodes(snapshot, topicNodeId, CONCEPT_EDGE_TYPES).filter(
    (node) => {
      return node.depth === 2 || node.kind === 'concept'
    }
  )
}

function getDetailNodesForConcept(
  snapshot: ChatbotGraphSnapshot,
  conceptNodeId: string
) {
  return getConnectedNodes(snapshot, conceptNodeId, DETAIL_EDGE_TYPES).filter(
    (node) => {
      return (
        node.depth === 3 ||
        node.kind === 'assumption' ||
        node.kind === 'example' ||
        node.kind === 'explanation' ||
        node.kind === 'formula'
      )
    }
  )
}

function getConnectedNodes(
  snapshot: ChatbotGraphSnapshot,
  nodeId: string,
  edgeTypes: string[]
) {
  const nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]))
  const connectedNodes = new Map<
    string,
    ChatbotGraphSnapshot['nodes'][number]
  >()

  for (const edge of snapshot.edges) {
    if (!edgeTypes.includes(edge.type)) continue

    if (edge.source === nodeId) {
      const node = nodesById.get(edge.target)
      if (node) connectedNodes.set(node.id, node)
    }
    if (edge.target === nodeId) {
      const node = nodesById.get(edge.source)
      if (node) connectedNodes.set(node.id, node)
    }
  }

  return [...connectedNodes.values()]
}

function getSelectedRelationEdges(
  snapshot: ChatbotGraphSnapshot,
  selectedNodeId: string | undefined,
  hierarchyEdges: ChatbotGraphSnapshot['edges']
) {
  if (!selectedNodeId) return []

  const nodeIds = new Set(snapshot.nodes.map((node) => node.id))
  const hierarchyEdgeIds = new Set(hierarchyEdges.map((edge) => edge.id))

  return snapshot.edges.filter((edge) => {
    if (hierarchyEdgeIds.has(edge.id)) return false
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) return false

    return edge.source === selectedNodeId || edge.target === selectedNodeId
  })
}

function findHierarchyEdge(
  snapshot: ChatbotGraphSnapshot,
  parentNodeId: string,
  childNodeId: string,
  allowedTypes: string[]
) {
  return snapshot.edges.find((edge) => {
    if (!allowedTypes.includes(edge.type)) return false

    return (
      (edge.source === parentNodeId && edge.target === childNodeId) ||
      (edge.source === childNodeId && edge.target === parentNodeId)
    )
  })
}

function uniqueEdges(edges: ChatbotGraphSnapshot['edges']) {
  const seenEdgeIds = new Set<string>()

  return edges.filter((edge) => {
    if (seenEdgeIds.has(edge.id)) return false

    seenEdgeIds.add(edge.id)
    return true
  })
}

function placeChildrenAroundParent(
  positions: Map<string, { x: number; y: number }>,
  nodes: ChatbotGraphSnapshot['nodes'],
  parentNodeId: string,
  parentAngle: number,
  radius: number
) {
  const positionedNodes = nodes.filter((node) => !positions.has(node.id))
  const basePoint = positions.get(parentNodeId) ?? { x: 0, y: 0 }

  positionedNodes.forEach((node, index) => {
    const childAngle = angleForChild(parentAngle, index, positionedNodes.length)

    positions.set(node.id, {
      x: Math.round(basePoint.x + Math.cos(childAngle) * radius),
      y: Math.round(basePoint.y + Math.sin(childAngle) * radius),
    })
  })
}

function angleForChild(parentAngle: number, index: number, total: number) {
  const spread = Math.min(
    Math.PI * 0.78,
    Math.PI * 0.18 * Math.max(total - 1, 1)
  )
  const offset = total <= 1 ? 0 : -spread / 2 + (index / (total - 1)) * spread

  return parentAngle + offset
}

function getRingAngle(index: number, total: number, startAngle = -Math.PI / 2) {
  return startAngle + (index / Math.max(total, 1)) * Math.PI * 2
}

function polarToPoint(radius: number, angle: number) {
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  }
}

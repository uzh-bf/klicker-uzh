import type { KnowledgeGraphEdge, KnowledgeGraphNode } from '@klicker-uzh/types'

export const KNOWLEDGE_GRAPH_MIN_ZOOM = 0.15
export const KNOWLEDGE_GRAPH_MAX_ZOOM = 3

export function nextKnowledgeGraphZoom(
  currentZoom: number,
  scale: number,
  minZoom = KNOWLEDGE_GRAPH_MIN_ZOOM,
  maxZoom = KNOWLEDGE_GRAPH_MAX_ZOOM
): number {
  return Math.min(maxZoom, Math.max(minZoom, currentZoom * scale))
}

export function relationshipLabels(
  edge: KnowledgeGraphEdge,
  nodes: Map<string, KnowledgeGraphNode>
): { source: string; target: string } {
  return {
    source: nodes.get(edge.source)?.displayLabel ?? edge.source,
    target: nodes.get(edge.target)?.displayLabel ?? edge.target,
  }
}

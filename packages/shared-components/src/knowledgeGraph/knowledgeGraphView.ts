import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
  KnowledgeGraphRelationType,
} from '@klicker-uzh/types'

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

/** The one symmetric relation type; views draw it without a direction. */
export const SYMMETRIC_RELATION_TYPE =
  'contrasts_with' satisfies KnowledgeGraphRelationType

/**
 * Generated edges carry no label of their own, so their label falls back to
 * the relationship type (`RELATED`). Such edges show their relation type.
 */
export function relationshipDisplayLabel(
  edge: KnowledgeGraphEdge,
  relationTypeLabels: Record<KnowledgeGraphRelationType, string>
): string {
  return edge.label === edge.type
    ? relationTypeLabels[edge.relationType]
    : edge.label
}

/**
 * Display-only payload a viewer hands to the host when the user asks the
 * chatbot about the selected concept or relationship. It intentionally carries
 * no concept ids, summaries, properties or source references, so only what the
 * user can already read on the canvas reaches the chat prompt.
 */
export type KnowledgeGraphAskSelection =
  | { kind: 'node'; label: string }
  | { kind: 'edge'; label: string; source: string; target: string }

/** Upper bound for every label that travels with an ask selection. */
export const KNOWLEDGE_GRAPH_ASK_LABEL_MAX_LENGTH = 200

export function boundKnowledgeGraphAskLabel(label: string): string {
  const trimmed = label.trim()
  return trimmed.length > KNOWLEDGE_GRAPH_ASK_LABEL_MAX_LENGTH
    ? trimmed.slice(0, KNOWLEDGE_GRAPH_ASK_LABEL_MAX_LENGTH)
    : trimmed
}

export function nodeAskSelection(
  node: KnowledgeGraphNode
): KnowledgeGraphAskSelection {
  return {
    kind: 'node',
    label: boundKnowledgeGraphAskLabel(node.displayLabel),
  }
}

export function edgeAskSelection(
  edge: KnowledgeGraphEdge,
  nodes: Map<string, KnowledgeGraphNode>,
  missingEndpointLabel: string,
  relationTypeLabels: Record<KnowledgeGraphRelationType, string>
): KnowledgeGraphAskSelection {
  const fallback = boundKnowledgeGraphAskLabel(missingEndpointLabel)
  return {
    kind: 'edge',
    label: boundKnowledgeGraphAskLabel(
      relationshipDisplayLabel(edge, relationTypeLabels)
    ),
    // An endpoint outside the loaded view falls back to a generic label; a raw
    // concept id must never reach the chat prompt.
    source: boundKnowledgeGraphAskLabel(
      nodes.get(edge.source)?.displayLabel ?? fallback
    ),
    target: boundKnowledgeGraphAskLabel(
      nodes.get(edge.target)?.displayLabel ?? fallback
    ),
  }
}

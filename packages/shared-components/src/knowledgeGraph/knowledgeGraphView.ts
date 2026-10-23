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

/** Symmetric relation types; views draw them without a direction. */
export const SYMMETRIC_RELATION_TYPES = [
  'contrasts_with',
  'synonym_of',
] as const satisfies readonly KnowledgeGraphRelationType[]

export function isSymmetricRelationType(
  relationType: KnowledgeGraphRelationType
): boolean {
  return (SYMMETRIC_RELATION_TYPES as readonly string[]).includes(relationType)
}

/**
 * Generated edges carry no label of their own, so their label falls back to
 * the relationship type (`RELATED`). Such edges show their relation type.
 */
export function relationshipDisplayLabel(
  edge: KnowledgeGraphEdge,
  relationTypeLabels: Record<KnowledgeGraphRelationType, string>
): string {
  return edge.label === edge.type
    ? (relationTypeLabels[edge.relationType] ?? edge.label)
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

const CONCEPT_DEFINITION_MAX_LENGTH = 220
// Graph extraction joins the descriptions it merges for one concept with this
// separator; the first one is the concept's own definition.
const MERGED_DESCRIPTION_SEPARATOR = '<SEP>'

/**
 * A one- or two-sentence definition of a concept from its graph summary or
 * description, for hover cards and the details heading. Undefined when the
 * graph has no text for the concept.
 */
export function conceptDefinition(
  node: Pick<KnowledgeGraphNode, 'summary' | 'content'>
): string | undefined {
  const source = node.summary ?? node.content
  const text = source
    ?.split(MERGED_DESCRIPTION_SEPARATOR)[0]
    ?.replace(/\s+/g, ' ')
    .trim()
  if (!text) return undefined
  if (text.length <= CONCEPT_DEFINITION_MAX_LENGTH) return text
  const window = text.slice(0, CONCEPT_DEFINITION_MAX_LENGTH)
  const sentenceEnd = Math.max(
    window.lastIndexOf('. '),
    window.lastIndexOf('! '),
    window.lastIndexOf('? ')
  )
  if (sentenceEnd >= CONCEPT_DEFINITION_MAX_LENGTH / 3)
    return window.slice(0, sentenceEnd + 1)
  const wordEnd = window.lastIndexOf(' ')
  return `${window.slice(0, wordEnd > 0 ? wordEnd : undefined).trimEnd()}…`
}

/** Shows merged graph descriptions as separate paragraphs. */
export function readableDescription(text: string): string {
  return text
    .split(MERGED_DESCRIPTION_SEPARATOR)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n\n')
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

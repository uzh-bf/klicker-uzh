/**
 * Search and suggestion tuning for the shared knowledge graph viewer.
 *
 * Suggestions are requested only after a short idle period, so typing never
 * issues a request per keystroke. An explicit submit stays available for a
 * single character, while the debounced suggestion list requires a longer term.
 */
export const KNOWLEDGE_GRAPH_SUGGESTION_DEBOUNCE_MS = 300
export const KNOWLEDGE_GRAPH_SUGGESTION_MIN_LENGTH = 2
export const KNOWLEDGE_GRAPH_SEARCH_MIN_LENGTH = 1
export const KNOWLEDGE_GRAPH_QUERY_MAX_LENGTH = 100
export const KNOWLEDGE_GRAPH_MAX_SUGGESTIONS = 20

export function normalizeKnowledgeGraphQuery(raw: string): string {
  return raw.trim()
}

/** A debounced suggestion request needs a bounded, meaningful query. */
export function isKnowledgeGraphSuggestionQuery(query: string): boolean {
  const length = normalizeKnowledgeGraphQuery(query).length
  return (
    length >= KNOWLEDGE_GRAPH_SUGGESTION_MIN_LENGTH &&
    length <= KNOWLEDGE_GRAPH_QUERY_MAX_LENGTH
  )
}

/** Explicit submits accept one character; empty or oversized queries do not. */
export function isKnowledgeGraphSubmitQuery(query: string): boolean {
  const length = normalizeKnowledgeGraphQuery(query).length
  return (
    length >= KNOWLEDGE_GRAPH_SEARCH_MIN_LENGTH &&
    length <= KNOWLEDGE_GRAPH_QUERY_MAX_LENGTH
  )
}

export function limitKnowledgeGraphSuggestions<T extends { id: string }>(
  nodes: T[],
  limit = KNOWLEDGE_GRAPH_MAX_SUGGESTIONS
): T[] {
  const seen = new Set<string>()
  const suggestions: T[] = []
  for (const node of nodes) {
    if (seen.has(node.id)) {
      continue
    }
    seen.add(node.id)
    suggestions.push(node)
    if (suggestions.length >= limit) {
      break
    }
  }
  return suggestions
}

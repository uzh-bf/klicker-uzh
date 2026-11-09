import type { MarkdownAstNode } from './remarkCitationMarkers'

// Turns the first occurrence of each knowledge-graph concept named in an
// answer into a `#concept-<nodeId>` link, which `markdown-text.tsx` renders as
// a control that focuses the concept in the graph panel. The server decides
// which phrases name a concept; this transform only locates them. Links,
// code, and math are left untouched because only plain `text` nodes outside
// links are rewritten (see `remarkCitationMarkers` for the same rule).

export type ConceptLinkTerm = { nodeId: string; text: string }

const CONCEPT_HREF_PREFIX = '#concept-'
const SKIPPED_PARENT_TYPES = new Set(['link', 'linkReference'])
// Hyphens join words, as in the server's matcher, so "Test" never links
// inside "t-Test".
const WORD_CHARACTER = /[\p{L}\p{N}-]/u

export function conceptHrefFor(nodeId: string): string {
  return `${CONCEPT_HREF_PREFIX}${nodeId}`
}

export function parseConceptHref(href: string | undefined): string | null {
  if (!href?.startsWith(CONCEPT_HREF_PREFIX)) return null
  const nodeId = href.slice(CONCEPT_HREF_PREFIX.length)
  return /^\d{1,19}$/.test(nodeId) ? nodeId : null
}

function isBoundary(value: string, index: number): boolean {
  const character = value[index]
  return character === undefined || !WORD_CHARACTER.test(character)
}

function findTerm(value: string, term: string, from: number): number {
  const haystack = value.toLowerCase()
  const needle = term.toLowerCase()
  let index = haystack.indexOf(needle, from)
  while (index !== -1) {
    if (isBoundary(value, index - 1) && isBoundary(value, index + term.length))
      return index
    index = haystack.indexOf(needle, index + 1)
  }
  return -1
}

function linkTerms(
  value: string,
  pending: Map<string, ConceptLinkTerm>
): MarkdownAstNode[] | null {
  const parts: MarkdownAstNode[] = []
  let cursor = 0
  while (pending.size > 0) {
    let next: { index: number; key: string; term: ConceptLinkTerm } | null =
      null
    for (const [key, term] of pending) {
      const index = findTerm(value, term.text, cursor)
      if (index !== -1 && (next === null || index < next.index))
        next = { index, key, term }
    }
    if (next === null) break
    const end = next.index + next.term.text.length
    if (next.index > cursor)
      parts.push({ type: 'text', value: value.slice(cursor, next.index) })
    parts.push({
      type: 'link',
      url: conceptHrefFor(next.term.nodeId),
      children: [{ type: 'text', value: value.slice(next.index, end) }],
    })
    pending.delete(next.key)
    cursor = end
  }
  if (parts.length === 0) return null
  if (cursor < value.length)
    parts.push({ type: 'text', value: value.slice(cursor) })
  return parts
}

function walk(
  node: MarkdownAstNode,
  pending: Map<string, ConceptLinkTerm>,
  insideSkipped = false
): void {
  if (!Array.isArray(node.children) || pending.size === 0) return
  const skipped = insideSkipped || SKIPPED_PARENT_TYPES.has(node.type)
  const nextChildren: MarkdownAstNode[] = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string' && !skipped) {
      const parts = linkTerms(child.value, pending)
      if (parts) {
        nextChildren.push(...parts)
        continue
      }
    }
    walk(child, pending, skipped)
    nextChildren.push(child)
  }
  node.children = nextChildren
}

/** Links each term once, at its first occurrence in document order. */
export function transformConceptLinks<T extends MarkdownAstNode>(
  tree: T,
  terms: readonly ConceptLinkTerm[]
): T {
  const pending = new Map(
    terms
      .filter((term) => term.text.trim().length > 0)
      .map((term) => [term.text.toLowerCase(), term] as const)
  )
  walk(tree, pending)
  return tree
}

/** unified/remark plugin attacher; add after `remarkCitationMarkers`. */
export function remarkConceptLinks(options: {
  terms: readonly ConceptLinkTerm[]
}) {
  return (tree: MarkdownAstNode) => {
    transformConceptLinks(tree, options.terms)
  }
}

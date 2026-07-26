// Transforms `[n]` citation markers (written by the model per the S5 prompt
// contract) into markdown link nodes pointing at `#cite-<n>`, so
// `markdown-text.tsx`'s `a` component override can render a `CitationChip`
// instead of a normal anchor. Whether `n` actually resolves to a source is
// decided later, in `CitationChip` (message-scoped `sources` context) — this
// module only does the structural markdown transform and knows nothing
// about sources.
//
// Runs as a `unified`/remark transformer plugin, appended after
// `remark-gfm`/`remark-math` so it walks the already-fully-parsed mdast tree
// (tables, math, code fences, etc. are already their own node types by the
// time this runs).

/**
 * Minimal structural mdast-node shape this module needs. Defined locally
 * (rather than importing `mdast`'s `Root`/`Text`/`Link` types) so this file
 * adds no new dependency — real mdast nodes from remark-parse/remark-gfm/
 * remark-math satisfy this shape structurally, since it only requires
 * `type` and leaves everything else optional.
 */
export interface MarkdownAstNode {
  type: string
  value?: string
  url?: string
  children?: MarkdownAstNode[]
  [key: string]: unknown
}

// Text that is already the label of a real link must stay exactly what the
// author linked to — including text nested deeper inside the label (e.g.
// `[**see [1]**](url)`), which is why the skip state is threaded through the
// whole subtree in `walk`, not just checked on the immediate parent. Code
// needs no entry here: mdast represents code spans and fenced blocks as leaf
// nodes carrying a raw `value` string, never as `text` children, so a marker
// inside code never reaches the `text`-node branch in the first place.
const SKIPPED_PARENT_TYPES = new Set(['link', 'linkReference'])

// Complete numbered marker, e.g. `[1]` or `[12]`. No `g` flag — safe to
// `.test()` repeatedly without shared-state bugs; the `g`-flagged exec below
// is a separate regex instance used only inside `splitCitationMarkers`.
const HAS_CITATION_MARKER_RE = /\[\d{1,2}\]/
const CITATION_MARKER_EXEC_RE = /\[(\d{1,2})\]/g

export function citationHrefFor(index: number): string {
  return `#cite-${index}`
}

/** Parses a `#cite-<n>` href back into its numeric index, or `null` if the
 * href does not match that shape (e.g. a real link). */
export function parseCitationHref(
  href: string | null | undefined
): number | null {
  if (!href) return null
  const match = /^#cite-(\d{1,2})$/.exec(href)
  return match ? Number(match[1]) : null
}

/**
 * Pure: splits a single text value into text/link mdast nodes around any
 * complete `[n]` markers it contains. A partial marker still streaming in
 * (`[1`, no closing bracket) does not match and is left as literal text —
 * this is what makes the transform streaming-safe without any additional
 * state. Returns a single-element array with the original text unchanged
 * when there is nothing to split.
 */
export function splitCitationMarkers(value: string): MarkdownAstNode[] {
  if (!HAS_CITATION_MARKER_RE.test(value)) {
    return [{ type: 'text', value }]
  }

  const nodes: MarkdownAstNode[] = []
  let lastIndex = 0
  CITATION_MARKER_EXEC_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = CITATION_MARKER_EXEC_RE.exec(value))) {
    const [full, digits] = match
    const start = match.index
    if (start > lastIndex) {
      nodes.push({ type: 'text', value: value.slice(lastIndex, start) })
    }
    nodes.push({
      type: 'link',
      url: citationHrefFor(Number(digits)),
      children: [{ type: 'text', value: digits }],
    })
    lastIndex = start + full.length
  }

  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return nodes
}

/**
 * Pure mdast transform: walks the tree depth-first and replaces `[n]` runs
 * inside plain text nodes with link nodes, skipping text that is already
 * inside a real link (see `SKIPPED_PARENT_TYPES`). Mutates `tree` in place
 * (matching the unified/remark transformer contract) and also returns it
 * for convenience in tests.
 */
export function transformCitationMarkers<T extends MarkdownAstNode>(
  tree: T
): T {
  walk(tree)
  return tree
}

function walk(node: MarkdownAstNode, insideSkipped = false): void {
  if (!Array.isArray(node.children)) return

  const skipped = insideSkipped || SKIPPED_PARENT_TYPES.has(node.type)

  const nextChildren: MarkdownAstNode[] = []
  for (const child of node.children) {
    if (
      child.type === 'text' &&
      typeof child.value === 'string' &&
      !skipped &&
      HAS_CITATION_MARKER_RE.test(child.value)
    ) {
      nextChildren.push(...splitCitationMarkers(child.value))
      continue
    }

    walk(child, skipped)
    nextChildren.push(child)
  }
  node.children = nextChildren
}

/** unified/remark plugin attacher — add to `remarkPlugins` after
 * `remark-gfm`/`remark-math`. */
export function remarkCitationMarkers() {
  return (tree: MarkdownAstNode) => {
    transformCitationMarkers(tree)
  }
}

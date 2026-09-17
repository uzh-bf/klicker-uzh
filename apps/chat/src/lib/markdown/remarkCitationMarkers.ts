import { MAX_SOURCES } from '../sources/normalizeSources'

// Transforms `[n]` and contiguous `[n–m]` citation markers (written by the
// model per the S5 prompt contract) into adjacent markdown link nodes pointing
// at `#cite-<n>`, so `markdown-text.tsx`'s `a` component override can render a
// `CitationChip` instead of a normal anchor. Whether an index actually
// resolves to a source is decided later, in `CitationChip` (message-scoped
// `sources` context) — this module only does the structural markdown
// transform and does not inspect message sources.
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

// A page detail that some models append inside a marker, e.g.
// `[1, p. 6–7]` or `[1, S. 8-18]`. Only a *labelled* page is accepted: a
// bare `[1, 2]` is overwhelmingly a coordinate or a bracket list in real
// course answers, while no observed course citation omits the label.
//
// The label must be followed by digits, so a Roman chapter numeral
// (`Kapitel IV`) never matches and such a marker stays literal. Both
// regexes below carry `i`, because the German labels are nouns and arrive
// capitalised while the English ones usually do not.
// The German `S`/`s` keeps the same optional dot as the English `p`/`pp`,
// so `[1, S 8]` and `[1, S. 8]` are treated alike.
const PAGE_LABEL = '(?:pages?|seiten?|kapitel|kap\\.|p{1,2}\\.|s\\.|p{1,2}|s)'
// The label and its digits are mandatory inside this group; only the comma
// branch that wraps it is optional. Without this, a bare comma such as
// `[1,]` or `[2, ]` would match, swallow the comma and silently degrade
// to a citation chip. `[1]` still matches because the wrapper stays optional.
const PAGE_REFERENCE = `(?:${PAGE_LABEL}[ \t]*\\d{1,3}(?:[ \t]*[-–—][ \t]*\\d{1,3})?)`

// Complete numbered marker, e.g. `[1]`, `[12]`, `[2–4]`, or `[2–4, S. 10–12]`.
// Hyphen and em dash variants are accepted because models do not reliably emit
// one dash character. No `g` flag — safe to `.test()` repeatedly without
// shared-state bugs; the `g`-flagged exec below is a separate regex instance
// used only inside `splitCitationMarkers`.
const HAS_CITATION_MARKER_RE = new RegExp(
  `\\[\\d{1,2}(?:[ \\t]*[-–—][ \\t]*\\d{1,2})?(?:[ \\t]*,[ \\t]*${PAGE_REFERENCE})?\\]`,
  'i'
)
const CITATION_MARKER_EXEC_RE = new RegExp(
  `\\[(\\d{1,2})(?:[ \\t]*[-–—][ \\t]*(\\d{1,2}))?(?:[ \\t]*,[ \\t]*${PAGE_REFERENCE})?\\]`,
  'gi'
)

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

// Spaces/tabs directly before a marker. Newlines are deliberately excluded:
// a soft line break before a marker must survive, only intra-line spacing is
// collapsed so the chip glues to the preceding word.
const TRAILING_INLINE_WHITESPACE_RE = /[ \t]+$/

/**
 * Pure: splits a single text value into text/link mdast nodes around any
 * complete `[n]` or contiguous `[n–m]` markers it contains. A partial marker
 * still streaming in (`[1`, no closing bracket) does not match and is left as
 * literal text — this is what makes the transform streaming-safe without any
 * additional state. Returns a single-element array with the original text
 * unchanged when there is nothing to split.
 *
 * Spaces before a marker are dropped ("Mittel [1]." renders as "Mittel[1]."),
 * which is what glues the chip to the word it cites: browsers only break
 * lines at whitespace, so without the space the word+chip pair wraps as one
 * unit and a chip can never start a line on its own. Adjacent markers
 * ("[1] [2]") collapse to a tight pair the same way.
 */
export function splitCitationMarkers(value: string): MarkdownAstNode[] {
  if (!HAS_CITATION_MARKER_RE.test(value)) {
    return [{ type: 'text', value }]
  }

  const nodes: MarkdownAstNode[] = []
  let lastTextIndex = 0
  CITATION_MARKER_EXEC_RE.lastIndex = 0

  while (true) {
    const match = CITATION_MARKER_EXEC_RE.exec(value)
    if (!match) break

    const [full, firstDigits, lastDigits] = match
    const firstIndex = Number(firstDigits)
    const lastIndex = lastDigits ? Number(lastDigits) : firstIndex

    // Keep malformed descending ranges literal. The custom text cursor is
    // intentionally unchanged so the marker is included in the next text
    // slice (or the final remainder below).
    if (lastIndex < firstIndex) continue

    // A wider range cannot fully resolve and would multiply CitationChip work
    // on every streaming parse. Keep it literal, like a descending range.
    if (lastIndex - firstIndex + 1 > MAX_SOURCES) continue

    const start = match.index
    if (start > lastTextIndex) {
      const before = value
        .slice(lastTextIndex, start)
        .replace(TRAILING_INLINE_WHITESPACE_RE, '')
      if (before.length > 0) {
        nodes.push({ type: 'text', value: before })
      }
    }

    for (let index = firstIndex; index <= lastIndex; index += 1) {
      nodes.push({
        type: 'link',
        url: citationHrefFor(index),
        children: [{ type: 'text', value: String(index) }],
      })
    }
    lastTextIndex = start + full.length
  }

  if (lastTextIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastTextIndex) })
  }

  return nodes
}

/**
 * Pure mdast transform: walks the tree depth-first and replaces `[n]` and
 * contiguous `[n–m]` runs inside plain text nodes with adjacent link nodes,
 * skipping text that is already inside a real link (see
 * `SKIPPED_PARENT_TYPES`). Mutates `tree` in place (matching the
 * unified/remark transformer contract) and also returns it for convenience in
 * tests.
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

import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import {
  type MarkdownAstNode,
  parseCitationHref,
  remarkCitationMarkers,
} from './remarkCitationMarkers.js'

export {
  citationHrefFor,
  type MarkdownAstNode,
  parseCitationHref,
  remarkCitationMarkers,
  splitCitationMarkers,
  transformCitationMarkers,
} from './remarkCitationMarkers.js'

const RENDERER_UNESCAPED_ENTITIES = /&amp;|&lt;|&gt;|&#39;|&quot;/g

/** Keep validation and rendering on the same input normalization path. */
export function normalizeMarkdownContent(source: string): string {
  return source
    .replace(
      RENDERER_UNESCAPED_ENTITIES,
      (entity) =>
        ({
          '&amp;': '&',
          '&lt;': '<',
          '&gt;': '>',
          '&#39;': "'",
          '&quot;': '"',
        })[entity] ?? entity
    )
    .replace(/<br>/g, '&nbsp;')
}

/** Parse the same Markdown dialect and math settings used by the renderer. */
export function parseMarkdownForCitations(source: string): MarkdownAstNode {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath, { singleDollarTextMath: false })
    .use(remarkCitationMarkers)
  return processor.runSync(
    processor.parse(normalizeMarkdownContent(source))
  ) as MarkdownAstNode
}

/**
 * Return citation markers that become citation links in the Markdown
 * renderer. Code, math, HTML, link labels, and link destinations are omitted
 * by the shared AST transform.
 */
export function extractCitationIndexes(source: string): number[] {
  const indexes: number[] = []
  const tree = parseMarkdownForCitations(source)

  walk(tree, (node) => {
    if (node.type !== 'link') return
    const index = parseCitationHref(
      typeof node.url === 'string' ? node.url : null
    )
    if (index !== null) indexes.push(index)
  })

  return indexes
}

function walk(node: MarkdownAstNode, visit: (node: MarkdownAstNode) => void) {
  const pending: MarkdownAstNode[] = [node]

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current) continue

    visit(current)
    for (
      let index = (current.children?.length ?? 0) - 1;
      index >= 0;
      index -= 1
    ) {
      pending.push(current.children![index]!)
    }
  }
}

/** Require a non-empty exact set of rendered citation indexes. */
export function hasExactCitationIndexes(
  source: string,
  citationIndexes: readonly number[]
): boolean {
  const expected = new Set(citationIndexes)
  const cited = new Set(extractCitationIndexes(source))
  return (
    cited.size > 0 &&
    cited.size === expected.size &&
    [...cited].every((index) => expected.has(index))
  )
}

import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

export interface MarkdownAstNode {
  type: string
  value?: string
  url?: string
  children?: MarkdownAstNode[]
  [key: string]: unknown
}

const SKIPPED_PARENT_TYPES = new Set(['link', 'linkReference'])
const RENDERER_UNESCAPED_ENTITIES = /&amp;|&lt;|&gt;|&#39;|&quot;/g

export function citationTargetIdFor(index: number, scope?: string): string {
  const scopeSegment = scope ? `${encodeURIComponent(scope)}--` : ''
  return `response-example-citation-${scopeSegment}${index}`
}

export function citationHrefFor(index: number, scope?: string): string {
  return `#${citationTargetIdFor(index, scope)}`
}

export function parseCitationHref(
  href: string | null | undefined
): number | null {
  if (!href) return null
  const match = /^#response-example-citation-(?:[^#]*--)?(\d+)$/.exec(href)
  return match ? Number(match[1]) : null
}

export function splitCitationMarkers(
  value: string,
  scope?: string,
  sourceOffset?: number
): MarkdownAstNode[] {
  const nodes: MarkdownAstNode[] = []
  let lastIndex = 0
  let searchFrom = 0

  while (searchFrom < value.length) {
    const start = value.indexOf('[', searchFrom)
    if (start === -1) break

    let end = start + 1
    while (
      end < value.length &&
      value.charCodeAt(end) >= 48 &&
      value.charCodeAt(end) <= 57
    ) {
      end += 1
    }
    if (end === start + 1 || value[end] !== ']') {
      searchFrom = start + 1
      continue
    }

    const before = value.slice(lastIndex, start).replace(/[ \t]+$/, '')
    if (before.length > 0) nodes.push({ type: 'text', value: before })

    const citationIndex = value.slice(start + 1, end)
    nodes.push({
      type: 'link',
      url: citationHrefFor(Number(citationIndex), scope),
      children: [{ type: 'text', value: citationIndex }],
      data: {
        responseExampleCitationMarker: true,
        ...(sourceOffset === undefined
          ? {}
          : {
              sourceStart: sourceOffset + start,
              sourceEnd: sourceOffset + end + 1,
            }),
      },
    })
    lastIndex = end + 1
    searchFrom = lastIndex
  }

  if (lastIndex === 0) return [{ type: 'text', value }]
  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return nodes
}

export function transformCitationMarkers<T extends MarkdownAstNode>(
  tree: T,
  scope?: string
): T {
  const pending: Array<{
    node: MarkdownAstNode
    insideSkipped: boolean
  }> = [{ node: tree, insideSkipped: false }]

  while (pending.length > 0) {
    const current = pending.pop()
    if (!current || !Array.isArray(current.node.children)) continue

    const skipped =
      current.insideSkipped || SKIPPED_PARENT_TYPES.has(current.node.type)
    const nextChildren: MarkdownAstNode[] = []

    for (const child of current.node.children) {
      if (
        child.type === 'text' &&
        typeof child.value === 'string' &&
        !skipped &&
        child.value.includes('[')
      ) {
        const position = child.position as
          | { start?: { offset?: number } }
          | undefined
        nextChildren.push(
          ...splitCitationMarkers(child.value, scope, position?.start?.offset)
        )
        continue
      }

      nextChildren.push(child)
    }

    current.node.children = nextChildren
    for (let index = nextChildren.length - 1; index >= 0; index -= 1) {
      pending.push({
        node: nextChildren[index]!,
        insideSkipped: skipped,
      })
    }
  }

  return tree
}

export function remarkCitationMarkers(scope?: string) {
  return (tree: MarkdownAstNode) => {
    transformCitationMarkers(tree, scope)
  }
}

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
    .replaceAll('<br>', '&nbsp;')
}

export interface CitationParserOptions {
  singleDollarTextMath?: boolean
}

/** Parse the Markdown dialect and math setting used by the renderer. */
function parseNormalizedMarkdownForCitations(
  source: string,
  options: CitationParserOptions = {}
): MarkdownAstNode {
  const processor = unified()
    .use(remarkParse)
    .use(remarkMath, {
      singleDollarTextMath: options.singleDollarTextMath ?? false,
    })
    .use(remarkCitationMarkers)
  return processor.runSync(processor.parse(source)) as MarkdownAstNode
}

export function parseMarkdownForCitations(
  source: string,
  options: CitationParserOptions = {}
): MarkdownAstNode {
  return parseNormalizedMarkdownForCitations(
    normalizeMarkdownContent(source),
    options
  )
}

/** Return citation markers that become citation links in the renderer. */
export function extractCitationIndexes(
  source: string,
  options: CitationParserOptions = {}
): number[] {
  const indexes: number[] = []
  const tree = parseMarkdownForCitations(source, options)
  const pending: MarkdownAstNode[] = [tree]

  while (pending.length > 0) {
    const node = pending.pop()
    if (!node) continue

    if (node.type === 'link') {
      const index = parseCitationHref(
        typeof node.url === 'string' ? node.url : null
      )
      if (index !== null) indexes.push(index)
    }

    for (
      let childIndex = (node.children?.length ?? 0) - 1;
      childIndex >= 0;
      childIndex -= 1
    ) {
      pending.push(node.children![childIndex]!)
    }
  }

  return indexes
}

export interface CitationMarkerSpan {
  citationIndex: number
  start: number
  end: number
}

/** Return normalized source spans for markers created by the citation renderer. */
export function extractCitationMarkerSpans(
  source: string,
  options: CitationParserOptions = {}
): CitationMarkerSpan[] {
  const spans: CitationMarkerSpan[] = []
  const normalizedSource = normalizeMarkdownContent(source)
  const tree = parseNormalizedMarkdownForCitations(normalizedSource, options)
  const pending: MarkdownAstNode[] = [tree]

  while (pending.length > 0) {
    const node = pending.pop()
    if (!node) continue

    const data =
      node.data && typeof node.data === 'object'
        ? (node.data as {
            responseExampleCitationMarker?: unknown
            sourceStart?: unknown
            sourceEnd?: unknown
          })
        : null
    if (node.type === 'link' && data?.responseExampleCitationMarker === true) {
      const citationIndex = parseCitationHref(
        typeof node.url === 'string' ? node.url : null
      )
      const start = data.sourceStart
      const end = data.sourceEnd
      if (
        citationIndex !== null &&
        typeof start === 'number' &&
        typeof end === 'number' &&
        normalizedSource.slice(start, end) === `[${citationIndex}]`
      ) {
        spans.push({ citationIndex, start, end })
      }
    }

    for (
      let childIndex = (node.children?.length ?? 0) - 1;
      childIndex >= 0;
      childIndex -= 1
    ) {
      pending.push(node.children![childIndex]!)
    }
  }

  return spans.sort((left, right) => left.start - right.start)
}

/** Require a non-empty exact set of rendered citation indexes. */
export function hasExactCitationIndexes(
  source: string,
  citationIndexes: readonly number[],
  options: CitationParserOptions = {}
): boolean {
  const expected = new Set(citationIndexes)
  const cited = new Set(extractCitationIndexes(source, options))
  return (
    cited.size > 0 &&
    cited.size === expected.size &&
    [...cited].every((index) => expected.has(index))
  )
}

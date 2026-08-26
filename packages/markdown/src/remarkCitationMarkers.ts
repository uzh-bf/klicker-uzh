/**
 * Turns numbered citation markers in Markdown text into links that the
 * renderer can decorate without reparsing or splitting the answer.
 */

export interface MarkdownAstNode {
  type: string
  value?: string
  url?: string
  children?: MarkdownAstNode[]
  [key: string]: unknown
}

const CITATION_MARKER_RE = /\[(\d+)\]/g
const SKIPPED_PARENT_TYPES = new Set(['link', 'linkReference'])

export function citationHrefFor(index: number): string {
  return `#response-example-citation-${index}`
}

export function parseCitationHref(
  href: string | null | undefined
): number | null {
  if (!href) return null
  const match = /^#response-example-citation-(\d+)$/.exec(href)
  return match ? Number(match[1]) : null
}

export function splitCitationMarkers(value: string): MarkdownAstNode[] {
  const nodes: MarkdownAstNode[] = []
  let lastIndex = 0
  CITATION_MARKER_RE.lastIndex = 0

  while (true) {
    const match = CITATION_MARKER_RE.exec(value)
    if (!match) break

    const start = match.index
    const before = value.slice(lastIndex, start).replace(/[ \t]+$/, '')
    if (before.length > 0) nodes.push({ type: 'text', value: before })

    nodes.push({
      type: 'link',
      url: citationHrefFor(Number(match[1])),
      children: [{ type: 'text', value: match[1] }],
    })
    lastIndex = start + match[0].length
  }

  if (lastIndex === 0) return [{ type: 'text', value }]
  if (lastIndex < value.length) {
    nodes.push({ type: 'text', value: value.slice(lastIndex) })
  }

  return nodes
}

export function transformCitationMarkers<T extends MarkdownAstNode>(
  tree: T
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
        /\[\d+\]/.test(child.value)
      ) {
        nextChildren.push(...splitCitationMarkers(child.value))
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

export function remarkCitationMarkers() {
  return (tree: MarkdownAstNode) => {
    transformCitationMarkers(tree)
  }
}

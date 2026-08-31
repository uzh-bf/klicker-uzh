import remarkMath from 'remark-math'
import remarkParse from 'remark-parse'
import { unified } from 'unified'

// Project a Markdown string to a single line of readable plain text.
//
// This is a synchronous projector with no additional dependencies, used for the visible
// element-card preview in the question library. It keeps human-readable
// text (headings, emphasis, links, images, code, math), decodes character
// references through parsing, and collapses block/line whitespace into a
// single space. URL destinations, media sources, raw HTML, and formatting
// controls are omitted.
//
// This projector deliberately uses structural node types instead of the
// mdast typings, which are not a direct dependency of this package. The
// remark-parse AST is a plain tree of { type, value?, alt?, children? }.

interface MarkdownNode {
  type: string
  value?: string
  alt?: string
  children?: MarkdownNode[]
}

const BLOCK_CONTAINERS = new Set(['root', 'blockquote', 'list', 'listItem'])

function projectNode(node: MarkdownNode): string {
  switch (node.type) {
    case 'text':
    case 'inlineCode':
    case 'inlineMath':
    case 'code':
    case 'math':
      return node.value ?? ''
    case 'image':
    case 'imageReference':
      return node.alt ?? ''
    case 'break':
    case 'thematicBreak':
      return ' '
    case 'html':
    case 'definition':
    case 'footnoteReference':
    case 'yaml':
    case 'toml':
      return ''
    default:
      return (node.children ?? [])
        .map(projectNode)
        .filter(Boolean)
        .join(BLOCK_CONTAINERS.has(node.type) ? ' ' : '')
  }
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

/**
 * Project Markdown to a single line of readable plain text.
 *
 * This is a synchronous projector over the unified/remark-parse AST. It is
 * used only for the two-line element-card preview in the Manage question
 * library; the original Markdown is never modified and all other rendering
 * paths keep their current behavior.
 */
export function markdownToPlainText(markdown: string): string {
  const tree = unified()
    .use(remarkParse)
    .use(remarkMath)
    .parse(markdown) as MarkdownNode
  return collapseWhitespace(projectNode(tree))
}

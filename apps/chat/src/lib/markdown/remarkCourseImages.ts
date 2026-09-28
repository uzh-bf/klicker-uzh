import type { MarkdownAstNode } from './remarkCitationMarkers'

export const courseImageMarker = (assetId: string) =>
  `[course-image:${assetId}]`

function isNestedListPlacement(
  lines: readonly string[],
  index: number,
  markerIndent: number
): boolean {
  if (markerIndent === 0) return false
  for (let i = index - 1; i >= 0; i--) {
    const line = lines[i]!
    if (line.trim() === '') continue
    const listMarker = /^( {0,3})(?:[-+*]|\d+[.)])[ \t]+/.exec(line)
    if (listMarker) {
      if (markerIndent >= listMarker[0].length) return true
      continue
    }
    if (!line.startsWith(' ')) return false
  }
  return false
}

// Only standalone, top-level paragraphs are placements. Code samples and
// nested blocks remain literal. This same scanner drives the legacy fallback.
export function courseImagePlacements(text: string): string[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const ids: string[] = []
  let fence: { char: string; length: number } | undefined
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const delimiter = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1]
    if (fence) {
      if (
        delimiter?.[0] === fence.char &&
        delimiter.length >= fence.length &&
        line.trim() === delimiter
      )
        fence = undefined
      continue
    }
    if (delimiter) {
      fence = { char: delimiter[0]!, length: delimiter.length }
      continue
    }
    const match = /^( {0,3})\[course-image:([a-f0-9]{64})\][ \t]*$/.exec(line)
    if (
      match &&
      !isNestedListPlacement(lines, i, match[1]!.length) &&
      (i === 0 || lines[i - 1]!.trim() === '') &&
      (i === lines.length - 1 || lines[i + 1]!.trim() === '')
    )
      ids.push(match[2]!)
  }
  return [...new Set(ids)]
}

export function firstCourseImagePlacementIndex(
  texts: readonly (string | null | undefined)[],
  assetId: string
): number {
  return texts.findIndex(
    (text) =>
      typeof text === 'string' && courseImagePlacements(text).includes(assetId)
  )
}

export function remarkCourseImages() {
  return (tree: MarkdownAstNode) => {
    const seen = new Set<string>()
    for (const node of tree.children ?? []) {
      if (node.type !== 'paragraph' || node.children?.length !== 1) continue
      const child = node.children[0]!
      if (child.type !== 'text') continue
      const match = /^\[course-image:([a-f0-9]{64})\][ \t]*$/.exec(
        child.value ?? ''
      )
      if (!match) continue
      const assetId = match[1]!
      node.data = {
        hName: 'div',
        hProperties: { 'data-course-image': seen.has(assetId) ? '' : assetId },
      }
      node.children = []
      seen.add(assetId)
    }
  }
}

import type { MarkdownAstNode } from './remarkCitationMarkers'

export const courseImageMarker = (assetId: string) =>
  `[course-image:${assetId}]`

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
    const match = /^\[course-image:([a-f0-9]{64})\]$/.exec(line)
    if (
      match &&
      (i === 0 || lines[i - 1] === '') &&
      (i === lines.length - 1 || lines[i + 1] === '')
    )
      ids.push(match[1]!)
  }
  return [...new Set(ids)]
}

export function remarkCourseImages() {
  return (tree: MarkdownAstNode) => {
    const seen = new Set<string>()
    for (const node of tree.children ?? []) {
      if (node.type !== 'paragraph' || node.children?.length !== 1) continue
      const child = node.children[0]!
      if (child.type !== 'text') continue
      const match = /^\[course-image:([a-f0-9]{64})\]$/.exec(child.value ?? '')
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

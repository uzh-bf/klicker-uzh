import { describe, expect, it } from 'vitest'
import {
  courseImageMarker,
  courseImagePlacements,
  remarkCourseImages,
} from '../src/lib/markdown/remarkCourseImages'
import type { MarkdownAstNode } from '../src/lib/markdown/remarkCitationMarkers'

const id = 'a'.repeat(64)
const marker = courseImageMarker(id)
const paragraph = (value: string): MarkdownAstNode => ({
  type: 'paragraph',
  children: [{ type: 'text', value }],
})

describe('inline course image placement', () => {
  it('places a figure between explanations and removes duplicate placements', () => {
    const tree = {
      type: 'root',
      children: [
        paragraph('Before'),
        paragraph(marker),
        paragraph('After'),
        paragraph(marker),
      ],
    }
    remarkCourseImages()(tree)
    expect(tree.children[1]?.data).toEqual({
      hName: 'div',
      hProperties: { 'data-course-image': id },
    })
    expect(tree.children[2]?.children?.[0]?.value).toBe('After')
    expect(tree.children[3]?.data).toEqual({
      hName: 'div',
      hProperties: { 'data-course-image': '' },
    })
    expect(
      courseImagePlacements(`Before\n\n${marker}\n\nAfter\n\n${marker}`)
    ).toEqual([id])
  })
  it('keeps code, nested blocks, inline mentions and incomplete markers out of placement', () => {
    for (const text of [
      `\`\`\`\n\n${marker}\n\n\`\`\``,
      `~~~\n\n${marker}\n\n~~~`,
      `    ${marker}`,
      `> ${marker}`,
      `Mention ${marker}`,
      '[course-image:abc',
    ]) {
      expect(courseImagePlacements(text)).toEqual([])
    }
    const tree = {
      type: 'root',
      children: [
        { type: 'code', value: marker },
        { type: 'blockquote', children: [paragraph(marker)] },
        paragraph(`Mention ${marker}`),
      ],
    }
    const before = structuredClone(tree)
    remarkCourseImages()(tree)
    expect(tree).toEqual(before)
  })
  it('does not interpret URLs as assets', () => {
    expect(
      courseImagePlacements('[course-image:https://example.com/image.png]')
    ).toEqual([])
  })
})

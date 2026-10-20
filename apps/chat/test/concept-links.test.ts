import { describe, expect, test } from 'vitest'
import type { MarkdownAstNode } from '../src/lib/markdown/remarkCitationMarkers'
import {
  conceptHrefFor,
  parseConceptHref,
  transformConceptLinks,
} from '../src/lib/markdown/remarkConceptLinks'

const text = (value: string): MarkdownAstNode => ({ type: 'text', value })
const conceptLink = (nodeId: string, value: string): MarkdownAstNode => ({
  type: 'link',
  url: conceptHrefFor(nodeId),
  children: [text(value)],
})

describe('concept links in answer markdown', () => {
  test('round-trips only numeric graph node ids', () => {
    expect(parseConceptHref(conceptHrefFor('42'))).toBe('42')
    expect(parseConceptHref('#concept-abc')).toBeNull()
    expect(parseConceptHref('#cite-1')).toBeNull()
    expect(parseConceptHref(undefined)).toBeNull()
  })

  test('links the first whole-word occurrence of each term once', () => {
    const tree: MarkdownAstNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            text(
              'Present values differ; a present value and the discount rate.'
            ),
          ],
        },
        { type: 'paragraph', children: [text('Present value again.')] },
      ],
    }
    transformConceptLinks(tree, [
      { nodeId: '1', text: 'present value' },
      { nodeId: '2', text: 'Discount rate' },
    ])
    expect(tree.children?.[0]?.children).toEqual([
      text('Present values differ; a '),
      conceptLink('1', 'present value'),
      text(' and the '),
      conceptLink('2', 'discount rate'),
      text('.'),
    ])
    expect(tree.children?.[1]?.children).toEqual([text('Present value again.')])
  })

  test('leaves existing links, code and math untouched', () => {
    const tree: MarkdownAstNode = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.org',
              children: [text('beta')],
            },
            { type: 'inlineCode', value: 'beta' },
            { type: 'inlineMath', value: 'beta' },
          ],
        },
      ],
    }
    const before = structuredClone(tree)
    transformConceptLinks(tree, [{ nodeId: '3', text: 'beta' }])
    expect(tree).toEqual(before)
  })
})

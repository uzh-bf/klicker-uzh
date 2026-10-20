import {
  conceptDefinition,
  readableDescription,
} from '@klicker-uzh/shared-components/src/knowledgeGraph/knowledgeGraphView'
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

  test('never links a term inside a hyphenated compound', () => {
    const tree: MarkdownAstNode = {
      type: 'root',
      children: [
        { type: 'paragraph', children: [text('Der t-Test prüft den Test.')] },
      ],
    }
    transformConceptLinks(tree, [{ nodeId: '4', text: 'Test' }])
    expect(tree.children?.[0]?.children).toEqual([
      text('Der t-Test prüft den '),
      conceptLink('4', 'Test'),
      text('.'),
    ])
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

describe('concept definitions', () => {
  test('uses the first merged description and prefers the summary', () => {
    expect(
      conceptDefinition({ content: ' First  part.<SEP>Second part.' })
    ).toBe('First part.')
    expect(conceptDefinition({ summary: 'Short.', content: 'Long.' })).toBe(
      'Short.'
    )
    expect(conceptDefinition({})).toBeUndefined()
  })

  test('shortens long descriptions at a sentence or word boundary', () => {
    const sentence = `${'a'.repeat(100)}.`
    const bySentence = conceptDefinition({
      content: `${sentence} ${'b'.repeat(300)}`,
    })
    expect(bySentence).toBe(sentence)
    const byWord = conceptDefinition({ content: 'word '.repeat(100) })
    expect(byWord?.endsWith('word…')).toBe(true)
    expect(byWord!.length).toBeLessThanOrEqual(221)
  })

  test('shows merged descriptions as paragraphs', () => {
    expect(readableDescription('One.<SEP> Two.<SEP>')).toBe('One.\n\nTwo.')
  })
})

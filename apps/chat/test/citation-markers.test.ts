import { describe, expect, test } from 'vitest'
import {
  citationHrefFor,
  parseCitationHref,
  splitCitationMarkers,
  transformCitationMarkers,
  type MarkdownAstNode,
} from '../src/lib/markdown/remarkCitationMarkers'
import { resolveCitationSource } from '../src/lib/sources/normalizeSources'
import type { ChatSource } from '../src/lib/sources/types'

function textNode(value: string): MarkdownAstNode {
  return { type: 'text', value }
}

function citationLinkNode(index: number): MarkdownAstNode {
  return {
    type: 'link',
    url: citationHrefFor(index),
    children: [textNode(String(index))],
  }
}

function paragraph(children: MarkdownAstNode[]): MarkdownAstNode {
  return { type: 'paragraph', children }
}

describe('citationHrefFor / parseCitationHref', () => {
  test('round-trips an index through the #cite-n href format', () => {
    expect(citationHrefFor(3)).toBe('#cite-3')
    expect(parseCitationHref(citationHrefFor(12))).toBe(12)
  })

  test('rejects hrefs that are not the #cite-n shape', () => {
    expect(parseCitationHref(undefined)).toBeNull()
    expect(parseCitationHref(null)).toBeNull()
    expect(parseCitationHref('')).toBeNull()
    expect(parseCitationHref('#cite-')).toBeNull()
    expect(parseCitationHref('#cite-abc')).toBeNull()
    expect(parseCitationHref('https://example.com')).toBeNull()
    expect(parseCitationHref('#section-1')).toBeNull()
  })
})

describe('splitCitationMarkers', () => {
  test('leaves text with no marker unchanged', () => {
    expect(splitCitationMarkers('no markers here')).toEqual([
      textNode('no markers here'),
    ])
  })

  test('happy path: splits a single complete marker into text + link', () => {
    // The space before the marker is dropped so the rendered chip glues to
    // the word it cites and wraps together with it.
    expect(splitCitationMarkers('See [3] for details.')).toEqual([
      textNode('See'),
      citationLinkNode(3),
      textNode(' for details.'),
    ])
  })

  test('a whitespace-only slice before a marker is dropped entirely', () => {
    expect(splitCitationMarkers(' [1]')).toEqual([citationLinkNode(1)])
  })

  test('a newline before a marker survives (only spaces/tabs are stripped)', () => {
    expect(splitCitationMarkers('line one\n[1]')).toEqual([
      textNode('line one\n'),
      citationLinkNode(1),
    ])
  })

  test('two-digit marker', () => {
    expect(splitCitationMarkers('[12]')).toEqual([citationLinkNode(12)])
  })

  test('adjacent markers [1][2] produce no spurious empty text node between them', () => {
    expect(splitCitationMarkers('Facts [1][2].')).toEqual([
      textNode('Facts'),
      citationLinkNode(1),
      citationLinkNode(2),
      textNode('.'),
    ])
  })

  test('partial marker mid-stream (no closing bracket) stays literal text', () => {
    expect(splitCitationMarkers('This cites [1')).toEqual([
      textNode('This cites [1'),
    ])
  })

  test('three-digit bracket is not treated as a marker', () => {
    expect(splitCitationMarkers('See [123] here')).toEqual([
      textNode('See [123] here'),
    ])
  })
})

describe('transformCitationMarkers', () => {
  test('happy path over a paragraph text node', () => {
    const tree = paragraph([textNode('See [1] and [2].')])
    transformCitationMarkers(tree)

    expect(tree).toEqual(
      paragraph([
        textNode('See'),
        citationLinkNode(1),
        textNode(' and'),
        citationLinkNode(2),
        textNode('.'),
      ])
    )
  })

  test('marker nested inside a link label (via emphasis) is left untouched', () => {
    const tree = paragraph([
      {
        type: 'link',
        url: 'https://example.com',
        children: [
          {
            type: 'strong',
            children: [textNode('see [1] here')],
          },
        ],
      },
    ])
    const before = JSON.parse(JSON.stringify(tree))

    transformCitationMarkers(tree)

    expect(tree).toEqual(before)
  })

  test('marker at the very start of a text node transforms end to end', () => {
    const tree = paragraph([textNode('[1] is the source.')])
    transformCitationMarkers(tree)

    expect(tree).toEqual(
      paragraph([citationLinkNode(1), textNode(' is the source.')])
    )

    const link = (tree.children ?? [])[0]
    const parsed = parseCitationHref(link?.url as string)
    expect(parsed).toBe(1)
    expect(resolveCitationSource(parsed as number, [SOURCE_A])).toEqual(
      SOURCE_A
    )
  })

  test('[0] transforms to a chip href but resolves to no source', () => {
    const tree = paragraph([textNode('Nullmarker [0] bleibt folgenlos.')])
    transformCitationMarkers(tree)

    const link = (tree.children ?? []).find((n) => n.type === 'link')
    const parsed = parseCitationHref(link?.url as string)
    expect(parsed).toBe(0)
    expect(
      resolveCitationSource(parsed as number, [SOURCE_A, SOURCE_B])
    ).toBeUndefined()
  })

  test('marker inside an inline code span is left untouched', () => {
    const codeSpan: MarkdownAstNode = { type: 'inlineCode', value: '[1]' }
    const tree = paragraph([
      textNode('Use '),
      codeSpan,
      textNode(' as an example.'),
    ])
    const before = JSON.parse(JSON.stringify(tree))

    transformCitationMarkers(tree)

    expect(tree).toEqual(before)
  })

  test('marker inside a fenced code block is left untouched', () => {
    const root: MarkdownAstNode = {
      type: 'root',
      children: [{ type: 'code', lang: 'text', value: 'result: [1]' }],
    }
    const before = JSON.parse(JSON.stringify(root))

    transformCitationMarkers(root)

    expect(root).toEqual(before)
  })

  test("a real markdown link's label text is left untouched", () => {
    const link: MarkdownAstNode = {
      type: 'link',
      url: 'https://example.com',
      children: [textNode('See [1] here')],
    }
    const tree = paragraph([link])
    const before = JSON.parse(JSON.stringify(tree))

    transformCitationMarkers(tree)

    expect(tree).toEqual(before)
  })

  test('partial marker mid-stream is left as literal text (streaming-safe)', () => {
    const tree = paragraph([textNode('This cites [1')])
    transformCitationMarkers(tree)

    expect(tree).toEqual(paragraph([textNode('This cites [1')]))
  })

  test('markers nested inside non-link, non-code containers (e.g. emphasis) are still transformed', () => {
    const tree = paragraph([
      { type: 'strong', children: [textNode('See [1]')] },
    ])
    transformCitationMarkers(tree)

    expect(tree).toEqual(
      paragraph([
        { type: 'strong', children: [textNode('See'), citationLinkNode(1)] },
      ])
    )
  })
})

const SOURCE_A: ChatSource = {
  id: 'a',
  index: 1,
  type: 'document',
  title: 'Lecture 1',
}
const SOURCE_B: ChatSource = {
  id: 'b',
  index: 2,
  type: 'document',
  title: 'Lecture 2',
}

describe('resolveCitationSource', () => {
  test('happy path: resolves an in-range index', () => {
    expect(resolveCitationSource(1, [SOURCE_A, SOURCE_B])).toEqual(SOURCE_A)
    expect(resolveCitationSource(2, [SOURCE_A, SOURCE_B])).toEqual(SOURCE_B)
  })

  test('out-of-range index (too high or too low) resolves to undefined', () => {
    expect(resolveCitationSource(3, [SOURCE_A, SOURCE_B])).toBeUndefined()
    expect(resolveCitationSource(0, [SOURCE_A, SOURCE_B])).toBeUndefined()
    expect(resolveCitationSource(-1, [SOURCE_A, SOURCE_B])).toBeUndefined()
  })

  test('a message with no sources resolves any marker to undefined', () => {
    expect(resolveCitationSource(1, [])).toBeUndefined()
  })
})

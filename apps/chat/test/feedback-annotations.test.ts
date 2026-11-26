import { describe, expect, it } from 'vitest'
import { buildDocumentBlock } from '@/src/lib/attachments/documentText'
import {
  annotateFeedback,
  type FeedbackItem,
  locateQuote,
} from '@/src/lib/feedback'

const marked = (raw: string, quote: string) => {
  const span = locateQuote(raw, quote)
  return span && raw.slice(span.start, span.end)
}

const item = (id: string, quote: string): FeedbackItem => ({
  id,
  kind: 'improvement',
  index: 0,
  label: id,
  comment: 'comment',
  quote,
})

describe('locateQuote', () => {
  it('marks the learner’s own characters for quotes the server accepts', () => {
    expect(marked('Die Straße ist  nass.', 'Strasse ist nass')).toBe(
      'Straße ist  nass'
    )
    expect(marked('He said “so” — then left', 'said "so" - then')).toBe(
      'said “so” — then'
    )
    expect(marked('diversi­fication works', 'diversification works')).toBe(
      'diversi­fication works'
    )
    expect(marked('ﬁnal line\r\nnext', 'final line next')).toBe(
      'ﬁnal line\r\nnext'
    )
    expect(marked('Café au lait 🙂 ok', 'Café au lait 🙂')).toBe(
      'Café au lait 🙂'
    )
  })

  it('does not mark a misquote, a case change or a too short quote', () => {
    expect(locateQuote('Returns move together.', 'returns move')).toBeNull()
    expect(locateQuote('Returns move together.', 'Returns moved')).toBeNull()
    expect(locateQuote('A b c d', 'b c')).toBeNull()
  })
})

describe('annotateFeedback', () => {
  const work =
    'Please check my paragraph against the rubric.\n\nDiversification reduces risk. Returns do not move together.\n\nThanks!'

  it('shows only the paragraph with the quotes and splits overlapping marks', () => {
    const annotation = annotateFeedback(
      [
        item('a', 'Diversification reduces risk. Returns'),
        item('b', 'Returns do not move together'),
        item('c', ''),
        item('d', 'not in the text at all'),
      ],
      [work]
    )
    expect(annotation).not.toBeNull()
    expect(annotation?.blocks).toHaveLength(1)
    expect(annotation?.blocks[0].gapBefore).toBe(true)
    expect(annotation?.gapAfter).toBe(true)
    expect(annotation?.blocks[0].segments).toEqual([
      { text: 'Diversification reduces risk. ', itemIds: ['a'] },
      { text: 'Returns', itemIds: ['a', 'b'] },
      { text: ' do not move together', itemIds: ['b'] },
      { text: '.', itemIds: [] },
    ])
    expect(annotation?.anchored).toEqual([['a'], ['b']])
    expect(annotation?.unanchored).toEqual(['c', 'd'])
  })

  it('prefers the passage with most quotes, here an attached document', () => {
    const message = `Check this.\n\n${buildDocumentBlock({
      name: 'essay.txt',
      text: 'Bonds pay coupons. Stocks pay dividends.',
    } as Parameters<typeof buildDocumentBlock>[0])}`
    const annotation = annotateFeedback(
      [item('a', 'Bonds pay coupons'), item('b', 'Stocks pay dividends')],
      ['Bonds pay coupons, I wrote earlier.', message]
    )
    expect(annotation?.anchored).toEqual([['a'], ['b']])
    expect(
      annotation?.blocks[0].segments.map((segment) => segment.text).join('')
    ).toBe('Bonds pay coupons. Stocks pay dividends.')
  })

  it('selects remarks on the same passage together', () => {
    const annotation = annotateFeedback(
      [item('a', 'Returns do not move'), item('b', 'Returns do not move')],
      [work]
    )
    expect(annotation?.anchored).toEqual([['a', 'b']])
    expect(annotation?.blocks[0].segments[1]).toEqual({
      text: 'Returns do not move',
      itemIds: ['a', 'b'],
    })
  })

  it('leaves the card as a list when no quote is found', () => {
    expect(annotateFeedback([item('a', '')], [work])).toBeNull()
    expect(
      annotateFeedback([item('a', 'missing words here')], [work])
    ).toBeNull()
  })
})

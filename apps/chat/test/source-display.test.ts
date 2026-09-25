import { describe, expect, test } from 'vitest'
import { extractCitedPages } from '../src/lib/markdown/remarkCitationMarkers'
import {
  formatCitedPageRanges,
  formatTimestamp,
  getDisplayUrl,
  getSourcePageRange,
  getSourceSecondaryLine,
  getSourceTimestamp,
  parseTimestampSeconds,
  type Translate,
} from '../src/lib/sources/sourceDisplay'
import type { ChatSource } from '../src/lib/sources/types'

// Stands in for next-intl's `t`, using the same shape the real English
// messages produce for the three keys this module reads.
const t = ((key: string, values?: Record<string, unknown>) => {
  if (key === 'chat.sources.page') return `p. ${values?.page}`
  if (key === 'chat.sources.video') return 'Video'
  if (key === 'chat.sources.image') return 'Image'
  return key
}) as unknown as Translate

function source(overrides: Partial<ChatSource> = {}): ChatSource {
  return {
    id: 'id',
    index: 1,
    type: 'document',
    title: 'lecture-01.pdf',
    ...overrides,
  }
}

describe('formatTimestamp', () => {
  test.each([
    [0, '0:00'],
    [65, '1:05'],
    [754, '12:34'],
    [3723, '1:02:03'],
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatTimestamp(seconds)).toBe(expected)
  })
})

describe('parseTimestampSeconds', () => {
  test.each([
    ['90', 90],
    ['90s', 90],
    ['1:30', 90],
    ['1:02:03', 3723],
    ['1m30s', 90],
    ['1h2m3s', 3723],
  ])('reads %s as %i seconds', (value, expected) => {
    expect(parseTimestampSeconds(value)).toBe(expected)
  })

  // A labeled page is free-form, so anything that is not a time notation must
  // not be mistaken for one.
  test.each([
    ['Kapitel IV'],
    ['IV'],
    [''],
    ['12:99'],
    ['abc'],
  ])('rejects %s', (value) => {
    expect(parseTimestampSeconds(value)).toBeUndefined()
  })
})

describe('getSourceTimestamp', () => {
  test('reads a structured video start timestamp', () => {
    expect(
      getSourceTimestamp(source({ type: 'video', startSec: 754, endSec: 800 }))
    ).toBe('12:34')
  })

  test('structured video start wins over legacy timestamp channels', () => {
    expect(
      getSourceTimestamp(
        source({
          type: 'video',
          startSec: 754,
          labeledPage: '1:15',
          url: 'https://example.com/v/abc#t=10',
        })
      )
    ).toBe('12:34')
  })

  test('reads a clock-valued labeled page', () => {
    expect(
      getSourceTimestamp(source({ type: 'video', labeledPage: '12:34' }))
    ).toBe('12:34')
  })

  test('does not read a bare numeric page label as seconds', () => {
    expect(
      getSourceTimestamp(source({ type: 'video', labeledPage: '12' }))
    ).toBeUndefined()
  })

  test.each([
    ['t', 'https://example.com/v/abc?t=90'],
    ['start', 'https://example.com/v/abc?start=90'],
    ['hash', 'https://example.com/v/abc#t=1m30s'],
  ])('reads the %s parameter from the url', (_label, url) => {
    expect(getSourceTimestamp(source({ type: 'video', url }))).toBe('1:30')
  })

  test('falls back to the url when the labeled page is not a time', () => {
    expect(
      getSourceTimestamp(
        source({
          type: 'video',
          labeledPage: 'Kapitel IV',
          url: 'https://example.com/v/abc?t=90',
        })
      )
    ).toBe('1:30')
  })

  test('is undefined when neither channel carries a time', () => {
    expect(
      getSourceTimestamp(
        source({ type: 'video', url: 'https://example.com/v/abc' })
      )
    ).toBeUndefined()
  })
})

describe('getDisplayUrl', () => {
  test('strips scheme, www and a trailing slash', () => {
    expect(getDisplayUrl('https://www.example.com/wiki/page/')).toBe(
      'example.com/wiki/page'
    )
  })

  test('returns the bare host for a root url', () => {
    expect(getDisplayUrl('https://example.com/')).toBe('example.com')
  })

  test('keeps the host visible when truncating a long path', () => {
    const result = getDisplayUrl(
      `https://example.com/${'a'.repeat(120)}/final-segment`
    )

    // Anchored regex, not startsWith: CodeQL reads a `startsWith('example.com')`
    // as an (incomplete) URL sanitization check, which this display-format
    // assertion is not. The ellipsis is the truncation marker after the host.
    expect(result).toMatch(/^example\.com…/)
    expect(result?.endsWith('final-segment')).toBe(true)
    expect(result?.length).toBeLessThanOrEqual(49)
  })

  test('returns undefined for an unparseable url', () => {
    expect(getDisplayUrl('not a url')).toBeUndefined()
  })
})

describe('getSourceSecondaryLine', () => {
  test.each(['36', ' 36 '])('uses the publisher label (%s)', (label) => {
    expect(
      getSourceSecondaryLine(source({ page: 36, labeledPage: label }), t)
    ).toBe('p. 36')
  })

  test('documents lead with the page', () => {
    expect(
      getSourceSecondaryLine(
        source({
          page: 13,
          labeledPage: '12',
          url: 'https://example.com/lecture-01.pdf',
        }),
        t
      )
    ).toBe('p. 12')
  })

  test('documents show only the Roman publisher label', () => {
    expect(
      getSourceSecondaryLine(source({ page: 4, labeledPage: 'IV' }), t)
    ).toBe('p. IV')
  })

  test('documents keep a bare numeric publisher label', () => {
    expect(
      getSourceSecondaryLine(source({ page: 4, labeledPage: '12' }), t)
    ).toBe('p. 12')
  })

  // The retrieved envelope is a spread, not a location: printing it would put
  // "S. 2–127" on the card of a one-question answer about a 127-page script.
  test('documents never show a publisher-labelled retrieval span', () => {
    expect(
      getSourceSecondaryLine(
        source({
          page: 2,
          pageEnd: 127,
          labeledPage: '2',
          labeledPageEnd: '127',
        }),
        t
      )
    ).toBeNull()
  })

  test('documents fall back to the url instead of the physical span', () => {
    expect(
      getSourceSecondaryLine(
        source({
          page: 6,
          pageEnd: 89,
          url: 'https://example.com/lecture-01.pdf',
        }),
        t
      )
    ).toBe('example.com/lecture-01.pdf')
  })

  test('images keep their type label instead of the retrieval span', () => {
    expect(
      getSourceSecondaryLine(
        source({
          type: 'image',
          page: 6,
          pageEnd: 8,
          labeledPage: '6',
          labeledPageEnd: '8',
        }),
        t
      )
    ).toBe('Image')
  })

  test('documents without a page fall back to the url', () => {
    expect(
      getSourceSecondaryLine(
        source({ url: 'https://www.example.com/handout.pdf' }),
        t
      )
    ).toBe('example.com/handout.pdf')
  })

  test('web links lead with the url even when a page exists', () => {
    expect(
      getSourceSecondaryLine(
        source({
          type: 'link',
          page: 2,
          url: 'https://example.com/wiki/topic',
        }),
        t
      )
    ).toBe('example.com/wiki/topic')
  })

  test('videos show their timestamp', () => {
    expect(
      getSourceSecondaryLine(
        source({ type: 'video', url: 'https://example.com/v/abc?t=754' }),
        t
      )
    ).toBe('12:34')
  })

  test('videos without a timestamp keep the type label', () => {
    expect(getSourceSecondaryLine(source({ type: 'video' }), t)).toBe('Video')
  })

  test('images show the type label and page', () => {
    expect(
      getSourceSecondaryLine(
        source({ type: 'image', page: 13, labeledPage: '7' }),
        t
      )
    ).toBe('Image · p. 7')
  })

  test('is null when nothing is known', () => {
    expect(getSourceSecondaryLine(source(), t)).toBeNull()
  })

  // The answer knows which pages it used; retrieval only knows which chunks
  // came back, so a cited range wins over the retrieved envelope.
  test('a cited range wins over the retrieved envelope', () => {
    expect(
      getSourceSecondaryLine(
        source({
          page: 2,
          pageEnd: 95,
          labeledPage: '2',
          labeledPageEnd: '95',
        }),
        t,
        '6–7'
      )
    ).toBe('p. 6–7')
  })

  test('renders the smallest set of cited ranges', () => {
    expect(
      getSourceSecondaryLine(source({ page: 2, pageEnd: 95 }), t, '6–7, 12')
    ).toBe('p. 6–7, 12')
  })

  test('shows no page when the answer cites none and retrieval spread', () => {
    expect(
      getSourceSecondaryLine(
        source({
          page: 2,
          pageEnd: 95,
          labeledPage: '2',
          labeledPageEnd: '95',
        }),
        t
      )
    ).toBeNull()
  })

  // Retrieval that returned exactly one page does name a location, so the line
  // survives even when the answer itself carries no page detail.
  test('keeps a single retrieved label when the answer cites no page', () => {
    expect(
      getSourceSecondaryLine(
        source({ page: 2, pageEnd: 2, labeledPage: '2' }),
        t
      )
    ).toBe('p. 2')
  })

  test('a cited range also applies to media sources', () => {
    expect(
      getSourceSecondaryLine(
        source({ type: 'image', page: 2, pageEnd: 95 }),
        t,
        '6–7'
      )
    ).toBe('Image · p. 6–7')
  })

  // The seam a participant sees: the model's page detail in the answer decides
  // the page line on the card, so a cited card never claims the span of every
  // chunk retrieval happened to return.
  test("the answer's page detail reaches the card line", () => {
    const cited = extractCitedPages('Wie in [1, S. 6–7] beschrieben [2].')
    expect(
      getSourceSecondaryLine(
        source({
          page: 2,
          pageEnd: 95,
          labeledPage: '2',
          labeledPageEnd: '95',
        }),
        t,
        formatCitedPageRanges(cited.get(1) ?? [])
      )
    ).toBe('p. 6–7')
  })
})

describe('formatCitedPageRanges', () => {
  test('merges only consecutive pages into ranges', () => {
    expect(formatCitedPageRanges([2, 3, 7])).toBe('2–3, 7')
    expect(formatCitedPageRanges([12])).toBe('12')
    expect(formatCitedPageRanges([5, 4, 3])).toBe('3–5')
    expect(formatCitedPageRanges([1, 3, 5])).toBe('1, 3, 5')
  })

  test('ignores duplicates, non-integers and empty input', () => {
    expect(formatCitedPageRanges([7, 7, Number.NaN])).toBe('7')
    expect(formatCitedPageRanges([])).toBeUndefined()
  })
})

describe('getSourcePageRange', () => {
  test('drops a labelled span', () => {
    expect(
      getSourcePageRange(
        source({ page: 6, pageEnd: 89, labeledPage: '8', labeledPageEnd: '18' })
      )
    ).toBeUndefined()
  })

  test('drops the physical envelope', () => {
    expect(getSourcePageRange(source({ page: 6, pageEnd: 89 }))).toBeUndefined()
  })

  test('keeps a single label single', () => {
    expect(getSourcePageRange(source({ page: 4, labeledPage: '12' }))).toBe(
      '12'
    )
  })

  test.each([
    ['a single physical page', { page: 13 }],
    ['an envelope whose extremes tie', { page: 13, pageEnd: 13 }],
    ['no page information at all', {}],
  ])('is undefined for %s', (_label, overrides) => {
    expect(getSourcePageRange(source(overrides))).toBeUndefined()
  })
})

test.each([
  'document',
  'image',
  'video',
] as const)('never substitutes physical pages for missing %s labels', (type) => {
  for (const labeledPage of [undefined, '', '   ']) {
    expect(
      getSourceSecondaryLine(source({ type, page: 13, labeledPage }), t)
    ).toBe(getSourceSecondaryLine(source({ type }), t))
  }
})

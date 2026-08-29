import { getElementSourceLocatorTarget } from '@klicker-uzh/types'
import { describe, expect, test } from 'vitest'
import {
  formatTimestamp,
  getDisplayUrl,
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
  if (key === 'chat.sources.pages') return `pp. ${values?.from}–${values?.to}`
  if (key === 'chat.sources.pdfPage') return `PDF p. ${values?.page}`
  if (key === 'chat.sources.pdfPages')
    return `PDF pp. ${values?.from}–${values?.to}`
  if (key === 'chat.sources.unavailable') return 'Source link unavailable'
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
  test('shows publisher labels before physical PDF pages for grouped references', () => {
    expect(
      getSourceSecondaryLine(
        source({
          elementReference: {
            sourceId: 'script',
            kind: 'DOCUMENT',
            title: 'Course script',
            canonicalUrl: 'https://example.org/script.pdf',
            chunkIds: ['chunk-1', 'chunk-7'],
            locators: [
              {
                type: 'PAGE_RANGE',
                pageFrom: 1,
                pageTo: 4,
                labelFrom: 'i',
                labelTo: 'iv',
              },
              { type: 'PAGE_RANGE', pageFrom: 7, pageTo: 9 },
            ],
          },
        }),
        t
      )
    ).toBe('pp. i–iv (PDF pp. 1–4), pp. 7–9')
  })

  test('marks a grouped reference without locators as unavailable', () => {
    expect(
      getSourceSecondaryLine(
        source({
          elementReference: {
            sourceId: 'legacy',
            kind: 'DOCUMENT',
            title: 'Legacy source',
            chunkIds: ['chunk-1'],
            locators: [],
          },
        }),
        t
      )
    ).toBe('Source link unavailable')
  })

  test('documents lead with the page', () => {
    expect(
      getSourceSecondaryLine(
        source({ page: 12, url: 'https://example.com/lecture-01.pdf' }),
        t
      )
    ).toBe('p. 12')
  })

  test('documents pair the page with a labeled page', () => {
    expect(
      getSourceSecondaryLine(source({ page: 4, labeledPage: 'IV' }), t)
    ).toBe('p. 4 · IV')
  })

  test('documents keep a bare numeric publisher label', () => {
    expect(
      getSourceSecondaryLine(source({ page: 4, labeledPage: '12' }), t)
    ).toBe('p. 4 · 12')
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
    expect(getSourceSecondaryLine(source({ type: 'image', page: 7 }), t)).toBe(
      'Image · p. 7'
    )
  })

  test('is null when nothing is known', () => {
    expect(getSourceSecondaryLine(source(), t)).toBeNull()
  })
})

describe('getElementSourceLocatorTarget', () => {
  test('opens a public PDF at the exact physical page', () => {
    expect(
      getElementSourceLocatorTarget(
        {
          sourceId: 'script',
          kind: 'DOCUMENT',
          title: 'Course script',
          canonicalUrl: 'https://example.org/script.pdf',
          chunkIds: ['chunk-1'],
          locators: [],
        },
        { type: 'PAGE_RANGE', pageFrom: 7, pageTo: 9 }
      )
    ).toBe('https://example.org/script.pdf#page=7')
  })

  test('returns an exact public web anchor but disables private and signed URLs', () => {
    const source = {
      sourceId: 'website',
      kind: 'WEB' as const,
      title: 'Website',
      chunkIds: ['chunk-1'],
      locators: [],
    }
    expect(
      getElementSourceLocatorTarget(source, {
        type: 'WEB_ANCHOR',
        url: 'https://example.org/chapter#section-2',
      })
    ).toBe('https://example.org/chapter#section-2')
    expect(
      getElementSourceLocatorTarget(source, {
        type: 'WEB_ANCHOR',
        url: 'http://localhost:1417/private',
      })
    ).toBeUndefined()
    expect(
      getElementSourceLocatorTarget(source, {
        type: 'WEB_ANCHOR',
        url: 'https://example.org/chapter?token=temporary',
      })
    ).toBeUndefined()
    expect(
      getElementSourceLocatorTarget(source, {
        type: 'WEB_ANCHOR',
        url: 'https://example.org/chapter?X-Amz-Signature=temporary',
      })
    ).toBeUndefined()
    expect(
      getElementSourceLocatorTarget(source, {
        type: 'WEB_ANCHOR',
        url: 'https://fcc.gov/document#section-2',
      })
    ).toBe('https://fcc.gov/document#section-2')
  })
})

import { describe, expect, test } from 'vitest'
import {
  getDocQueryResult,
  getPublicSourceUrl,
} from '../src/lib/sources/docQueryResult'
import { normalizeSourcesFromParts } from '../src/lib/sources/normalizeSources'
import { getSourceNavigationUrl } from '../src/lib/sources/sourceUrl'

describe('retrieval display independent of citation eligibility', () => {
  const unnamed = {
    reference:
      'http://backend.stg.svc.cluster.local/api/ingestion/resources/fixture/3',
    chunks: [
      { content: 'First synthetic passage', page_number: 3 },
      { content: 'Second synthetic passage', page_number: 8 },
    ],
  }
  test('retains every unnamed chunk without shifting existing citation identity', () => {
    const named = {
      reference: 'https://example.org/lecture.pdf',
      title: 'Lecture',
      chunks: [{ content: 'Named passage', page_number: 9 }],
    }
    const payload = { mode: 'documents', sources: [unnamed, named] }
    const displayed = getDocQueryResult(payload)
    expect(displayed.state).toBe('success')
    expect(displayed.groups[0].chunks.map((c) => c.page)).toEqual([3, 8])
    expect(displayed.groups[0].citationId).toBeUndefined()
    const citations = normalizeSourcesFromParts([
      { type: 'tool-call', toolName: 'KB_doc_query', result: payload },
    ])
    expect(citations).toHaveLength(1)
    expect(displayed.groups[1].citationId).toBe(citations[0].id)
    expect(citations[0].index).toBe(1)
  })
  test('preserves supplied origin independently of internal reference and identity', () => {
    const source_url = 'https://example.org/lecture.pdf?edition=2#page=3'
    const result = getDocQueryResult({
      mode: 'documents',
      sources: [{ ...unnamed, source_url }],
    })
    expect(result.groups[0].url).toBe(source_url)
    expect(result.groups[0].chunks[1].url).toBe(
      'https://example.org/lecture.pdf?edition=2#page=8'
    )
    expect(result.groups[0].citationId).toBeUndefined()
  })
  test.each([
    [{ sources: [] }, 'empty'],
    [{ sources: [null, 4] }, 'unknown'],
    [{ arbitrary: true }, 'unknown'],
    ['not json', 'unknown'],
    [{ isError: true, structuredContent: { sources: [] } }, 'failed'],
    [
      {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: 'private upstream detail' }),
          },
        ],
      },
      'failed',
    ],
    [
      JSON.stringify({
        structuredContent: {
          result: JSON.stringify({ mode: 'documents', sources: [unnamed] }),
        },
        content: [],
      }),
      'success',
    ],
  ])('classifies envelope state without treating missing metadata as empty', (input, state) => {
    expect(getDocQueryResult(input).state).toBe(state)
  })
  test.each([
    'javascript:alert(1)',
    'https://user:password@example.org/file.pdf',
    'http://127.0.0.1/x',
    'http://10.2.3.4/x',
    'http://[::1]/x',
    'http://backend.stg.svc.cluster.local/x',
    'https://example.org/api/ingestion/resources/private/3',
    'https://example.org/api/%69ngestion/resources/fixture/3',
  ])('does not expose unsafe transport targets', (value) => {
    expect(getPublicSourceUrl(value)).toBeUndefined()
  })
  test('uses each video chunk timestamp without overwriting an origin fragment', () => {
    const result = (source_url: string) =>
      getDocQueryResult({
        mode: 'documents',
        sources: [
          {
            title: 'Synthetic video',
            source_type: 'video',
            source_url,
            chunks: [
              { content: 'First', start_sec: 61, end_sec: 70 },
              { content: 'Second', start_sec: 120, end_sec: 119 },
            ],
          },
        ],
      })
    const origin = 'https://www.youtube.com/watch?v=synthetic&list=course'
    const chunks = result(origin).groups[0].chunks
    expect(chunks[0].url).toBe(`${origin}&t=61s`)
    expect(chunks[1].url).toBe(`${origin}&t=120s`)
    expect(chunks[1].endSec).toBeUndefined()
    expect(result(`${origin}#section`).groups[0].chunks[0].url).toBe(
      `${origin}#section`
    )
  })
})

describe('physical PDF navigation', () => {
  test('preserves opaque fragment bytes', () => {
    expect(
      getSourceNavigationUrl(
        'https://example.org/file.pdf#chapter#part&zoom=100',
        13
      )
    ).toBe('https://example.org/file.pdf#chapter#part&zoom=100&page=13')
  })
  test.each([
    [
      'https://example.org/file.pdf',
      13,
      'https://example.org/file.pdf#page=13',
    ],
    [
      'https://example.org/FILE.PDF?edition=2#page=1&zoom=100',
      13,
      'https://example.org/FILE.PDF?edition=2#zoom=100&page=13',
    ],
    [
      'https://example.org/file.pdf#chapter%202',
      13,
      'https://example.org/file.pdf#chapter%202&page=13',
    ],
    [
      'https://example.org/file.html#chapter',
      13,
      'https://example.org/file.html#chapter',
    ],
    ['https://example.org/file.pdf', 0, 'https://example.org/file.pdf'],
    ['https://example.org/file.pdf', 1.5, 'https://example.org/file.pdf'],
    ['https://example.org/file.pdf', undefined, 'https://example.org/file.pdf'],
    ['http://127.0.0.1/file.pdf', 13, undefined],
    [undefined, 13, undefined],
  ])('builds only a safe PDF target', (url, page, expected) => {
    expect(getSourceNavigationUrl(url, page)).toBe(expected)
  })
  test('retains labels and identity while navigating each physical chunk', () => {
    const url = 'https://example.org/file.pdf'
    const result = getDocQueryResult({
      mode: 'documents',
      sources: [
        {
          title: 'Synthetic',
          reference: url,
          chunks: [
            { content: 'A', page_number: 13, labeled_page_number: '9' },
            { content: 'B', page_number: 4, labeled_page_number: 'IV' },
          ],
        },
      ],
    })
    expect(result.groups[0].url).toBe(url)
    expect(
      result.groups[0].chunks.map(({ labeledPage, url }) => [labeledPage, url])
    ).toEqual([
      ['9', `${url}#page=13`],
      ['IV', `${url}#page=4`],
    ])
  })
})

import { describe, expect, test } from 'vitest'
import {
  isDocQueryToolName,
  normalizeSourcesFromParts,
} from '../src/lib/sources/normalizeSources'

function toolCallPart(toolName: string, result: unknown, isError = false) {
  return { type: 'tool-call', toolName, result, isError }
}

describe('isDocQueryToolName', () => {
  test('matches the MCP-namespaced tool name', () => {
    expect(isDocQueryToolName('KB_doc_query')).toBe(true)
  })

  test('matches the bare tool name', () => {
    expect(isDocQueryToolName('doc_query')).toBe(true)
  })

  // `toSafeToolName` appends 8 hex characters of a sha256 when two servers
  // expose the same tool name, or when the namespaced name exceeds 64 chars.
  test('matches the hash-disambiguated tool name', () => {
    expect(isDocQueryToolName('KB_doc_query_1a2b3c4d')).toBe(true)
    expect(isDocQueryToolName('doc_query_deadbeef')).toBe(true)
  })

  test('rejects unrelated tool names', () => {
    expect(isDocQueryToolName('doc_query_helper')).toBe(false)
    expect(isDocQueryToolName('some_other_tool')).toBe(false)
  })

  test('rejects a suffix that is not an 8-character hash', () => {
    expect(isDocQueryToolName('KB_doc_query_1a2b3c4')).toBe(false)
    expect(isDocQueryToolName('KB_doc_query_1a2b3c4de')).toBe(false)
    expect(isDocQueryToolName('KB_doc_query_1a2b3c4g')).toBe(false)
  })
})

describe('normalizeSourcesFromParts', () => {
  test('returns [] for an empty parts array', () => {
    expect(normalizeSourcesFromParts([])).toEqual([])
  })

  test('answer mode happy path', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'Some answer text.',
        sources_used: 1,
        sources: [
          {
            expert: 'Prof. Muster',
            source_url: 'https://example.com/course/lecture-01.pdf',
            source_type: 'pdf',
            file_name: 'lecture-01.pdf',
            page_number: 3,
            labeled_page_number: '3',
          },
        ],
      }),
    ])

    expect(result).toEqual([
      {
        id: 'url:https://example.com/course/lecture-01.pdf|3|3',
        index: 1,
        type: 'document',
        title: 'lecture-01.pdf',
        page: 3,
        labeledPage: '3',
        url: 'https://example.com/course/lecture-01.pdf',
      },
    ])
  })

  test('drops "N/A" fields and falls back to the expert name as title', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'Some answer text.',
        sources_used: 1,
        sources: [
          {
            expert: 'Prof. Muster',
            source_url: 'N/A',
            source_type: 'N/A',
            file_name: 'N/A',
            page_number: 'N/A',
            labeled_page_number: 'N/A',
          },
        ],
      }),
    ])

    expect(result).toEqual([
      {
        id: 'title:Prof. Muster||',
        index: 1,
        type: 'document',
        title: 'Prof. Muster',
      },
    ])
  })

  test('parses a result that arrives as a JSON string', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart(
        'KB_doc_query',
        JSON.stringify({
          answer: 'text',
          sources_used: 1,
          sources: [
            {
              expert: 'Prof. Muster',
              source_url: 'https://example.com/a.pdf',
              source_type: 'pdf',
              file_name: 'a.pdf',
              page_number: 1,
            },
          ],
        })
      ),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'a.pdf', page: 1 })
  })

  test('parses a result that arrives as an already-parsed object', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources_used: 1,
        sources: [
          {
            expert: 'Prof. Muster',
            source_url: 'https://example.com/b.pdf',
            source_type: 'pdf',
            file_name: 'b.pdf',
            page_number: 2,
          },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ title: 'b.pdf', page: 2 })
  })

  test('documents mode with excerpt and page from the first chunk', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        mode: 'documents',
        summary: { count: 1 },
        sources: [
          {
            reference: 'lecture-02.pdf',
            reference_type: 'pdf',
            source_type: 'document',
            expert_id: 'expert-1',
            title: 'Lecture 02',
            chunks: [
              {
                content: 'This is the relevant excerpt text from the chunk.',
                page_number: 5,
                labeled_page_number: '5',
              },
            ],
          },
        ],
      }),
    ])

    expect(result).toEqual([
      {
        id: 'title:Lecture 02|5|5',
        index: 1,
        type: 'document',
        title: 'Lecture 02',
        page: 5,
        labeledPage: '5',
        excerpt: 'This is the relevant excerpt text from the chunk.',
      },
    ])
  })

  test('documents mode preserves structured video citation metadata', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('IW_doc_query', {
        mode: 'documents',
        sources: [
          {
            reference: 'urn:video-ingestion:sha256:video#t=42.0,59.0',
            reference_type: 'url',
            source_type: 'video',
            expert_id: 'IuW Video',
            title: 'Lecture 1 — 0:42–0:59',
            video_name: 'lecture-01.mp4',
            display_name: 'Lecture 1',
            chunks: [
              {
                content: 'Video context',
                start_sec: 42,
                end_sec: 59,
                representative_frame_sec: 50,
                labeled_page_number: '0:42',
              },
            ],
          },
        ],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      index: 1,
      type: 'video',
      title: 'Lecture 1 — 0:42–0:59',
      labeledPage: '0:42',
      startSec: 42,
      endSec: 59,
    })
  })

  test('documents mode drops a reversed structured end time', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('IW_doc_query', {
        mode: 'documents',
        sources: [
          {
            reference: 'urn:video-ingestion:sha256:video#t=42.0,41.0',
            source_type: 'video',
            title: 'Lecture 1',
            chunks: [
              {
                content: 'Video context',
                start_sec: 42,
                end_sec: 41,
                labeled_page_number: '0:42',
              },
            ],
          },
        ],
      }),
    ])

    expect(result[0]).toMatchObject({
      type: 'video',
      startSec: 42,
      labeledPage: '0:42',
    })
    expect(result[0]?.endSec).toBeUndefined()
  })

  test('structured video ranges participate in source deduplication', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('IW_doc_query', {
        mode: 'documents',
        sources: [
          {
            reference: 'urn:video-ingestion:sha256:video#t=42.0,59.0',
            source_type: 'video',
            title: 'Lecture 1',
            chunks: [{ content: 'First', start_sec: 42, end_sec: 59 }],
          },
          {
            reference: 'urn:video-ingestion:sha256:video#t=42.0,75.0',
            source_type: 'video',
            title: 'Lecture 1',
            chunks: [{ content: 'Second', start_sec: 42, end_sec: 75 }],
          },
        ],
      }),
    ])

    expect(
      result.map(({ startSec, endSec }) => ({ startSec, endSec }))
    ).toEqual([
      { startSec: 42, endSec: 59 },
      { startSec: 42, endSec: 75 },
    ])
  })

  test('documents mode truncates a long excerpt to ~240 chars', () => {
    const longContent = 'x'.repeat(300)
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        mode: 'documents',
        sources: [
          {
            reference: 'https://example.com/big-doc.pdf',
            reference_type: 'pdf',
            chunks: [{ content: longContent, page_number: 1 }],
          },
        ],
      }),
    ])

    expect(result[0]?.excerpt?.length).toBeLessThanOrEqual(241)
    expect(result[0]?.title).toBe('big-doc.pdf')
    expect(result[0]?.url).toBe('https://example.com/big-doc.pdf')
  })

  test('garbage JSON string yields no sources', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', '{not valid json'),
    ])

    expect(result).toEqual([])
  })

  test('an error payload yields no sources', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', { error: 'upstream failure' }),
    ])

    expect(result).toEqual([])
  })

  test('ignores parts with a non-doc_query tool name', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_other_tool', {
        answer: 'text',
        sources: [
          {
            expert: 'Prof. Muster',
            source_url: 'https://example.com/a.pdf',
            file_name: 'a.pdf',
          },
        ],
      }),
    ])

    expect(result).toEqual([])
  })

  test('ignores tool-call parts flagged as isError', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart(
        'KB_doc_query',
        {
          answer: 'text',
          sources: [
            {
              expert: 'Prof. Muster',
              source_url: 'https://example.com/a.pdf',
              file_name: 'a.pdf',
            },
          ],
        },
        true
      ),
    ])

    expect(result).toEqual([])
  })

  test('dedupes across two doc_query calls and continues numbering', () => {
    const sourceA = {
      expert: 'Prof. Muster',
      source_url: 'https://example.com/a.pdf',
      file_name: 'a.pdf',
      page_number: 1,
    }
    const sourceB = {
      expert: 'Prof. Muster',
      source_url: 'https://example.com/b.pdf',
      file_name: 'b.pdf',
      page_number: 1,
    }

    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'first',
        sources: [sourceA, sourceB],
      }),
      toolCallPart('KB_doc_query', {
        answer: 'second',
        // sourceA repeats (same url + page) and must be deduped; sourceC is new
        sources: [
          sourceA,
          {
            expert: 'Prof. Muster',
            source_url: 'https://example.com/c.pdf',
            file_name: 'c.pdf',
            page_number: 1,
          },
        ],
      }),
    ])

    expect(result.map((source) => source.title)).toEqual([
      'a.pdf',
      'b.pdf',
      'c.pdf',
    ])
    expect(result.map((source) => source.index)).toEqual([1, 2, 3])
  })

  test('caps the total number of sources at 12', () => {
    const sources = Array.from({ length: 20 }, (_, i) => ({
      expert: 'Prof. Muster',
      source_url: `https://example.com/doc-${i}.pdf`,
      file_name: `doc-${i}.pdf`,
      page_number: i,
    }))

    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', { answer: 'text', sources }),
    ])

    expect(result).toHaveLength(12)
    expect(result[11]?.index).toBe(12)
  })

  test('accepts page_number as a numeric string', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources: [
          {
            expert: 'Prof. Muster',
            source_url: 'https://example.com/a.pdf',
            file_name: 'a.pdf',
            page_number: '7',
          },
        ],
      }),
    ])

    expect(result[0]?.page).toBe(7)
  })

  test('unwraps the MCP CallToolResult envelope with JSON text content', () => {
    // Production shape: @ai-sdk/mcp without an outputSchema returns the raw
    // CallToolResult envelope, whose text content holds the doc_query JSON.
    const payload = {
      answer: 'text',
      sources_used: 1,
      sources: [
        {
          expert: 'math',
          source_url: 'https://example.com/kapitel-4.pdf',
          source_type: 'pdf',
          file_name: 'kapitel-4.pdf',
          page_number: 4,
        },
      ],
    }

    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        content: [{ type: 'text', text: JSON.stringify(payload) }],
        isError: false,
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('kapitel-4.pdf')
    expect(result[0]?.page).toBe(4)
  })

  test('prefers structuredContent over text content in the envelope', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        content: [{ type: 'text', text: '{"answer":"stale","sources":[]}' }],
        structuredContent: {
          answer: 'text',
          sources: [
            {
              expert: 'math',
              file_name: 'from-structured.pdf',
              page_number: 2,
            },
          ],
        },
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('from-structured.pdf')
  })

  test('envelope with non-JSON text content yields no sources', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        content: [{ type: 'text', text: 'plain text, not JSON' }],
      }),
    ])

    expect(result).toEqual([])
  })

  // `source_url` is untrusted external input that the source card renders
  // straight into an `href`, so only http(s) may become a link target. The
  // card must still appear — dropping the source entirely would hide material
  // the answer cites.
  test.each([
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['relative path', '/files/lecture-01.pdf'],
  ])('answer mode keeps the card but drops a %s source_url', (_label, sourceUrl) => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources: [{ file_name: 'lecture-01.pdf', source_url: sourceUrl }],
      }),
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('lecture-01.pdf')
    expect(result[0]?.url).toBeUndefined()
  })

  // `source_type` is a free-text label from the doc_query pipeline, and the
  // type it maps to decides both the card icon and which of the two grids in
  // `SourcesSection` the card lands in. Every other fixture here is a
  // document, so these cover the remaining branches of `inferSourceType`.
  test.each([
    ['video', 'video', 'video'],
    ['youtube', 'youtube', 'video'],
    ['image', 'image', 'image'],
    ['figure', 'figure', 'image'],
    ['mixed case', 'Video Recording', 'video'],
  ])('maps a %s source_type to the %s type', (_label, sourceType, expected) => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources: [
          {
            file_name: 'vorlesung-04.mp4',
            source_type: sourceType,
            source_url: 'https://example.com/vorlesung-04.mp4',
          },
        ],
      }),
    ])

    expect(result[0]?.type).toBe(expected)
  })

  // A URL whose last path segment carries no file extension is a page to open,
  // not a document to cite by name.
  test('maps an extensionless url to the link type', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources: [
          {
            expert: 'Course wiki',
            source_url: 'https://example.com/wiki/expected-value',
          },
        ],
      }),
    ])

    expect(result[0]?.type).toBe('link')
    expect(result[0]?.title).toBe('expected-value')
  })

  test('answer mode keeps an https source_url as the link target', () => {
    const result = normalizeSourcesFromParts([
      toolCallPart('KB_doc_query', {
        answer: 'text',
        sources: [
          {
            file_name: 'lecture-01.pdf',
            source_url: 'https://example.com/lecture-01.pdf',
          },
        ],
      }),
    ])

    expect(result[0]?.url).toBe('https://example.com/lecture-01.pdf')
  })
})

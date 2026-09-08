import { expect, test } from 'vitest'
import { sanitizeDocQueryResult } from '../src/services/docQueryResult'

test('removes gateway destinations from both MCP representations without losing chunks', () => {
  const reference =
    'https://api.example.test/api/ingestion/resources/fixture?sig=test'
  const payload = {
    sources: [
      { reference, chunks: [{ content: 'Synthetic excerpt', page_number: 2 }] },
    ],
  }
  const result = sanitizeDocQueryResult({
    structuredContent: { result: JSON.stringify(payload) },
    content: [{ type: 'text', text: JSON.stringify(payload) }],
  }) as {
    structuredContent: { result: string }
    content: Array<{ type: string; text: string }>
  }
  const structured = JSON.parse(result.structuredContent.result)
  expect(JSON.parse(result.content[0].text)).toEqual(structured)
  expect(structured.sources[0].chunks).toEqual(payload.sources[0].chunks)
  expect(structured.sources[0].reference).toMatch(/^document-[a-f0-9]{16}$/)
  expect(JSON.stringify(result)).not.toContain(reference)
  expect(payload.sources[0].reference).toBe(reference)
})

test('preserves public citation URLs and ordinary values', () => {
  const result = {
    url: 'https://example.test/source.pdf',
    count: 1,
    empty: null,
  }
  expect(sanitizeDocQueryResult(result)).toEqual(result)
})

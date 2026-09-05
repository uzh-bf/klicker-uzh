import { describe, expect, test } from 'vitest'
import {
  getDocQueryChipState,
  getDocQueryPanelContent,
  parseDocQueryArgsQuery,
} from '../src/components/tool-fallback'

const TOOL_NAME = 'KB_doc_query'

function baseParams(
  overrides: Partial<Parameters<typeof getDocQueryChipState>[0]> = {}
) {
  return {
    toolName: TOOL_NAME,
    isRunning: false,
    isFailed: false,
    result: undefined,
    isError: false,
    ...overrides,
  }
}

describe('getDocQueryChipState', () => {
  // Note: `isFailed` and `isRunning` are mutually exclusive by contract (the
  // caller derives `isFailed` as `isError && !isRunning`), so there is no
  // "both true" case to guard against here.
  test('running, regardless of a stale/partial result', () => {
    expect(
      getDocQueryChipState(baseParams({ isRunning: true, result: {} }))
    ).toBe('running')
  })

  test('failed takes precedence over a missing/empty result', () => {
    expect(getDocQueryChipState(baseParams({ isFailed: true }))).toBe('failed')
  })

  test('done with no result yet (e.g. not surfaced) reads as plain done', () => {
    expect(getDocQueryChipState(baseParams({ result: undefined }))).toBe('done')
  })

  test('done with at least one normalized source', () => {
    const result = {
      answer: 'Some answer text.',
      sources_used: 1,
      sources: [
        {
          expert: 'Prof. Muster',
          source_url: 'https://example.com/course/lecture-01.pdf',
          source_type: 'pdf',
          file_name: 'lecture-01.pdf',
          page_number: 3,
        },
      ],
    }
    expect(getDocQueryChipState(baseParams({ result }))).toBe('done')
  })

  test('done with a result present but zero normalized sources is doneEmpty', () => {
    const result = { answer: 'No relevant material found.', sources: [] }
    expect(getDocQueryChipState(baseParams({ result }))).toBe('doneEmpty')
  })

  test('done with garbage/unparseable result stays plain done, not a crash', () => {
    expect(getDocQueryChipState(baseParams({ result: 'not json {' }))).toBe(
      'done'
    )
  })

  // A cancelled call leaves the in-flight placeholder behind as the result
  // (see `hooks/useChatResponse.ts`); claiming the search found nothing would
  // be worse than the neutral label.
  test.each([
    'Loading...',
    'Executing...',
  ])('settled call still holding the %s placeholder reads as plain done', (placeholder) => {
    expect(getDocQueryChipState(baseParams({ result: placeholder }))).toBe(
      'done'
    )
  })
})

describe('parseDocQueryArgsQuery', () => {
  test('extracts the query field from valid args JSON', () => {
    expect(
      parseDocQueryArgsQuery(JSON.stringify({ query: 'What is the deadline?' }))
    ).toBe('What is the deadline?')
  })

  test('ignores extra fields alongside query', () => {
    expect(
      parseDocQueryArgsQuery(
        JSON.stringify({ query: 'topic', top_k: 5, filters: {} })
      )
    ).toBe('topic')
  })

  test('returns undefined for partial/streaming JSON', () => {
    expect(parseDocQueryArgsQuery('{"query": "still str')).toBeUndefined()
  })

  test('returns undefined for non-JSON text', () => {
    expect(parseDocQueryArgsQuery('not json at all')).toBeUndefined()
  })

  test('returns undefined when args have no query field', () => {
    expect(parseDocQueryArgsQuery(JSON.stringify({ top_k: 5 }))).toBeUndefined()
  })

  test('returns undefined for a non-string or blank query value', () => {
    expect(
      parseDocQueryArgsQuery(JSON.stringify({ query: 42 }))
    ).toBeUndefined()
    expect(
      parseDocQueryArgsQuery(JSON.stringify({ query: '   ' }))
    ).toBeUndefined()
  })

  test('returns undefined for a JSON array', () => {
    expect(parseDocQueryArgsQuery(JSON.stringify(['query']))).toBeUndefined()
  })
})

describe('getDocQueryPanelContent', () => {
  const answerModeResult = {
    answer: 'Some answer text.',
    sources_used: 1,
    sources: [
      {
        expert: 'Prof. Muster',
        source_url: 'https://example.com/course/lecture-01.pdf',
        source_type: 'pdf',
        file_name: 'lecture-01.pdf',
        page_number: 3,
      },
    ],
  }
  const argsText = JSON.stringify({ query: 'When is the exam?' })

  test('non-doc_query tools always keep the raw path, regardless of state', () => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: false,
        argsText,
        result: answerModeResult,
        docQueryState: 'done',
      })
    ).toBeUndefined()
  })

  test('running keeps the raw path (call still in flight)', () => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText,
        result: {},
        docQueryState: 'running',
      })
    ).toBeUndefined()
  })

  test('failed keeps the raw path (error payload has debugging value)', () => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText,
        result: 'upstream 500',
        docQueryState: 'failed',
      })
    ).toBeUndefined()
  })

  // Mirrors `getDocQueryChipState`'s "cancelled call still holding the
  // placeholder" and "garbage result" cases: the chip label may still read
  // plain "done", but nothing parsed, so the raw payload must stay visible.
  test.each([
    'Loading...',
    'Executing...',
    'not json {',
  ])('unparseable result (%s) keeps the raw path even when the chip state is done', (result) => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText,
        result,
        docQueryState: 'done',
      })
    ).toBeUndefined()
  })

  test('parsed answer-mode payload with sources shows the query and the sources hint', () => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText,
        result: answerModeResult,
        docQueryState: 'done',
      })
    ).toEqual({ query: 'When is the exam?', showSourcesHint: true })
  })

  test('parsed payload with zero sources shows the query but no hint', () => {
    const emptyResult = { answer: 'No relevant material found.', sources: [] }
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText,
        result: emptyResult,
        docQueryState: 'doneEmpty',
      })
    ).toEqual({ query: 'When is the exam?', showSourcesHint: false })
  })

  test('parsed payload with args that carry no readable query omits the query row', () => {
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText: 'not json args',
        result: answerModeResult,
        docQueryState: 'done',
      })
    ).toEqual({ query: undefined, showSourcesHint: true })
  })

  test('doneEmpty with unreadable args keeps the raw path (panel would be blank)', () => {
    const emptyResult = { answer: 'No relevant material found.', sources: [] }
    expect(
      getDocQueryPanelContent({
        isDocQuery: true,
        argsText: 'not json args',
        result: emptyResult,
        docQueryState: 'doneEmpty',
      })
    ).toBeUndefined()
  })
})

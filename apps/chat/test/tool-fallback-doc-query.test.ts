import { describe, expect, test } from 'vitest'
import { getDocQueryChipState } from '../src/components/tool-fallback'

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
  test.each(['Loading...', 'Executing...'])(
    'settled call still holding the %s placeholder reads as plain done',
    (placeholder) => {
      expect(getDocQueryChipState(baseParams({ result: placeholder }))).toBe(
        'done'
      )
    }
  )
})

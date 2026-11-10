import { readFileSync } from 'node:fs'
import { expect, it, vi } from 'vitest'
import { useMessageSources } from '../src/hooks/useMessageSources'
import type { ChatSourcePart } from '../src/lib/sources/normalizeSources'

const state = vi.hoisted(() => ({
  message: { id: 'message', content: [] as ChatSourcePart[] },
  cursor: 0,
  memos: [] as { deps: unknown[]; value: unknown }[],
}))
vi.mock('@assistant-ui/react', () => ({
  useAuiState: (selector: (value: unknown) => unknown) =>
    selector({ message: state.message }),
}))
vi.mock('react', () => ({
  useMemo: (compute: () => unknown, deps: unknown[]) => {
    const index = state.cursor++
    const prev = state.memos[index]
    if (
      prev &&
      deps.length === prev.deps.length &&
      deps.every((v, i) => Object.is(v, prev.deps[i]))
    )
      return prev.value
    const value = compute()
    state.memos[index] = { deps, value }
    return value
  },
}))
function MessageSourcesHarness(text: string) {
  state.message.content = [
    ...state.message.content.filter((p) => p.type !== 'text'),
    { type: 'text', text },
  ]
  state.cursor = 0
  return useMessageSources()
}
it('keeps source and figure maps stable while streamed citation pages still update', () => {
  const payload = JSON.parse(
    readFileSync('scripts/fixtures/course-images/query-result.json', 'utf8')
  )
  state.message.content = [
    { type: 'tool-call', toolName: 'KB_doc_query', result: payload },
  ]
  const first = MessageSourcesHarness('Start')
  const next = MessageSourcesHarness('See [1, p. 2]')
  expect(next.sources).toBe(first.sources)
  expect(next.courseImageSourcesByAssetId).toBe(
    first.courseImageSourcesByAssetId
  )
  expect(next.citedPageRanges).not.toBe(first.citedPageRanges)
  state.message.content.push({
    type: 'tool-call',
    toolName: 'KB_doc_query',
    result: payload,
    isError: false,
  })
  expect(MessageSourcesHarness('See [1, p. 2]').sources).not.toBe(first.sources)
})

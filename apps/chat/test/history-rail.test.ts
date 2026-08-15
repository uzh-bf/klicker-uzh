import { describe, expect, test } from 'vitest'

import {
  getHistoryRailEntries,
  getHistoryRailMessageAnchor,
  getHistoryRailPartAnchor,
  getHistoryRailTickRanges,
} from '../src/lib/history-rail'
import type { ExtendedThreadMessageLike } from '../src/stores/chatStore'

const buildMessage = ({
  content,
  id,
  role,
  status,
}: Pick<ExtendedThreadMessageLike, 'content' | 'id' | 'role'> & {
  status?: { type: string }
}): ExtendedThreadMessageLike =>
  ({
    content,
    createdAt: new Date('2026-08-14T00:00:00.000Z'),
    id,
    role,
    status,
  }) as ExtendedThreadMessageLike

describe('history rail projection', () => {
  test('bounds long histories into contiguous representative tick ranges', () => {
    const ranges = getHistoryRailTickRanges(100, 12)
    expect(ranges).toHaveLength(12)
    expect(ranges[0]).toEqual({
      endIndex: 7,
      representativeIndex: 3,
      startIndex: 0,
    })
    expect(ranges[1]).toEqual({
      endIndex: 15,
      representativeIndex: 11,
      startIndex: 8,
    })
    expect(ranges.at(-1)).toEqual({
      endIndex: 99,
      representativeIndex: 95,
      startIndex: 91,
    })
    expect(
      ranges
        .slice(1)
        .every(
          (range, index) => range.startIndex === ranges[index]?.endIndex + 1
        )
    ).toBe(true)
  })

  test('projects only user and assistant turns in active-path order', () => {
    const entries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'text', text: 'First question' }],
        id: 'user-1',
        role: 'user',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'First answer' }],
        id: 'assistant-1',
        role: 'assistant',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'Sibling question' }],
        id: 'user-sibling',
        role: 'user',
      }),
    ])

    expect(entries).toEqual([
      expect.objectContaining({
        anchor: getHistoryRailMessageAnchor('user-1'),
        kind: 'user',
        preview: 'First question',
      }),
      expect.objectContaining({
        anchor: getHistoryRailMessageAnchor('assistant-1'),
        kind: 'assistant',
        preview: 'First answer',
      }),
      expect.objectContaining({
        anchor: getHistoryRailMessageAnchor('user-sibling'),
        kind: 'user',
        preview: 'Sibling question',
      }),
    ])
  })

  test('adds one entry for a reasoning group and stable tool/error steps', () => {
    const entries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'text', text: 'Question' }],
        id: 'user-1',
        role: 'user',
      }),
      buildMessage({
        content: [
          { type: 'reasoning', text: 'First thought' },
          { type: 'reasoning', text: 'Second thought' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'library_search',
          },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'library_search',
          },
          { type: 'data', name: 'chat-error', data: {} },
        ],
        id: 'assistant-1',
        role: 'assistant',
        status: { type: 'incomplete' },
      }),
    ])

    expect(entries).toHaveLength(5)
    expect(entries.slice(2)).toEqual([
      expect.objectContaining({
        anchor: getHistoryRailPartAnchor('assistant-1', 'reasoning:0'),
        kind: 'reasoning',
        preview: 'First thought',
      }),
      expect.objectContaining({
        anchor: getHistoryRailPartAnchor('assistant-1', 'tool:call-1'),
        kind: 'tool',
        toolName: 'library_search',
      }),
      expect.objectContaining({
        anchor: getHistoryRailPartAnchor('assistant-1', 'error'),
        kind: 'error',
      }),
    ])
    expect(entries.find((entry) => entry.messageId === 'assistant-1')).toEqual(
      expect.objectContaining({ status: 'partial' })
    )
  })

  test('preserves running and error states while ignoring empty reasoning', () => {
    const runningEntries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'text', text: 'Question' }],
        id: 'user-1',
        role: 'user',
      }),
      buildMessage({
        content: [
          { type: 'reasoning', text: '  ' },
          {
            type: 'tool-call',
            toolCallId: 'call-running',
            toolName: 'library_search',
          },
        ],
        id: 'assistant-1',
        role: 'assistant',
        status: { type: 'running' },
      }),
    ])
    const errorEntries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'data', name: 'chat-error', data: {} }],
        id: 'assistant-error',
        role: 'assistant',
        status: { type: 'error' },
      }),
    ])

    expect(
      runningEntries.map(({ kind, status }) => ({ kind, status }))
    ).toEqual([
      { kind: 'user', status: 'complete' },
      { kind: 'assistant', status: 'running' },
      { kind: 'tool', status: 'running' },
    ])
    expect(errorEntries.map(({ kind, status }) => ({ kind, status }))).toEqual([
      { kind: 'assistant', status: 'error' },
      { kind: 'error', status: 'error' },
    ])
  })
})

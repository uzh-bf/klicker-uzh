import { describe, expect, test } from 'vitest'

import {
  getHistoryRailEntries,
  getHistoryRailMessageAnchor,
  getHistoryRailTickRanges,
  toHistoryRailPlainText,
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

  test('pairs adjacent user and assistant messages into one turn', () => {
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

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        anchor: getHistoryRailMessageAnchor('user-1'),
        assistantMessageId: 'assistant-1',
        assistantText: 'First answer',
        kind: 'turn',
        userMessageId: 'user-1',
        userText: 'First question',
      })
    )
    expect(entries[1]).toEqual(
      expect.objectContaining({
        anchor: getHistoryRailMessageAnchor('user-sibling'),
        kind: 'turn',
        userMessageId: 'user-sibling',
        userText: 'Sibling question',
      })
    )
  })

  test('keeps reasoning, tools, and errors inside the turn instead of the rail', () => {
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

    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual(
      expect.objectContaining({
        assistantMessageId: 'assistant-1',
        assistantText: undefined,
        kind: 'turn',
        status: 'error',
      })
    )
  })

  test('preserves running and partial states without adding part landmarks', () => {
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
    const partialEntries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'text', text: 'Question' }],
        id: 'user-2',
        role: 'user',
      }),
      buildMessage({
        content: [],
        id: 'assistant-2',
        role: 'assistant',
        status: { type: 'incomplete' },
      }),
    ])

    expect(
      runningEntries.map(({ kind, status }) => ({ kind, status }))
    ).toEqual([{ kind: 'turn', status: 'running' }])
    expect(
      partialEntries.map(({ kind, status }) => ({ kind, status }))
    ).toEqual([{ kind: 'turn', status: 'partial' }])
  })

  test('keeps assistant-only and consecutive-role messages as standalone turns', () => {
    const entries = getHistoryRailEntries([
      buildMessage({
        content: [{ type: 'text', text: 'Recovered answer' }],
        id: 'assistant-orphan',
        role: 'assistant',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'First question' }],
        id: 'user-1',
        role: 'user',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'Second question' }],
        id: 'user-2',
        role: 'user',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'Second answer' }],
        id: 'assistant-2',
        role: 'assistant',
      }),
      buildMessage({
        content: [{ type: 'text', text: 'Another answer' }],
        id: 'assistant-3',
        role: 'assistant',
      }),
    ])

    expect(entries).toEqual([
      expect.objectContaining({
        assistantMessageId: 'assistant-orphan',
        messageId: 'assistant-orphan',
        userMessageId: undefined,
      }),
      expect.objectContaining({
        assistantMessageId: undefined,
        messageId: 'user-1',
        userMessageId: 'user-1',
      }),
      expect.objectContaining({
        assistantMessageId: 'assistant-2',
        messageId: 'user-2',
        userMessageId: 'user-2',
      }),
      expect.objectContaining({
        assistantMessageId: 'assistant-3',
        messageId: 'assistant-3',
        userMessageId: undefined,
      }),
    ])
  })

  test('preserves complete text on the entry while labels truncate', () => {
    const userTextParts = [
      `${'user detail '.repeat(6)}first tail`,
      `${'user detail '.repeat(6)}second tail`,
    ]
    const assistantTextParts = [
      `${'assistant detail '.repeat(6)}first tail`,
      `${'assistant detail '.repeat(6)}second tail`,
    ]
    const userText = userTextParts.join('\n\n')
    const assistantText = assistantTextParts.join('\n\n')
    const [entry] = getHistoryRailEntries([
      buildMessage({
        content: userTextParts.map((text) => ({ type: 'text' as const, text })),
        id: 'user-long',
        role: 'user',
      }),
      buildMessage({
        content: assistantTextParts.map((text) => ({
          type: 'text' as const,
          text,
        })),
        id: 'assistant-long',
        role: 'assistant',
      }),
    ])

    expect(entry).toEqual(
      expect.objectContaining({
        assistantText,
        userText,
      })
    )
    const label = toHistoryRailPlainText(entry?.userText)
    expect(label).toMatch(/…$/)
    expect(label?.length).toBeLessThan(userText.length)
  })
})

describe('history rail plain-text projection', () => {
  test('strips heading markers', () => {
    expect(toHistoryRailPlainText('# Heading\n\nBody text')).toBe(
      'Heading Body text'
    )
  })

  test('strips bold and italic markers, including underscore variants', () => {
    expect(
      toHistoryRailPlainText(
        'A **bold** and *italic* claim, plus __also bold__ and _also italic_ word'
      )
    ).toBe('A bold and italic claim, plus also bold and also italic word')
  })

  test('strips inline code backticks', () => {
    expect(toHistoryRailPlainText('Use `inline code` here')).toBe(
      'Use inline code here'
    )
  })

  test('strips fenced code block delimiters while keeping the code text', () => {
    const fenced = [
      'Before',
      '```ts',
      'const answer = 42',
      '```',
      'After',
    ].join('\n')

    expect(toHistoryRailPlainText(fenced)).toBe(
      'Before const answer = 42 After'
    )
  })

  test('reduces links and images to their text content', () => {
    expect(
      toHistoryRailPlainText(
        'See [the docs](https://example.com/docs) for more'
      )
    ).toBe('See the docs for more')
    expect(
      toHistoryRailPlainText(
        'Look at ![a chart](https://example.com/chart.png) now'
      )
    ).toBe('Look at a chart now')
  })

  test('strips unordered and ordered list markers', () => {
    expect(
      toHistoryRailPlainText(['- First point', '- Second point'].join('\n'))
    ).toBe('First point Second point')
    expect(
      toHistoryRailPlainText(['1. Ordered one', '2. Ordered two'].join('\n'))
    ).toBe('Ordered one Ordered two')
  })

  test('collapses whitespace runs from line breaks, tabs, and indentation', () => {
    expect(
      toHistoryRailPlainText('Line one\n\n\n   Line two\t\tLine three')
    ).toBe('Line one Line two Line three')
  })

  test('truncates text past the shared cap with an ellipsis', () => {
    const long = `${'word '.repeat(40)}tail`
    const result = toHistoryRailPlainText(long)

    expect(result).toMatch(/…$/)
    expect(result?.length).toBe(100)
    expect(long.length).toBeGreaterThan(100)
  })

  test('returns undefined for text that is only whitespace', () => {
    expect(toHistoryRailPlainText('   \n\n   ')).toBeUndefined()
  })
})

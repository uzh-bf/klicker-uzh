import { describe, expect, test } from 'vitest'

import {
  getThreadMarkdownFilename,
  threadToMarkdown,
} from '../src/lib/thread-markdown'
import type { ExtendedThreadMessageLike } from '../src/stores/chatStore'

const buildMessage = (
  id: string,
  role: 'user' | 'assistant',
  content: unknown
): ExtendedThreadMessageLike =>
  ({
    content,
    createdAt: new Date('2026-10-19T00:00:00.000Z'),
    id,
    role,
  }) as ExtendedThreadMessageLike

const labels = { user: 'U', assistant: 'A', sources: 'S' }

describe('thread to Markdown export', () => {
  test('renders title and turns in order, keeps answer text verbatim and skips tool internals', () => {
    const answer = 'Variance is $\\sigma^2$ [1].\n\n$$\nE[X] = \\mu\n$$'
    const markdown = threadToMarkdown({
      title: 'Thread title',
      labels,
      messages: [
        buildMessage('m1', 'user', 'Question one'),
        buildMessage('m2', 'assistant', [
          { type: 'reasoning', text: 'hidden reasoning' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'KB_doc_query',
            args: { query: 'hidden tool args' },
            result: {
              mode: 'documents',
              sources: [
                {
                  reference: 'https://example.org/notes.html',
                  display_name: 'Course notes',
                  chunks: [{ text: 'hidden chunk text' }],
                },
              ],
            },
          },
          { type: 'text', text: answer },
        ]),
        buildMessage('m3', 'user', [{ type: 'text', text: 'Question two' }]),
      ],
    })

    const lines = markdown.split('\n')
    expect(lines[0]).toBe('# Thread title')
    expect(lines.filter((line) => line.startsWith('## '))).toEqual([
      '## U',
      '## A',
      '## U',
    ])
    expect(markdown.indexOf('Question one')).toBeLessThan(
      markdown.indexOf(answer)
    )
    expect(markdown.indexOf(answer)).toBeLessThan(
      markdown.indexOf('Question two')
    )
    expect(markdown).toContain(
      '[1] [Course notes](https://example.org/notes.html)'
    )
    expect(markdown).not.toMatch(/hidden|call-1|KB_doc_query/)
  })

  test('derives a safe filename and falls back to the thread id', () => {
    expect(getThreadMarkdownFilename('a/b: c?', 't1')).toBe('a b c.md')
    expect(getThreadMarkdownFilename(' */ ', 't1')).toBe('chat-t1.md')
  })
})

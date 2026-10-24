import { describe, expect, test } from 'vitest'
import { filterThreadsByTitle } from '../src/components/thread-list-state'
import type { Thread } from '../src/stores/chatStore'

const thread = (id: string, title?: string, firstMessage?: string): Thread =>
  ({
    id,
    title,
    messages: firstMessage ? [{ role: 'user', content: firstMessage }] : [],
    allMessages: [],
    isRunning: false,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  }) as Thread

// The conversation filter runs on the client only and must match what the
// row displays: the stored title, else the first user message, else the
// localized fallback.
describe('filterThreadsByTitle', () => {
  const threads = [
    thread('accented', 'Übung Zürich'),
    thread('plain', 'Resume tips'),
    thread('untitled', undefined, 'What is portfolio diversification?'),
    thread('empty'),
  ]
  const ids = (query: string) =>
    filterThreadsByTitle(threads, query, 'New Chat').map(({ id }) => id)

  test('matches displayed titles ignoring case and accents', () => {
    expect(ids('ZURICH')).toEqual(['accented'])
    expect(ids('résumé')).toEqual(['plain'])
    expect(ids('portfolio')).toEqual(['untitled'])
    expect(ids('new chat')).toEqual(['empty'])
    expect(ids('  ')).toEqual(['accented', 'plain', 'untitled', 'empty'])
    expect(ids('missing')).toEqual([])
  })
})

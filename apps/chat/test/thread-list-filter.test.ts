import { describe, expect, test } from 'vitest'
import {
  filterThreadsByTitle,
  resolveThreadTitle,
} from '../src/components/thread-list-state'
import type { Thread } from '../src/stores/chatStore'

const thread = (
  id: string,
  title?: string,
  firstMessage?: Thread['messages'][number]['content']
): Thread =>
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

  test('omits well-formed document blocks from fallback titles and filtering', () => {
    const question = 'What is on page 2?'
    const documentBlock = `--- Attached document: notes.md ---
Synthetic notes body
--- End of attached document ---`
    const documentThread = thread('document', undefined, [
      { type: 'text', text: `${question}\n\n${documentBlock}` },
    ])

    expect(resolveThreadTitle(documentThread)).toBe(question)
    expect(
      filterThreadsByTitle([documentThread], 'attached document', 'New Chat')
    ).toEqual([])
    expect(
      filterThreadsByTitle([documentThread], 'page 2', 'New Chat').map(
        ({ id }) => id
      )
    ).toEqual(['document'])
  })

  test('keeps a stored title unchanged when its message contains documents', () => {
    const documentBlock = `--- Attached document: notes.md ---
Synthetic notes body
--- End of attached document ---`
    const titledThread = thread('titled', 'Stored title', [
      { type: 'text', text: `Question\n\n${documentBlock}` },
    ])

    expect(resolveThreadTitle(titledThread)).toBe('Stored title')
  })
})

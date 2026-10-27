import { describe, expect, test } from 'vitest'
import {
  hasChatError,
  resolveDisclosureOpen,
  truncateMessagesForReload,
} from '../src/components/message-parts-state'

describe('message part disclosure state', () => {
  test('auto-opens only while active until the participant chooses a state', () => {
    expect(resolveDisclosureOpen(null, true, true)).toBe(true)
    expect(resolveDisclosureOpen(null, true, false)).toBe(false)
    expect(resolveDisclosureOpen(false, true, true)).toBe(false)
    expect(resolveDisclosureOpen(true, true, false)).toBe(true)
  })

  test('keeps non-auto-opening groups closed until manually opened', () => {
    expect(resolveDisclosureOpen(null, false, true)).toBe(false)
    expect(resolveDisclosureOpen(true, false, false)).toBe(true)
  })

  test('recognizes a client-only chat error data part', () => {
    expect(
      hasChatError({
        content: [{ type: 'text' }, { type: 'data', name: 'chat-error' }],
      })
    ).toBe(true)
    expect(hasChatError({ content: [{ type: 'data', name: 'other' }] })).toBe(
      false
    )
  })

  test('reload truncation keeps one existing user turn and no duplicate user turn', () => {
    const messages = [
      { id: 'user-1', role: 'user' },
      { id: 'assistant-1', role: 'assistant' },
    ]

    expect(truncateMessagesForReload(messages, 'user-1')).toEqual([messages[0]])
    expect(truncateMessagesForReload(messages, 'missing')).toBeNull()
  })
})

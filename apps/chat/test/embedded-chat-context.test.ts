import { afterEach, describe, expect, test, vi } from 'vitest'

import {
  evaluateChatContextUpdate,
  getElearningEmbedOrigins,
} from '../src/hooks/useEmbeddedChatContext'

const ELEARNING_ORIGIN = 'https://elearning.example.org'
const PWA_ORIGIN = 'https://pwa.example.org'
const ALLOWED = [ELEARNING_ORIGIN]

const pwaPayload = {
  version: 1,
  source: 'pwa',
  surface: 'practice-quiz',
  locale: 'en',
  courseId: 'course-1',
}

const elearningPayload = {
  version: 1,
  source: 'elearning',
  locale: 'de',
  envelope: 'e'.repeat(40),
}

function decide(overrides: {
  data?: unknown
  origin?: string
  lastAcceptedMessageId?: number | null
  allowed?: readonly string[]
}) {
  return evaluateChatContextUpdate({
    data: overrides.data,
    origin: overrides.origin ?? ELEARNING_ORIGIN,
    allowedElearningOrigins: overrides.allowed ?? ALLOWED,
    lastAcceptedMessageId: overrides.lastAcceptedMessageId ?? null,
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('evaluateChatContextUpdate', () => {
  test('ignores messages that are not host chat-context envelopes', () => {
    expect(decide({ data: undefined })).toEqual({ kind: 'ignore' })
    expect(decide({ data: { type: 'some:other-event', payload: {} } })).toEqual(
      { kind: 'ignore' }
    )
    expect(decide({ data: 'elearning:chat-context' })).toEqual({
      kind: 'ignore',
    })
  })

  test('accepts a PWA context from the parent origin', () => {
    const decision = decide({
      data: { type: 'klicker:chat-context', payload: pwaPayload, messageId: 3 },
      origin: PWA_ORIGIN,
    })
    expect(decision).toEqual({
      kind: 'accept',
      messageId: 3,
      isElearning: false,
      context: pwaPayload,
    })
  })

  test('ignores an eLearning context from an origin outside the allowlist', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: elearningPayload,
        messageId: 1,
      },
      origin: 'https://attacker.example.org',
    })
    expect(decision).toEqual({ kind: 'ignore' })
  })

  test('accepts an eLearning context from an allowlisted origin', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: elearningPayload,
        messageId: 2,
      },
    })
    expect(decision).toEqual({
      kind: 'accept',
      messageId: 2,
      isElearning: true,
      context: elearningPayload,
    })
  })

  test('rejects a malformed payload and reports the id so the sequence advances', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: { version: 1, source: 'elearning', locale: 'de' },
        messageId: 9,
      },
    })
    expect(decision).toEqual({ kind: 'reject', messageId: 9 })
  })

  test('ignores an out-of-order message so the stored context cannot roll back', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: elearningPayload,
        messageId: 4,
      },
      lastAcceptedMessageId: 7,
    })
    expect(decision).toEqual({ kind: 'ignore' })
  })

  test('rejects when the declared channel and payload source disagree', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: pwaPayload,
        messageId: 5,
      },
    })
    expect(decision).toEqual({ kind: 'reject', messageId: 5 })
  })

  test('accepts a context without a numeric sequence and reports a null id', () => {
    const decision = decide({
      data: {
        type: 'elearning:chat-context',
        payload: elearningPayload,
        messageId: 'nope',
      },
    })
    expect(decision).toEqual({
      kind: 'accept',
      messageId: null,
      isElearning: true,
      context: elearningPayload,
    })
  })
})

describe('getElearningEmbedOrigins', () => {
  test('trims trailing slashes and drops empty entries', () => {
    vi.stubEnv(
      'NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS',
      'https://a.example.org/, ,https://b.example.org'
    )
    expect(getElearningEmbedOrigins()).toEqual([
      'https://a.example.org',
      'https://b.example.org',
    ])
  })

  test('returns an empty allowlist when unset', () => {
    vi.stubEnv('NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS', '')
    expect(getElearningEmbedOrigins()).toEqual([])
  })
})

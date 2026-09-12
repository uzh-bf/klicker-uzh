import type { KlickerChatContextV2 } from '@klicker-uzh/types'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import {
  evaluateChatContextClear,
  evaluateChatContextUpdate,
  getElearningEmbedOrigins,
  requestFreshElearningChatContext,
} from '../src/hooks/useEmbeddedChatContext'
import { useChatContextStore } from '../src/stores/chatContextStore'

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

function decideClear(overrides: {
  data?: unknown
  origin?: string
  lastAcceptedMessageId?: number | null
  allowed?: readonly string[]
}) {
  return evaluateChatContextClear({
    data: overrides.data,
    origin: overrides.origin ?? ELEARNING_ORIGIN,
    allowedElearningOrigins: overrides.allowed ?? ALLOWED,
    lastAcceptedMessageId: overrides.lastAcceptedMessageId ?? null,
  })
}

describe('evaluateChatContextClear', () => {
  test('ignores messages that are not host clears', () => {
    expect(decideClear({ data: undefined })).toEqual({ kind: 'ignore' })
    expect(
      decideClear({ data: { type: 'elearning:chat-context', payload: {} } })
    ).toEqual({ kind: 'ignore' })
  })

  test('ignores a clear from an origin outside the allowlist', () => {
    expect(
      decideClear({
        data: { type: 'elearning:chat-context-clear' },
        origin: 'https://unknown.example.org',
      })
    ).toEqual({ kind: 'ignore' })
  })

  test('clears an unsolicited navigation clear that carries no sequence', () => {
    expect(
      decideClear({ data: { type: 'elearning:chat-context-clear' } })
    ).toEqual({ kind: 'clear', messageId: null })
  })

  test('ignores a clear the stored context already superseded', () => {
    expect(
      decideClear({
        data: { type: 'elearning:chat-context-clear', messageId: 3 },
        lastAcceptedMessageId: 4,
      })
    ).toEqual({ kind: 'ignore' })
  })

  test('clears and reports the sequence for a current clear', () => {
    expect(
      decideClear({
        data: { type: 'elearning:chat-context-clear', messageId: 5 },
        lastAcceptedMessageId: 4,
      })
    ).toEqual({ kind: 'clear', messageId: 5 })
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

const REFRESH_PARENT_ORIGIN = 'https://elearning.example.org'

function freshElearningContext(envelopeSeed = 'e'): KlickerChatContextV2 {
  return {
    version: 1,
    source: 'elearning',
    locale: 'de',
    envelope: envelopeSeed.repeat(40),
  }
}

const pwaContext: KlickerChatContextV2 = {
  version: 1,
  source: 'pwa',
  surface: 'practice-quiz',
  locale: 'en',
  courseId: 'course-1',
}

describe('requestFreshElearningChatContext', () => {
  let postMessage: ReturnType<typeof vi.fn>
  let parent: { postMessage: ReturnType<typeof vi.fn> }
  let listeners: Array<(event: MessageEvent) => void>

  function deliver(data: unknown, origin: string = REFRESH_PARENT_ORIGIN) {
    for (const listener of [...listeners]) {
      listener({ source: parent, origin, data } as unknown as MessageEvent)
    }
  }

  function lastRequestId(): string {
    return postMessage.mock.calls[0][0].payload.requestId
  }

  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS', REFRESH_PARENT_ORIGIN)
    listeners = []
    postMessage = vi.fn()
    parent = { postMessage }
    vi.stubGlobal('window', {
      parent,
      addEventListener: (
        type: string,
        listener: (event: MessageEvent) => void
      ) => {
        if (type === 'message') listeners.push(listener)
      },
      removeEventListener: (
        type: string,
        listener: (event: MessageEvent) => void
      ) => {
        if (type !== 'message') return
        const index = listeners.indexOf(listener)
        if (index >= 0) listeners.splice(index, 1)
      },
    })
    useChatContextStore.setState({ context: null, parentOrigin: null })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    useChatContextStore.setState({ context: null, parentOrigin: null })
  })

  test('asks the host and resolves with the correlated snapshot', async () => {
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })

    const pending = requestFreshElearningChatContext(500)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'elearning:chat-context-request',
        payload: { version: 1, requestId: expect.any(String) },
      },
      REFRESH_PARENT_ORIGIN
    )

    const fresh = freshElearningContext('f')
    deliver({
      type: 'elearning:chat-context',
      requestId: lastRequestId(),
      payload: fresh,
    })

    await expect(pending).resolves.toEqual(fresh)
  })

  test('ignores an uncorrelated reply and times out to null', async () => {
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })

    const pending = requestFreshElearningChatContext(30)
    // A snapshot queued before the request carries no correlation id, and an
    // unrelated id must not satisfy this request either.
    deliver({
      type: 'elearning:chat-context',
      payload: freshElearningContext('old'),
    })
    deliver({
      type: 'elearning:chat-context',
      requestId: 'other-request',
      payload: freshElearningContext('other'),
    })

    await expect(pending).resolves.toBeNull()
  })

  test('ignores a correlated reply from a different origin', async () => {
    vi.stubEnv(
      'NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS',
      REFRESH_PARENT_ORIGIN + ',https://other.example.org'
    )
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })

    const pending = requestFreshElearningChatContext(30)
    deliver(
      {
        type: 'elearning:chat-context',
        requestId: lastRequestId(),
        payload: freshElearningContext('f'),
      },
      'https://other.example.org'
    )

    await expect(pending).resolves.toBeNull()
  })

  test('resolves null on a correlated clear', async () => {
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })

    const pending = requestFreshElearningChatContext(500)
    deliver({
      type: 'elearning:chat-context-clear',
      requestId: lastRequestId(),
    })

    await expect(pending).resolves.toBeNull()
  })

  test('still asks after an invalid update clears the stored context', async () => {
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })
    useChatContextStore.getState().clearContext()

    const pending = requestFreshElearningChatContext(500)
    expect(postMessage).toHaveBeenCalledWith(
      {
        type: 'elearning:chat-context-request',
        payload: { version: 1, requestId: expect.any(String) },
      },
      REFRESH_PARENT_ORIGIN
    )

    const fresh = freshElearningContext('f')
    deliver({
      type: 'elearning:chat-context',
      requestId: lastRequestId(),
      payload: fresh,
    })

    await expect(pending).resolves.toEqual(fresh)
  })

  test('does not ask without an embedded eLearning context', async () => {
    useChatContextStore.setState({
      context: pwaContext,
      parentOrigin: REFRESH_PARENT_ORIGIN,
    })

    await expect(requestFreshElearningChatContext(10)).resolves.toBeNull()
    expect(postMessage).not.toHaveBeenCalled()
  })

  test('does not ask a parent outside the allowlist', async () => {
    useChatContextStore.setState({
      context: freshElearningContext('e'),
      parentOrigin: 'https://attacker.example.org',
    })

    await expect(requestFreshElearningChatContext(10)).resolves.toBeNull()
    expect(postMessage).not.toHaveBeenCalled()
  })
})

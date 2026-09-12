'use client'

import type { KlickerChatContextV2 } from '@klicker-uzh/types'
import { useEffect, useRef } from 'react'
import { sanitizeKlickerChatContextV2 } from '../services/chatContext'
import { useChatContextStore } from '../stores/chatContextStore'
import { useChatStore } from '../stores/chatStore'
import { useEmbedded } from './useEmbedded'

const CHAT_CONTEXT_MESSAGE_TYPE = 'klicker:chat-context'
const CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:chat-context-ack'
const ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE = 'elearning:chat-context'
const ELEARNING_CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'elearning:chat-context-ack'
const ELEARNING_CHAT_CONTEXT_CLEAR_MESSAGE_TYPE = 'elearning:chat-context-clear'

// Exact origins allowed to send eLearning chat contexts. The PWA contract
// keeps its existing parent-origin check; the eLearning variant additionally
// requires explicit allowlist membership so unknown hosts cannot deliver
// even display-only context labels.
export function getElearningEmbedOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS ?? ''
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export const ELEARNING_CONTEXT_REFRESH_TIMEOUT_MS = 2000

const ELEARNING_CHAT_CONTEXT_REQUEST_MESSAGE_TYPE =
  'elearning:chat-context-request'

// The last authenticated eLearning sender stays known after an invalid update
// clears the stored context, so a new question can still ask for a fresh
// snapshot instead of waiting for the student to navigate again.
let lastAuthenticatedElearningOrigin: string | null = null

useChatContextStore.subscribe((state) => {
  if (!state.parentOrigin) return
  if (
    state.context?.source === 'elearning' &&
    getElearningEmbedOrigins().includes(state.parentOrigin)
  ) {
    lastAuthenticatedElearningOrigin = state.parentOrigin
    return
  }
  if (state.context) lastAuthenticatedElearningOrigin = null
})

/**
 * Asks the eLearning host for a fresh snapshot before a new question. The
 * snapshot delivered at launch can expire (300s) or describe a page the student
 * has since left, and a completion change arrives without navigation, so a new
 * question re-requests it. The request carries a correlation id and only the
 * reply echoing it is used, so a snapshot the host had already queued cannot
 * satisfy the request. A request left unanswered within the bound resolves to
 * null — the caller must not fall back to the previous snapshot — and the
 * server then answers under the materials-only policy. A failed refresh clears
 * the previous label and exposes its absence; later valid updates can restore it.
 */
export function requestFreshElearningChatContext(
  timeoutMs: number = ELEARNING_CONTEXT_REFRESH_TIMEOUT_MS
): Promise<KlickerChatContextV2 | null> {
  if (typeof window === 'undefined' || window.parent === window) {
    return Promise.resolve(null)
  }

  const current = useChatContextStore.getState()
  const parentOrigin = current.parentOrigin ?? lastAuthenticatedElearningOrigin
  if (!parentOrigin) return Promise.resolve(null)
  if (!getElearningEmbedOrigins().includes(parentOrigin)) {
    return Promise.resolve(null)
  }
  // A stored PWA context means this frame is not an eLearning conversation.
  if (current.context && current.context.source !== 'elearning') {
    return Promise.resolve(null)
  }

  const requestId = crypto.randomUUID()

  return new Promise((resolve) => {
    let settled = false

    const finish = (value: KlickerChatContextV2 | null) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutHandle)
      window.removeEventListener('message', handleMessage)
      if (!value) {
        useChatContextStore.setState({
          context: null,
          parentOrigin,
          contextUnavailable: true,
        })
      }
      resolve(value)
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent) return
      if (event.origin !== parentOrigin) return
      const data = event.data as
        | { requestId?: unknown; type?: unknown; payload?: unknown }
        | null
        | undefined
      if (!data || typeof data !== 'object') return
      if (data.requestId !== requestId) return

      if (data.type === ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE) {
        const context = sanitizeKlickerChatContextV2(data.payload)
        finish(context?.source === 'elearning' ? context : null)
        return
      }
      // A correlated reply carrying no usable context is a clear.
      finish(null)
    }

    // Listen before sending so a fast reply cannot land between the request
    // and the listener.
    window.addEventListener('message', handleMessage)
    const timeoutHandle = setTimeout(() => finish(null), timeoutMs)

    try {
      window.parent.postMessage(
        {
          type: ELEARNING_CHAT_CONTEXT_REQUEST_MESSAGE_TYPE,
          payload: { version: 1, requestId },
        },
        parentOrigin
      )
    } catch {
      finish(null)
    }
  })
}
export type ChatContextUpdateDecision =
  | { kind: 'ignore' }
  | { kind: 'reject'; messageId: number | null }
  | {
      kind: 'accept'
      messageId: number | null
      isElearning: boolean
      context: KlickerChatContextV2
    }

// Decides what one host message does to the stored context. Kept free of DOM
// state so the acceptance rules are testable directly: an unknown eLearning
// host is ignored, a superseded sequence number cannot roll the context back,
// and an invalid update clears the stored context instead of leaving stale
// host state in place.
export function evaluateChatContextUpdate(input: {
  data: unknown
  origin: string
  allowedElearningOrigins: readonly string[]
  lastAcceptedMessageId: number | null
}): ChatContextUpdateDecision {
  if (!isChatContextMessage(input.data)) return { kind: 'ignore' }

  const isElearning = input.data.type === ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE
  if (isElearning && !input.allowedElearningOrigins.includes(input.origin)) {
    // An unknown host never receives an ack, so the sender surfaces the
    // context as unavailable instead of silently trusting the label.
    return { kind: 'ignore' }
  }

  const messageId =
    typeof input.data.messageId === 'number' ? input.data.messageId : null
  if (
    messageId !== null &&
    input.lastAcceptedMessageId !== null &&
    messageId < input.lastAcceptedMessageId
  ) {
    return { kind: 'ignore' }
  }

  const context = sanitizeKlickerChatContextV2(input.data.payload)
  if (!context || isElearning !== (context.source === 'elearning')) {
    return { kind: 'reject', messageId }
  }

  return { kind: 'accept', messageId, isElearning, context }
}

export type ChatContextClearDecision =
  | { kind: 'ignore' }
  | { kind: 'clear'; messageId: number | null }

// Decides what one host clear message does to the stored context. Only an
// allowlisted eLearning host may clear, and a clear the stored context has
// already superseded is ignored so a late message cannot discard a newer
// snapshot.
export function evaluateChatContextClear(input: {
  data: unknown
  origin: string
  allowedElearningOrigins: readonly string[]
  lastAcceptedMessageId: number | null
}): ChatContextClearDecision {
  if (!isChatContextClearMessage(input.data)) return { kind: 'ignore' }
  if (!input.allowedElearningOrigins.includes(input.origin)) {
    return { kind: 'ignore' }
  }

  const messageId = getChatContextClearMessageId(input.data)
  if (
    messageId !== null &&
    input.lastAcceptedMessageId !== null &&
    messageId < input.lastAcceptedMessageId
  ) {
    return { kind: 'ignore' }
  }

  return { kind: 'clear', messageId }
}

type AcceptedContext = {
  messageId: number | null
  isElearning: boolean
  origin: string
}

export function useEmbeddedChatContext() {
  const embedded = useEmbedded()
  const setContext = useChatContextStore((state) => state.setContext)
  const clearContext = useChatContextStore((state) => state.clearContext)
  // Reported with eLearning acks so the host can keep a scoped thread
  // pointer for reload continuity without exposing other threads.
  const activeThreadId = useChatStore((state) => state.activeThreadId)
  // Read inside the long-lived listener so its lifetime no longer depends on
  // the thread id; re-subscribing on every thread change used to drop the
  // stored context on the way in.
  const activeThreadIdRef = useRef<string | null>(activeThreadId)
  // Highest accepted sequence per host origin, plus the last accepted message,
  // so a late thread pointer can still be acknowledged to the same host.
  const lastAcceptedRef = useRef<AcceptedContext | null>(null)
  const lastSequenceRef = useRef(new Map<string, number>())

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId
  }, [activeThreadId])

  useEffect(() => {
    // The map instance is stable across renders; a local keeps the effect and
    // its cleanup closing over the same instance.
    const sequenceByOrigin = lastSequenceRef.current

    if (!embedded) {
      lastAuthenticatedElearningOrigin = null
      clearContext()
      lastAcceptedRef.current = null
      sequenceByOrigin.clear()
      return
    }

    const elearningOrigins = getElearningEmbedOrigins()

    function postAck(
      origin: string,
      isElearning: boolean,
      messageId: number | null,
      threadId: string | null
    ) {
      window.parent.postMessage(
        {
          type: isElearning
            ? ELEARNING_CHAT_CONTEXT_ACK_MESSAGE_TYPE
            : CHAT_CONTEXT_ACK_MESSAGE_TYPE,
          payload: {
            version: 1,
            ...(messageId != null ? { messageId } : {}),
            ...(isElearning && threadId ? { threadId } : {}),
          },
        },
        origin
      )
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin === 'null') return

      // An explicit clear means the host has no usable page evidence for the
      // current page. A clear whose sequence the stored context already passed
      // is stale and must not wipe a newer snapshot.
      const clearDecision = evaluateChatContextClear({
        data: event.data,
        origin: event.origin,
        allowedElearningOrigins: elearningOrigins,
        lastAcceptedMessageId: sequenceByOrigin.get(event.origin) ?? null,
      })
      if (clearDecision.kind === 'clear') {
        if (clearDecision.messageId != null) {
          sequenceByOrigin.set(event.origin, clearDecision.messageId)
        }
        clearContext()
        lastAcceptedRef.current = null
        return
      }

      const decision = evaluateChatContextUpdate({
        data: event.data,
        origin: event.origin,
        allowedElearningOrigins: elearningOrigins,
        lastAcceptedMessageId: sequenceByOrigin.get(event.origin) ?? null,
      })

      if (decision.kind === 'ignore') return

      if (decision.messageId != null) {
        sequenceByOrigin.set(event.origin, decision.messageId)
      }

      if (decision.kind === 'reject') {
        clearContext()
        lastAcceptedRef.current = null
        return
      }

      lastAcceptedRef.current = {
        messageId: decision.messageId,
        isElearning: decision.isElearning,
        origin: event.origin,
      }
      setContext(decision.context, event.origin)
      // The ack reports delivery to the host, not server acceptance.
      postAck(
        event.origin,
        decision.isElearning,
        decision.messageId,
        activeThreadIdRef.current
      )
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
      lastAuthenticatedElearningOrigin = null
      clearContext()
      lastAcceptedRef.current = null
      sequenceByOrigin.clear()
    }
  }, [embedded, clearContext, setContext])

  // The launch ack only proves delivery, so the host cannot learn the thread id
  // from it: the conversation is created after the first question, once its own
  // acknowledgement has already been sent. Re-acknowledge the accepted context
  // whenever the thread becomes known so the host can remember it for reloads.
  useEffect(() => {
    if (!embedded || !activeThreadId) return

    const accepted = lastAcceptedRef.current
    if (!accepted?.isElearning || accepted.messageId === null) return
    if (!getElearningEmbedOrigins().includes(accepted.origin)) return

    window.parent.postMessage(
      {
        type: ELEARNING_CHAT_CONTEXT_ACK_MESSAGE_TYPE,
        payload: {
          version: 1,
          messageId: accepted.messageId,
          threadId: activeThreadId,
        },
      },
      accepted.origin
    )
  }, [activeThreadId, embedded])
}

function isChatContextClearMessage(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type ===
      ELEARNING_CHAT_CONTEXT_CLEAR_MESSAGE_TYPE
  )
}

function getChatContextClearMessageId(data: unknown): number | null {
  if (typeof data !== 'object' || data === null) return null
  const messageId = (data as { messageId?: unknown }).messageId
  return typeof messageId === 'number' ? messageId : null
}

function isChatContextMessage(data: unknown): data is {
  type:
    | typeof CHAT_CONTEXT_MESSAGE_TYPE
    | typeof ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE
  payload: unknown
  messageId?: unknown
} {
  return (
    (typeof data === 'object' &&
      data !== null &&
      (data as { type?: unknown }).type === CHAT_CONTEXT_MESSAGE_TYPE) ||
    (typeof data === 'object' &&
      data !== null &&
      (data as { type?: unknown }).type === ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE)
  )
}

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
    if (!embedded) {
      clearContext()
      lastAcceptedRef.current = null
      lastSequenceRef.current.clear()
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

      const decision = evaluateChatContextUpdate({
        data: event.data,
        origin: event.origin,
        allowedElearningOrigins: elearningOrigins,
        lastAcceptedMessageId:
          lastSequenceRef.current.get(event.origin) ?? null,
      })

      if (decision.kind === 'ignore') return

      if (decision.messageId != null) {
        lastSequenceRef.current.set(event.origin, decision.messageId)
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
      clearContext()
      lastAcceptedRef.current = null
      lastSequenceRef.current.clear()
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

'use client'

import { useEffect } from 'react'
import { sanitizeKlickerChatContextV2 } from '../services/chatContext'
import { useChatContextStore } from '../stores/chatContextStore'
import { useEmbedded } from './useEmbedded'

const CHAT_CONTEXT_MESSAGE_TYPE = 'klicker:chat-context'
const CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:chat-context-ack'
const ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE = 'elearning:chat-context'
const ELEARNING_CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'elearning:chat-context-ack'

// Exact origins allowed to send eLearning chat contexts. The PWA contract
// keeps its existing parent-origin check; the eLearning variant additionally
// requires explicit allowlist membership so unknown hosts cannot deliver
// even display-only context labels.
function getElearningEmbedOrigins(): string[] {
  const raw = process.env.NEXT_PUBLIC_ELEARNING_EMBED_ORIGINS ?? ''
  return raw
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean)
}

export function useEmbeddedChatContext() {
  const embedded = useEmbedded()
  const setContext = useChatContextStore((state) => state.setContext)
  const clearContext = useChatContextStore((state) => state.clearContext)

  useEffect(() => {
    if (!embedded) {
      clearContext()
      return
    }

    const elearningOrigins = getElearningEmbedOrigins()

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin === 'null') return
      if (!isChatContextMessage(event.data)) return

      const isElearning = event.data.type === ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE
      if (isElearning && !elearningOrigins.includes(event.origin)) {
        // An unknown host never receives an ack, so the sender surfaces the
        // context as unavailable instead of silently trusting the label.
        return
      }

      const context = sanitizeKlickerChatContextV2(event.data.payload)
      if (!context) return
      if (isElearning !== (context.source === 'elearning')) return

      const messageId =
        typeof event.data.messageId === 'number' ? event.data.messageId : null

      setContext(context, event.origin)
      window.parent.postMessage(
        {
          type: isElearning
            ? ELEARNING_CHAT_CONTEXT_ACK_MESSAGE_TYPE
            : CHAT_CONTEXT_ACK_MESSAGE_TYPE,
          payload: {
            version: 1,
            ...(messageId != null ? { messageId } : {}),
          },
        },
        event.origin
      )
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
      clearContext()
    }
  }, [clearContext, embedded, setContext])
}

function isChatContextMessage(data: unknown): data is {
  type: typeof CHAT_CONTEXT_MESSAGE_TYPE | typeof ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE
  payload: unknown
  messageId?: unknown
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === CHAT_CONTEXT_MESSAGE_TYPE ||
    (typeof data === 'object' &&
      data !== null &&
      (data as { type?: unknown }).type === ELEARNING_CHAT_CONTEXT_MESSAGE_TYPE)
  )
}

'use client'

import { useEffect } from 'react'
import { sanitizeKlickerChatContext } from '../services/chatContext'
import { useChatContextStore } from '../stores/chatContextStore'
import { useEmbedded } from './useEmbedded'

const CHAT_CONTEXT_MESSAGE_TYPE = 'klicker:chat-context'
const CHAT_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:chat-context-ack'

export function useEmbeddedChatContext() {
  const embedded = useEmbedded()
  const setContext = useChatContextStore((state) => state.setContext)
  const clearContext = useChatContextStore((state) => state.clearContext)

  useEffect(() => {
    if (!embedded) {
      clearContext()
      return
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin === 'null') return
      if (!isChatContextMessage(event.data)) return

      const context = sanitizeKlickerChatContext(event.data.payload)
      if (!context) return

      const messageId =
        typeof event.data.messageId === 'number' ? event.data.messageId : null

      setContext(context, event.origin)
      window.parent.postMessage(
        {
          type: CHAT_CONTEXT_ACK_MESSAGE_TYPE,
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
  type: typeof CHAT_CONTEXT_MESSAGE_TYPE
  payload: unknown
  messageId?: unknown
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === CHAT_CONTEXT_MESSAGE_TYPE
  )
}

'use client'

import { useEffect, useState } from 'react'
import {
  sanitizeManageAssistantContext,
  type ManageAssistantContext,
} from '../services/manageContext'
import { useEmbedded } from './useEmbedded'

const MANAGE_CONTEXT_MESSAGE_TYPE = 'klicker:manage-context'
const MANAGE_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:manage-context-ack'

export function useEmbeddedManageContext() {
  const embedded = useEmbedded()
  const [context, setContext] = useState<ManageAssistantContext | null>(null)

  useEffect(() => {
    if (!embedded) {
      setContext(null)
      return
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin === 'null') return
      if (!isManageContextMessage(event.data)) return

      const nextContext = sanitizeManageAssistantContext(event.data.payload)
      if (!nextContext) return

      const messageId =
        typeof event.data.messageId === 'number' ? event.data.messageId : null

      setContext(nextContext)
      window.parent.postMessage(
        {
          type: MANAGE_CONTEXT_ACK_MESSAGE_TYPE,
          payload: {
            version: 1,
            ...(messageId != null ? { messageId } : {}),
          },
        },
        event.origin
      )
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [embedded])

  return context
}

function isManageContextMessage(data: unknown): data is {
  type: typeof MANAGE_CONTEXT_MESSAGE_TYPE
  payload: unknown
  messageId?: unknown
} {
  return (
    typeof data === 'object' &&
    data !== null &&
    (data as { type?: unknown }).type === MANAGE_CONTEXT_MESSAGE_TYPE
  )
}

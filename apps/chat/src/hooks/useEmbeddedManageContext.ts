'use client'

import { useEffect, useRef, useState } from 'react'
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
  const contextKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!embedded) {
      contextKeyRef.current = null
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

      // Manage re-posts the same context on open and on every retry until it is
      // acked, and its memo also recomputes whenever the router object changes
      // identity. Publishing a fresh object each time would re-render the whole
      // assistant for an unchanged payload, so only publish real changes.
      const nextKey = JSON.stringify(nextContext)
      if (nextKey !== contextKeyRef.current) {
        contextKeyRef.current = nextKey
        setContext(nextContext)
      }

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

'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  sanitizeManageAssistantContext,
  type ManageAssistantContext,
} from '../services/manageContext'
import { useManageParentStore } from '../stores/manageParentStore'
import { useEmbedded } from './useEmbedded'

const MANAGE_CONTEXT_MESSAGE_TYPE = 'klicker:manage-context'
const MANAGE_CONTEXT_ACK_MESSAGE_TYPE = 'klicker:manage-context-ack'
const MANAGE_CONTEXT_READY_MESSAGE_TYPE = 'klicker:manage-context-ready'

export function useEmbeddedManageContext() {
  const embedded = useEmbedded()
  const searchParams = useSearchParams()
  const parentOrigin = parseOrigin(searchParams.get('parentOrigin'))
  const [context, setContext] = useState<ManageAssistantContext | null>(null)
  const contextKeyRef = useRef<string | null>(null)
  const setManageParentOrigin = useManageParentStore(
    (state) => state.setManageParentOrigin
  )

  useEffect(() => {
    if (!embedded) {
      contextKeyRef.current = null
      setContext(null)
      setManageParentOrigin(null)
      return
    }

    function handleMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin === 'null') return
      if (!isManageContextMessage(event.data)) return

      const nextContext = sanitizeManageAssistantContext(event.data.payload)
      if (!nextContext) return

      // The message passed every validation check above, so event.origin is
      // the verified Manage parent origin. Cache it for components outside
      // this hook (e.g. the proposal card) that need to postMessage back.
      setManageParentOrigin(event.origin)

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

    // Announce readiness so the parent (re)sends the current context exactly
    // when this listener exists. Without this, the parent's timed retry burst
    // can fully elapse before hydration finishes and the context is lost. The
    // parent hands us its own origin as a query param, so target the ping at
    // that concrete origin; if it is absent, skip the proactive ping and let
    // the parent's retry burst deliver the context rather than broadcasting to
    // a '*' wildcard.
    if (parentOrigin) {
      window.parent.postMessage(
        { type: MANAGE_CONTEXT_READY_MESSAGE_TYPE },
        parentOrigin
      )
    }

    return () => window.removeEventListener('message', handleMessage)
  }, [embedded, parentOrigin, setManageParentOrigin])

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

// Accept the query param only when it is a bare, well-formed origin so it can
// never be a '*' wildcard or a full URL when used as a postMessage target.
function parseOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    return new URL(value).origin === value ? value : null
  } catch {
    return null
  }
}

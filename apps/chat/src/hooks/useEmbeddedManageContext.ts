'use client'

import {
  MANAGE_CONTEXT_MESSAGE_TYPE,
  MANAGE_CONTEXT_READY_MESSAGE_TYPE,
} from '@klicker-uzh/types'
import { useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  sanitizeManageAssistantContext,
  type ManageAssistantContext,
} from '../services/manageContext'
import { useManageParentStore } from '../stores/manageParentStore'
import { useEmbedded } from './useEmbedded'

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
      if (!nextContext) {
        // A later message failed sanitization: clear any previously stored
        // context rather than keep acting on stale page state.
        contextKeyRef.current = null
        setContext(null)
        return
      }

      // The message passed every validation check above, so event.origin is
      // the verified Manage parent origin. Cache it for components outside
      // this hook (e.g. the proposal card) that need to postMessage back.
      setManageParentOrigin(event.origin)

      // Manage re-posts the same context on open and whenever its own memo
      // recomputes (e.g. the router object changing identity). Publishing a
      // fresh object each time would re-render the whole assistant for an
      // unchanged payload, so only publish real changes.
      const nextKey = JSON.stringify(nextContext)
      if (nextKey !== contextKeyRef.current) {
        contextKeyRef.current = nextKey
        setContext(nextContext)
      }
    }

    window.addEventListener('message', handleMessage)

    // Announce readiness so the parent (re)sends the current context exactly
    // when this listener exists. The parent also posts once on iframe load,
    // but that first send can race a slow-hydrating iframe (this listener not
    // registered yet) — this ping is what makes the parent resend once we are
    // actually ready to receive it. The parent hands us its own origin as a
    // query param, so target the ping at that concrete origin; if it is
    // absent, skip the proactive ping rather than broadcasting to a '*'
    // wildcard (the parent's load-time send is still delivered whenever it
    // wins the race).
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

'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  createManageAssistantPreflightSignal,
  fetchManageAssistantChatWithCapability,
  INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
  isManageAssistantCapabilityState,
  reduceManageAssistantCapabilityState,
} from '@/src/services/manageAssistantCapabilities'

export function useManageAssistantCapabilities() {
  const [clientState, dispatch] = useReducer(
    reduceManageAssistantCapabilityState,
    INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE
  )
  const preflightController = useRef<AbortController | null>(null)
  const turnRevision = useRef(0)

  const runPreflight = useCallback(() => {
    preflightController.current?.abort()
    const controller = new AbortController()
    preflightController.current = controller
    const revisionAtStart = turnRevision.current
    dispatch({ type: 'check' })

    async function requestCapabilities() {
      try {
        const response = await fetch('/api/manage/capabilities', {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: createManageAssistantPreflightSignal(controller.signal),
        })
        if (!response.ok) {
          throw new Error(
            `Manage assistant capability preflight failed (${response.status})`
          )
        }
        const body: unknown = await response.json()
        const capability =
          body && typeof body === 'object' && 'state' in body
            ? body.state
            : null
        if (!isManageAssistantCapabilityState(capability)) {
          throw new Error('Invalid Manage assistant capability response')
        }
        if (
          preflightController.current === controller &&
          revisionAtStart === turnRevision.current
        ) {
          dispatch({ capability, type: 'resolve' })
        }
      } catch {
        if (
          preflightController.current === controller &&
          !controller.signal.aborted &&
          revisionAtStart === turnRevision.current
        ) {
          dispatch({ capability: 'unavailable', type: 'resolve' })
        }
      }
    }

    void requestCapabilities()
  }, [])

  useEffect(() => {
    runPreflight()
    return () => {
      preflightController.current?.abort()
      preflightController.current = null
    }
  }, [runPreflight])

  const chatFetch = useCallback<typeof globalThis.fetch>(
    (input, init) =>
      fetchManageAssistantChatWithCapability(
        globalThis.fetch,
        input,
        init,
        turnRevision,
        (capability) => {
          dispatch({ capability, type: 'resolve' })
        }
      ),
    []
  )

  return { ...clientState, chatFetch, retry: runPreflight }
}

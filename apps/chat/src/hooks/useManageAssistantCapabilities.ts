'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'
import {
  INITIAL_MANAGE_ASSISTANT_CAPABILITY_STATE,
  isManageAssistantCapabilityState,
  MANAGE_ASSISTANT_CAPABILITY_HEADER,
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

    void fetch('/api/manage/capabilities', {
      cache: 'no-store',
      credentials: 'same-origin',
      signal: controller.signal,
    })
      .then(async (response) => {
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
      })
      .catch(() => {
        if (
          preflightController.current === controller &&
          !controller.signal.aborted &&
          revisionAtStart === turnRevision.current
        ) {
          dispatch({ capability: 'unavailable', type: 'resolve' })
        }
      })
  }, [])

  useEffect(() => {
    runPreflight()
    return () => {
      preflightController.current?.abort()
      preflightController.current = null
    }
  }, [runPreflight])

  const chatFetch = useCallback<typeof globalThis.fetch>(
    async (input, init) => {
      const response = await globalThis.fetch(input, init)
      const capability = response.headers.get(
        MANAGE_ASSISTANT_CAPABILITY_HEADER
      )
      if (isManageAssistantCapabilityState(capability)) {
        turnRevision.current += 1
        dispatch({ capability, type: 'resolve' })
      }
      return response
    },
    []
  )

  return { ...clientState, chatFetch, retry: runPreflight }
}

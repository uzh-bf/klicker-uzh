import type { NextRouter } from 'next/router'
import { useCallback, useEffect, useRef } from 'react'
import type { ChatbotNavigationState } from './chatbotWorkspace'

function useChatbotNavigationGuard({
  router,
  state,
  discardMessage,
  pendingMessage,
}: {
  router: NextRouter
  state: ChatbotNavigationState
  discardMessage: string
  pendingMessage: string
}) {
  const stateRef = useRef(state)
  const allowNextRouteRef = useRef(false)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const confirmNavigation = useCallback(() => {
    if (stateRef.current.pending) {
      window.alert(pendingMessage)
      return false
    }

    return !stateRef.current.dirty || window.confirm(discardMessage)
  }, [discardMessage, pendingMessage])

  const runNavigation = useCallback(
    (navigate: () => unknown) => {
      if (!confirmNavigation()) return
      allowNextRouteRef.current = true
      void navigate()
    },
    [confirmNavigation]
  )

  const runInternalNavigation = useCallback((navigate: () => unknown) => {
    allowNextRouteRef.current = true
    void navigate()
  }, [])

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!stateRef.current.dirty && !stateRef.current.pending) return
      event.preventDefault()
      event.returnValue = ''
    }

    const handleRouteChangeStart = (url: string) => {
      if (allowNextRouteRef.current) {
        allowNextRouteRef.current = false
        return
      }

      if (confirmNavigation()) return

      const error = new Error('Chatbot navigation cancelled') as Error & {
        cancelled?: boolean
      }
      error.cancelled = true
      router.events.emit('routeChangeError', error, url, { shallow: false })
      throw error
    }

    const previousBeforePopState = () => {
      if (!confirmNavigation()) return false
      allowNextRouteRef.current = true
      return true
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    router.events.on('routeChangeStart', handleRouteChangeStart)
    router.beforePopState(previousBeforePopState)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      router.events.off('routeChangeStart', handleRouteChangeStart)
      router.beforePopState(() => true)
    }
  }, [confirmNavigation, router])

  return { confirmNavigation, runInternalNavigation, runNavigation }
}

export default useChatbotNavigationGuard

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
  const currentHistoryEntryRef = useRef<
    | {
        asPath: string
        href: string
        state: unknown
      }
    | undefined
  >(undefined)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    currentHistoryEntryRef.current = {
      asPath: router.asPath,
      href: window.location.href,
      state: window.history.state,
    }
  }, [router.asPath])

  const confirmNavigation = useCallback(() => {
    if (stateRef.current.pending) {
      window.alert(pendingMessage)
      return false
    }

    return !stateRef.current.dirty || window.confirm(discardMessage)
  }, [discardMessage, pendingMessage])

  const runRouteNavigation = useCallback((navigate: () => Promise<boolean>) => {
    allowNextRouteRef.current = true
    void navigate().then(
      () => {
        allowNextRouteRef.current = false
      },
      () => {
        allowNextRouteRef.current = false
      }
    )
  }, [])

  const runNavigation = useCallback(
    (navigate: () => Promise<boolean>) => {
      if (!confirmNavigation()) return
      runRouteNavigation(navigate)
    },
    [confirmNavigation, runRouteNavigation]
  )

  const runInternalNavigation = runRouteNavigation

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
      if (!confirmNavigation()) {
        const currentEntry = currentHistoryEntryRef.current
        if (currentEntry) {
          const targetState = window.history.state as Record<
            string,
            unknown
          > | null
          const currentState = currentEntry.state as Record<
            string,
            unknown
          > | null
          window.history.pushState(
            currentState
              ? {
                  ...currentState,
                  key: targetState?.key ?? currentState.key,
                  as: currentEntry.asPath,
                  url: currentEntry.asPath,
                }
              : currentState,
            '',
            currentEntry.href
          )
        }
        return false
      }
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

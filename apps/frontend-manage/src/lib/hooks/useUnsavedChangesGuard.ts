import { useRouter } from 'next/router'
import { useCallback, useEffect, useRef } from 'react'
import { registerNavigationBlocker } from '../navigationGuard'

export function useUnsavedChangesGuard({
  isDirty,
  message,
}: {
  isDirty: boolean
  message: string
}) {
  const router = useRouter()
  const dirtyRef = useRef(isDirty)
  const bypassNextNavigationRef = useRef(false)
  const allowNextNavigation = useCallback(() => {
    bypassNextNavigationRef.current = true
  }, [])
  const confirmNavigation = useCallback(() => {
    if (!dirtyRef.current || bypassNextNavigationRef.current) return true
    if (!window.confirm(message)) return false
    bypassNextNavigationRef.current = true
    return true
  }, [message])

  dirtyRef.current = isDirty

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  useEffect(() => {
    const resetNavigationBypass = () => {
      bypassNextNavigationRef.current = false
    }

    router.beforePopState(() => confirmNavigation())
    router.events.on('routeChangeComplete', resetNavigationBypass)
    router.events.on('routeChangeError', resetNavigationBypass)
    const unregisterNavigationBlocker =
      registerNavigationBlocker(confirmNavigation)

    return () => {
      router.beforePopState(() => true)
      router.events.off('routeChangeComplete', resetNavigationBypass)
      router.events.off('routeChangeError', resetNavigationBypass)
      unregisterNavigationBlocker()
    }
  }, [confirmNavigation, router])

  return { allowNextNavigation, confirmNavigation }
}

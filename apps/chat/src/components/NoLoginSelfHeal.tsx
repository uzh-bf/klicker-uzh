'use client'

import { useEffect } from 'react'
import {
  CHAT_GUEST_QUERY_KEY,
  CHAT_GUEST_SESSION_STORAGE_KEY,
} from '../hooks/useChatGuestTokenBootstrap'

/**
 * If the user lands on `/noLogin` because middleware did not see a cookie
 * (CHIPS-unsupported browser, full-page reload after the URL `?_t=` was
 * stripped) but a token is still in sessionStorage, redirect them back to
 * the original page with `?_t=<token>` so middleware passes them through.
 *
 * Mounts on the noLogin page only — keeps server-rendered fallback markup
 * intact for users without sessionStorage.
 */
export function NoLoginSelfHeal({ redirectTo }: { redirectTo?: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !redirectTo) return

    let token: string | null = null
    try {
      token = window.sessionStorage.getItem(CHAT_GUEST_SESSION_STORAGE_KEY)
    } catch {
      return
    }
    if (!token) return

    const target = new URL(redirectTo, window.location.origin)
    if (target.origin !== window.location.origin) return

    target.searchParams.set(CHAT_GUEST_QUERY_KEY, token)
    window.location.replace(target.toString())
  }, [redirectTo])

  return null
}

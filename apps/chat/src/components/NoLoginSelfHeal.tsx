'use client'

import { useEffect } from 'react'
import {
  CHAT_GUEST_QUERY_KEY,
  CHAT_GUEST_SESSION_STORAGE_KEY,
} from '../hooks/useChatGuestTokenBootstrap'
import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
} from '../lib/pwaEmbedAuth'

/**
 * If the user lands on `/noLogin` because middleware did not see a cookie
 * (CHIPS-unsupported browser, full-page reload after the URL token was
 * stripped) but a scoped token is still in sessionStorage, redirect them back
 * with the matching query token so middleware passes them through.
 *
 * Mounts on the noLogin page only — keeps server-rendered fallback markup
 * intact for users without sessionStorage.
 */
export function NoLoginSelfHeal({ redirectTo }: { redirectTo?: string }) {
  useEffect(() => {
    if (typeof window === 'undefined' || !redirectTo) return

    let queryKey: string | null = null
    let token: string | null = null
    try {
      token = window.sessionStorage.getItem(PWA_CHAT_EMBED_SESSION_STORAGE_KEY)
      queryKey = token ? PWA_CHAT_EMBED_QUERY_KEY : null

      if (!token) {
        token = window.sessionStorage.getItem(CHAT_GUEST_SESSION_STORAGE_KEY)
        queryKey = token ? CHAT_GUEST_QUERY_KEY : null
      }
    } catch {
      return
    }
    if (!token || !queryKey) return

    const target = new URL(redirectTo, window.location.origin)
    if (target.origin !== window.location.origin) return

    target.searchParams.set(queryKey, token)
    window.location.replace(target.toString())
  }, [redirectTo])

  return null
}

'use client'

import { bootstrapTokenFromUrl } from '@klicker-uzh/util/client-auth'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { PWA_CHAT_EMBED_SESSION_STORAGE_KEY } from '../lib/pwaEmbedAuth'

export const CHAT_GUEST_SESSION_STORAGE_KEY = 'chat_participant_token'
export const CHAT_GUEST_QUERY_KEY = '_t'

/**
 * Bootstraps a chat-guest token from the `?_t=` query parameter into
 * `sessionStorage`, then strips the parameter from the URL via
 * `router.replace` so it does not persist in browser history.
 *
 * Used as the sessionStorage fallback for the CHIPS-unsupported-browser path
 * (pre-Safari 26.2 / pre-Firefox 141 inside an LMS iframe). On modern
 * browsers, `chat_participant_token` is set as a Partitioned cookie and the
 * `_t` query is never appended by `/auth/lti`.
 */
export function useChatGuestTokenBootstrap(): void {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const next = bootstrapTokenFromUrl(
      new URLSearchParams(searchParams.toString()),
      {
        storageKey: CHAT_GUEST_SESSION_STORAGE_KEY,
        queryKey: CHAT_GUEST_QUERY_KEY,
      }
    )
    if (!next) return

    try {
      window.sessionStorage.removeItem(PWA_CHAT_EMBED_SESSION_STORAGE_KEY)
    } catch {}

    const qs = next.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, pathname, router])
}

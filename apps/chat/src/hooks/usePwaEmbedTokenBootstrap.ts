'use client'

import { bootstrapTokenFromUrl } from '@klicker-uzh/util/client-auth'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import {
  PWA_CHAT_EMBED_QUERY_KEY,
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
} from '../lib/pwaEmbedAuth'
import { CHAT_GUEST_SESSION_STORAGE_KEY } from './useChatGuestTokenBootstrap'

export function usePwaEmbedTokenBootstrap(): void {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (typeof window === 'undefined') return

    const next = bootstrapTokenFromUrl(
      new URLSearchParams(searchParams.toString()),
      {
        storageKey: PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
        queryKey: PWA_CHAT_EMBED_QUERY_KEY,
      }
    )
    if (!next) return

    try {
      window.sessionStorage.removeItem(CHAT_GUEST_SESSION_STORAGE_KEY)
    } catch {}

    const qs = next.toString()
    // URL cleanup must not trigger an unauthenticated server navigation when
    // the embed relies on sessionStorage because cookies are unavailable.
    window.history.replaceState(null, '', qs ? `${pathname}?${qs}` : pathname)
  }, [searchParams, pathname])
}

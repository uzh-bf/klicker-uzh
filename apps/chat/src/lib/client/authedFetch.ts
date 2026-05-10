'use client'

import { CHAT_GUEST_SESSION_STORAGE_KEY } from '../../hooks/useChatGuestTokenBootstrap'

/**
 * `fetch` wrapper that attaches `Authorization: Bearer <token>` from
 * sessionStorage when the chat-guest cookie is unavailable (CHIPS-unsupported
 * browsers in LMS iframes). On cookie-friendly browsers, sessionStorage is
 * empty and this is a pass-through to native `fetch`.
 */
export function authedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (typeof sessionStorage === 'undefined') {
    return fetch(input, init)
  }

  let token: string | null = null
  try {
    token = sessionStorage.getItem(CHAT_GUEST_SESSION_STORAGE_KEY)
  } catch {
    token = null
  }

  if (!token) {
    return fetch(input, init)
  }

  const headers = new Headers(init.headers)
  if (!headers.has('authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return fetch(input, { ...init, headers })
}

'use client'

import { createAuthedFetch } from '@klicker-uzh/util/client-auth'
import {
  CHAT_GUEST_SESSION_STORAGE_KEY,
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
} from '../pwaEmbedAuth'

const fetchWithChatBearer = createAuthedFetch([
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
  CHAT_GUEST_SESSION_STORAGE_KEY,
])

/** Add the scoped bearer only to Chat and its configured direct API. */
export const authedFetch: typeof fetch = (input, init) => {
  if (typeof location === 'undefined') return fetch(input, init)
  const target = new URL(
    input instanceof Request ? input.url : input,
    location.href
  )
  const directApiOrigin = document.documentElement?.dataset.chatApiUrl
  if (target.origin !== location.origin && target.origin !== directApiOrigin) {
    return fetch(input, init)
  }
  return fetchWithChatBearer(input, init)
}

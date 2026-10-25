'use client'

import { createAuthedFetch } from '@klicker-uzh/util/client-auth'
import { CHAT_GUEST_SESSION_STORAGE_KEY } from '../../hooks/useChatGuestTokenBootstrap'
import { PWA_CHAT_EMBED_SESSION_STORAGE_KEY } from '../pwaEmbedAuth'

/**
 * `fetch` wrapper that attaches `Authorization: Bearer <token>` from
 * sessionStorage when the chat-owned cookie is unavailable (CHIPS-unsupported
 * browsers in LMS iframes). On cookie-friendly browsers, sessionStorage stays
 * empty and this is a pass-through to native `fetch`.
 */
export const authedFetch = createAuthedFetch([
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
  CHAT_GUEST_SESSION_STORAGE_KEY,
])

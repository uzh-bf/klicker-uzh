'use client'

import { createAuthedFetch } from '@klicker-uzh/util/client-auth'
import { CHAT_GUEST_SESSION_STORAGE_KEY } from '../../hooks/useChatGuestTokenBootstrap'

/**
 * `fetch` wrapper that attaches `Authorization: Bearer <token>` from
 * sessionStorage when the chat-guest cookie is unavailable (CHIPS-unsupported
 * browsers in LMS iframes). On cookie-friendly browsers, sessionStorage is
 * empty and this is a pass-through to native `fetch`.
 */
export const authedFetch = createAuthedFetch(CHAT_GUEST_SESSION_STORAGE_KEY)

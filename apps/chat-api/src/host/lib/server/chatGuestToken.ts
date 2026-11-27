import { createHmac } from 'node:crypto'
import { signJWT, verifyJWT } from '@klicker-uzh/util'

export const GUEST_ACCOUNT_TYPE = 'lti_guest'
const CHAT_GUEST_TOKEN_EXPIRY = '14d'
const CHAT_GUEST_SCOPE = 'CHAT_GUEST'
export type AuthMode = 'account' | 'anonymous'

function getChatGuestSecret(): string {
  if (process.env.APP_CHAT_GUEST_SECRET)
    return process.env.APP_CHAT_GUEST_SECRET
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'APP_CHAT_GUEST_SECRET is required in production. Falling back to ' +
        'APP_SECRET-derived value would let APP_SECRET-knowers forge guest tokens.'
    )
  }
  const appSecret = process.env.APP_SECRET
  if (!appSecret) throw new Error('APP_SECRET is required')
  return createHmac('sha256', appSecret)
    .update('chat-guest-secret')
    .digest('hex')
}

// ---------------------------------------------------------------------------
// Chat-guest JWT (separate signing secret, scope CHAT_GUEST, host-only cookie)
// ---------------------------------------------------------------------------

export interface ChatGuestTokenPayload {
  sub: string
  scope: typeof CHAT_GUEST_SCOPE
  // Opaque eLearning learner pseudonym; only present on tokens minted
  // through the eLearning chat handoff. PWA quiz paths never set it.
  learnerBinding?: string
}

export async function signChatGuestToken(
  participantId: string,
  learnerBinding?: string
): Promise<string> {
  return signJWT(
    {
      sub: participantId,
      scope: CHAT_GUEST_SCOPE,
      ...(learnerBinding ? { learnerBinding } : {}),
    },
    getChatGuestSecret(),
    { algorithm: 'HS256', expiresIn: CHAT_GUEST_TOKEN_EXPIRY }
  )
}

export async function verifyChatGuestToken(
  token: string
): Promise<ChatGuestTokenPayload> {
  const payload = await verifyJWT(token, getChatGuestSecret())
  if (payload.scope !== CHAT_GUEST_SCOPE || typeof payload.sub !== 'string') {
    throw new Error('Invalid chat guest token: wrong scope or sub')
  }
  return {
    sub: payload.sub,
    scope: CHAT_GUEST_SCOPE,
    ...(typeof payload.learnerBinding === 'string'
      ? { learnerBinding: payload.learnerBinding }
      : {}),
  }
}

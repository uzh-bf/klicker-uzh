import { createHmac } from 'node:crypto'

// Guest chat personas are course-scoped: one verified LTI subject maps to one
// persona per course, and the persona's account key is a deterministic HMAC
// over `(ltiSub, courseId)`. Deriving from the verified subject (rather than
// from a browser session) is what lets the Chat guest entry and the backend
// account resolver agree on the same persona. The output is a stored contract:
// every existing guest row is keyed by it, so changing the prefix, the HMAC
// input, the encoding or the seed source would strand those rows.
export const GUEST_SSO_PREFIX = 'chat-guest:'

export const GUEST_ACCOUNT_TYPE = 'lti_guest'

// Resolves the guest persona seed lazily so a build without the secret does
// not fail at module load. Production requires the explicit, purpose-scoped
// seed: deriving it from APP_SECRET would tie persona identity to a separate
// trust domain.
export function getChatGuestSeed(): string {
  if (process.env.CHAT_GUEST_SEED) return process.env.CHAT_GUEST_SEED
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'CHAT_GUEST_SEED is required in production. Falling back to ' +
        'APP_SECRET-derived value would link guest persona derivation to ' +
        'APP_SECRET, which is a separate trust domain.'
    )
  }
  const appSecret = process.env.APP_SECRET
  if (!appSecret) throw new Error('APP_SECRET is required')
  return createHmac('sha256', appSecret).update('chat-guest-seed').digest('hex')
}

// Per-course HMAC. A single LTI `sub` maps to N guest personas (one per
// course); the account claim flow enumerates them by recomputing this for
// every course the recovered account is enrolled in.
export function deriveGuestSsoId(ltiSub: string, courseId: string): string {
  const seed = getChatGuestSeed()
  const hmac = createHmac('sha256', seed)
    .update(`${ltiSub}:${courseId}`)
    .digest('base64url')
  return `${GUEST_SSO_PREFIX}${hmac}`
}

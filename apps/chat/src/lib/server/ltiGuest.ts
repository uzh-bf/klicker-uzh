import { prisma } from '@klicker-uzh/prisma'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import { createHmac, randomBytes } from 'crypto'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GUEST_SSO_PREFIX = 'chat-guest:'
const CHAT_GUEST_TOKEN_EXPIRY = '14d'

// ---------------------------------------------------------------------------
// Secrets
// ---------------------------------------------------------------------------

/**
 * Seed used to derive deterministic guest SSO IDs.
 * Falls back to a HMAC of APP_SECRET so dev environments work without an
 * extra env var, but production should always set CHAT_GUEST_SEED.
 */
function getChatGuestSeed(): string {
  if (process.env.CHAT_GUEST_SEED) {
    return process.env.CHAT_GUEST_SEED
  }
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    throw new Error('APP_SECRET is required')
  }
  return createHmac('sha256', appSecret).update('chat-guest-seed').digest('hex')
}

/**
 * Secret used to sign `chat_participant_token` JWTs.
 * Must differ from APP_SECRET so these tokens cannot be used against
 * the main GraphQL API.
 */
function getChatGuestSecret(): string {
  if (process.env.APP_CHAT_GUEST_SECRET) {
    return process.env.APP_CHAT_GUEST_SECRET
  }
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    throw new Error('APP_SECRET is required')
  }
  return createHmac('sha256', appSecret)
    .update('chat-guest-secret')
    .digest('hex')
}

// ---------------------------------------------------------------------------
// Guest SSO ID derivation
// ---------------------------------------------------------------------------

/**
 * Derives a deterministic, non-reversible guest SSO ID for a given LTI
 * subject and course. The same LTI user in the same course will always
 * get the same guest persona, but the raw LTI `sub` cannot be recovered
 * from the stored value.
 */
export function deriveGuestSsoId(ltiSub: string, courseId: string): string {
  const seed = getChatGuestSeed()
  const hmac = createHmac('sha256', seed)
    .update(`${ltiSub}:${courseId}`)
    .digest('base64url')
  return `${GUEST_SSO_PREFIX}${hmac}`
}

// ---------------------------------------------------------------------------
// Guest persona creation / lookup
// ---------------------------------------------------------------------------

export interface GuestPersona {
  participantId: string
  isNew: boolean
}

/**
 * Finds or creates a guest participant + participation for the given
 * LTI identity and course. The guest has:
 * - a random username/password (not user-facing)
 * - no email (to avoid storing PII for anonymous personas)
 * - `ParticipantAccount.type = 'lti_guest'`
 */
export async function findOrCreateGuestPersona(
  ltiSub: string,
  ltiScope: string,
  courseId: string
): Promise<GuestPersona> {
  const guestSsoId = deriveGuestSsoId(ltiSub, courseId)

  // 1. Look up existing guest account
  const existingAccount = await prisma.participantAccount.findUnique({
    where: { ssoId: guestSsoId },
    select: { participantId: true },
  })

  if (existingAccount) {
    // Ensure participation exists (idempotent upsert)
    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: existingAccount.participantId,
        },
      },
      create: {
        course: { connect: { id: courseId } },
        participant: { connect: { id: existingAccount.participantId } },
      },
      update: {},
    })

    return { participantId: existingAccount.participantId, isNew: false }
  }

  // 2. Create new guest participant + account + participation
  const randomSuffix = randomBytes(8).toString('hex')
  const randomPassword = randomBytes(16).toString('hex')

  const newParticipant = await prisma.participant.create({
    data: {
      username: `guest_${randomSuffix}`,
      password: randomPassword,
      email: null,
      isEmailValid: false,
      isSSOAccount: true,
      isProfilePublic: false,
      isActive: true,
      accounts: {
        create: {
          ssoId: guestSsoId,
          ssoType: ltiScope,
          type: 'lti_guest',
        },
      },
      participations: {
        create: {
          course: { connect: { id: courseId } },
        },
      },
    },
    select: { id: true },
  })

  return { participantId: newParticipant.id, isNew: true }
}

// ---------------------------------------------------------------------------
// Chat-guest JWT
// ---------------------------------------------------------------------------

export type AuthMode = 'account' | 'anonymous'

export interface ChatGuestTokenPayload {
  sub: string
  scope: 'CHAT_GUEST'
}

/**
 * Issues a `chat_participant_token` JWT for anonymous chat access.
 * Signed with `APP_CHAT_GUEST_SECRET` (or derived fallback) so it
 * cannot be used against the main GraphQL backend.
 */
export async function signChatGuestToken(
  participantId: string
): Promise<string> {
  return signJWT(
    { sub: participantId, scope: 'CHAT_GUEST' },
    getChatGuestSecret(),
    { algorithm: 'HS256', expiresIn: CHAT_GUEST_TOKEN_EXPIRY }
  )
}

/**
 * Verifies a `chat_participant_token` JWT.
 * Returns the participant ID or throws on invalid/expired tokens.
 */
export async function verifyChatGuestToken(
  token: string
): Promise<ChatGuestTokenPayload> {
  const payload = await verifyJWT(token, getChatGuestSecret())

  if (payload.scope !== 'CHAT_GUEST' || typeof payload.sub !== 'string') {
    throw new Error('Invalid chat guest token: wrong scope')
  }

  return { sub: payload.sub, scope: 'CHAT_GUEST' }
}

// ---------------------------------------------------------------------------
// LTI JWT verification (short-lived token from apps/lti)
// ---------------------------------------------------------------------------

export interface LtiTokenPayload {
  sub: string
  email?: string
  scope: string // 'LTI1.3' or 'LTI1.1'
}

/**
 * Verifies the short-lived LTI JWT issued by `apps/lti` on LTI launch.
 * This token is signed with `APP_SECRET` and has a 5-minute expiry.
 */
export async function verifyLtiToken(token: string): Promise<LtiTokenPayload> {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) {
    throw new Error('APP_SECRET is required')
  }

  const payload = await verifyJWT(token, appSecret)

  if (
    !payload.sub ||
    (payload.scope !== 'LTI1.3' && payload.scope !== 'LTI1.1')
  ) {
    throw new Error('Invalid LTI token: missing sub or wrong scope')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    scope: payload.scope,
  }
}

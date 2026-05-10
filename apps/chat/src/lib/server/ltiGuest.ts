import { prisma } from '@klicker-uzh/prisma'
import { Prisma } from '@klicker-uzh/prisma/client'
import { signJWT, verifyJWT } from '@klicker-uzh/util'
import bcrypt from 'bcryptjs'
import { createHmac, randomBytes } from 'crypto'

// Stable, exported across phases: Phase C will recompute these to match guest
// personas to a real account by `(ltiSub, courseId)`. Do not change without
// a migration plan for existing guest rows.
export const GUEST_SSO_PREFIX = 'chat-guest:'
export const GUEST_ACCOUNT_TYPE = 'lti_guest'
const CHAT_GUEST_TOKEN_EXPIRY = '14d'
const CHAT_GUEST_SCOPE = 'CHAT_GUEST'

export type LtiScope = 'LTI1.1' | 'LTI1.3'
export type AuthMode = 'account' | 'anonymous'

// ---------------------------------------------------------------------------
// Secret resolution — fail fast on first use in production rather than at
// module load (Next.js evaluates route modules at build time, which would
// otherwise blow up `next build` in environments without these secrets).
// ---------------------------------------------------------------------------

function getChatGuestSeed(): string {
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
// Guest SSO ID derivation
// ---------------------------------------------------------------------------

// Per-course HMAC. A single LTI `sub` maps to N guest personas (one per
// course); Phase C cross-course claim flow enumerates by recomputing this
// for every course the recovered account is enrolled in.
export function deriveGuestSsoId(ltiSub: string, courseId: string): string {
  const seed = getChatGuestSeed()
  const hmac = createHmac('sha256', seed)
    .update(`${ltiSub}:${courseId}`)
    .digest('base64url')
  return `${GUEST_SSO_PREFIX}${hmac}`
}

// ---------------------------------------------------------------------------
// Guest persona find/create — race-safe via P2002 catch
// ---------------------------------------------------------------------------

export interface GuestPersona {
  participantId: string
  isNew: boolean
}

function isUniqueViolationOn(
  error: Prisma.PrismaClientKnownRequestError,
  fieldName: string
): boolean {
  const target = error.meta?.target
  if (Array.isArray(target)) return target.includes(fieldName)
  if (typeof target === 'string') return target.includes(fieldName)
  return true
}

export async function findOrCreateGuestPersona(
  ltiSub: string,
  ltiScope: LtiScope,
  courseId: string
): Promise<GuestPersona> {
  const guestSsoId = deriveGuestSsoId(ltiSub, courseId)

  const existing = await prisma.participantAccount.findUnique({
    where: { ssoId: guestSsoId },
    select: { participantId: true },
  })

  if (existing) {
    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: existing.participantId,
        },
      },
      create: {
        course: { connect: { id: courseId } },
        participant: { connect: { id: existing.participantId } },
      },
      update: {},
    })
    return { participantId: existing.participantId, isNew: false }
  }

  const randomSuffix = randomBytes(8).toString('hex')
  const hashedPassword = await bcrypt.hash(randomBytes(16).toString('hex'), 12)

  try {
    const created = await prisma.participant.create({
      data: {
        username: `guest_${randomSuffix}`,
        password: hashedPassword,
        email: null,
        isEmailValid: false,
        isSSOAccount: true,
        isProfilePublic: false,
        isActive: true,
        accounts: {
          create: {
            ssoId: guestSsoId,
            ssoType: ltiScope,
            type: GUEST_ACCOUNT_TYPE,
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
    return { participantId: created.id, isNew: true }
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002' &&
      isUniqueViolationOn(error, 'ssoId')
    ) {
      const racedExisting = await prisma.participantAccount.findUnique({
        where: { ssoId: guestSsoId },
        select: { participantId: true },
      })
      if (racedExisting) {
        await prisma.participation.upsert({
          where: {
            courseId_participantId: {
              courseId,
              participantId: racedExisting.participantId,
            },
          },
          create: {
            course: { connect: { id: courseId } },
            participant: { connect: { id: racedExisting.participantId } },
          },
          update: {},
        })
        return { participantId: racedExisting.participantId, isNew: false }
      }
    }
    throw error
  }
}

// ---------------------------------------------------------------------------
// Chat-guest JWT (separate signing secret, scope CHAT_GUEST, host-only cookie)
// ---------------------------------------------------------------------------

export interface ChatGuestTokenPayload {
  sub: string
  scope: typeof CHAT_GUEST_SCOPE
}

export async function signChatGuestToken(
  participantId: string
): Promise<string> {
  return signJWT(
    { sub: participantId, scope: CHAT_GUEST_SCOPE },
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
  return { sub: payload.sub, scope: CHAT_GUEST_SCOPE }
}

// ---------------------------------------------------------------------------
// LTI JWT verification (short-lived, signed by apps/lti with APP_SECRET)
// ---------------------------------------------------------------------------

export interface LtiTokenPayload {
  sub: string
  email?: string
  scope: LtiScope
}

export async function verifyLtiToken(token: string): Promise<LtiTokenPayload> {
  const appSecret = process.env.APP_SECRET
  if (!appSecret) throw new Error('APP_SECRET is required')

  const issuer = process.env.APP_ORIGIN_LTI
  if (!issuer) throw new Error('APP_ORIGIN_LTI is required')

  const payload = await verifyJWT(token, appSecret, { issuer })

  if (
    !payload.sub ||
    (payload.scope !== 'LTI1.3' && payload.scope !== 'LTI1.1')
  ) {
    throw new Error('Invalid LTI token: missing sub or wrong scope')
  }

  return {
    sub: payload.sub,
    email: payload.email,
    scope: payload.scope as LtiScope,
  }
}

// ---------------------------------------------------------------------------
// Auth decision resolver — pure function. Phase C wraps this with a UI page.
// ---------------------------------------------------------------------------

export interface ResolveLtiAuthInput {
  ltiSub: string
  ltiScope: LtiScope
  courseId: string
  // Verified `sub` from the request's `participant_token` cookie, or null if
  // absent/invalid. The account branch only fires when this matches the real
  // account participant id — a stale token for a different participant on a
  // shared browser must not select the account branch.
  participantTokenSub: string | null
}

export type ResolveLtiAuthDecision =
  | { mode: 'account'; participantId: string }
  | { mode: 'guest'; participantId: string; isNewGuest: boolean }

// Phase A invariant: never delete or modify the existing real account row
// when both a real account and a guest persona exist for the same `ltiSub`.
// Phase C decides what to do with the guest history.
export async function resolveLtiAuthDecision(
  input: ResolveLtiAuthInput
): Promise<ResolveLtiAuthDecision> {
  const { ltiSub, ltiScope, courseId, participantTokenSub } = input

  const realAccount = await prisma.participantAccount.findFirst({
    where: { ssoId: ltiSub, NOT: { type: GUEST_ACCOUNT_TYPE } },
    select: { participantId: true },
  })

  if (realAccount && participantTokenSub === realAccount.participantId) {
    await prisma.participation.upsert({
      where: {
        courseId_participantId: {
          courseId,
          participantId: realAccount.participantId,
        },
      },
      create: {
        course: { connect: { id: courseId } },
        participant: { connect: { id: realAccount.participantId } },
      },
      update: {},
    })
    return { mode: 'account', participantId: realAccount.participantId }
  }

  // Real account without valid token, or no real account at all → guest.
  // Phase A invariant: leave the real account row untouched.
  const guest = await findOrCreateGuestPersona(ltiSub, ltiScope, courseId)
  return {
    mode: 'guest',
    participantId: guest.participantId,
    isNewGuest: guest.isNew,
  }
}

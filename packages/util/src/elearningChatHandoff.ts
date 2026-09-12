import {
  ELEARNING_SNAPSHOT_EXCERPT_MAX_LENGTH,
  type ELearningSnapshotContent,
} from '@klicker-uzh/types'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { verifyJWT, type JWTPayload } from './jwt.js'

// Shared constants for the purpose-specific eLearning-to-chat handoff. The
// eLearning server signs grant and snapshot tokens with a shared secret; this
// module verifies them inside Klicker. See the contextual chatbot roadmap and
// docs/adr/0006-learning-context-evidence-in-chat.md.
export const ELEARNING_CHAT_ISSUER = 'elearning'
export const ELEARNING_CHAT_AUDIENCE = 'klicker-chat'
export const ELEARNING_CHAT_GRANT_SCOPE = 'ELEARNING_CHAT'
export const ELEARNING_SNAPSHOT_SCOPE = 'ELEARNING_SNAPSHOT'
export const ELEARNING_CHAT_GRANT_PURPOSE = 'chat-handoff'
export const ELEARNING_GRANT_MAX_AGE_SECONDS = 120
export const ELEARNING_SNAPSHOT_MAX_AGE_SECONDS = 300
export const ELEARNING_SNAPSHOT_OUTLINE_MAX_ITEMS = 30

export interface ElearningChatGrant {
  learnerId: string
  email?: string
  chatbotId: string
  klickerCourseId: string
  elearningCourseId: string
}

export interface ElearningSnapshotEnvelope {
  learnerBinding: string
  chatbotId: string
  klickerCourseId: string
  snapshot: ELearningSnapshotContent
  expiresAt: number
}

export type ElearningChatHandoffError =
  | 'invalid-token'
  | 'wrong-purpose'
  | 'wrong-scope'
  | 'wrong-audience'
  | 'wrong-issuer'
  | 'expired'
  | 'invalid-shape'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= max
}

function checkAudience(payload: JWTPayload): boolean {
  const aud = payload.aud
  if (typeof aud === 'string') return aud === ELEARNING_CHAT_AUDIENCE
  if (Array.isArray(aud)) return aud.includes(ELEARNING_CHAT_AUDIENCE)
  return false
}

function tokenError(
  payload: JWTPayload | null,
  reason: ElearningChatHandoffError
): never {
  const scope =
    payload && typeof payload.scope === 'string' ? payload.scope : 'unknown'
  throw new Error(
    'Invalid eLearning chat token: ' + reason + ' (scope=' + scope + ')'
  )
}

// Learner binding: an opaque, per-learner pseudonym that links the chat
// session to eLearning snapshot envelopes without exposing the raw learner
// id to the chat client. The secret is the shared eLearning handoff secret.
export function deriveElearningLearnerBinding(
  secret: string,
  learnerId: string
): string {
  return createHmac('sha256', secret)
    .update('learner:' + learnerId)
    .digest('base64url')
}

export function learnerBindingsEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ab.length === bb.length && timingSafeEqual(ab, bb)
}

// Resolves the shared eLearning handoff secret. Production requires the
// explicit purpose-scoped secret; development falls back to an APP_SECRET
// derivative so local environments stay self-contained.
export function getElearningChatHandoffSecret(): string {
  const explicit = process.env.ELEARNING_CHAT_HANDOFF_SECRET
  if (explicit) return explicit
  if (process.env.NODE_ENV === 'production') {
    throw new Error('ELEARNING_CHAT_HANDOFF_SECRET is required in production')
  }
  const appSecret = process.env.APP_SECRET
  if (!appSecret) throw new Error('APP_SECRET is required')
  return createHmac('sha256', appSecret)
    .update('elearning-chat-handoff')
    .digest('hex')
}

function requireSharedSecret(secret?: string): string {
  if (!secret) throw new Error('ELEARNING_CHAT_HANDOFF_SECRET is required')
  return secret
}

// Verifies the eLearning chat handoff grant (purpose-scoped login token).
// The caller supplies courseId/chatbotId separately and must still check
// that they match the grant binding before trusting it.
export async function verifyElearningChatGrant(
  token: string,
  secret?: string
): Promise<ElearningChatGrant> {
  const payload = await verifyJWT(token, requireSharedSecret(secret), {
    issuer: ELEARNING_CHAT_ISSUER,
    clockTolerance: 0,
  })

  if (payload.aud !== undefined && !checkAudience(payload)) {
    tokenError(payload, 'wrong-audience')
  }
  if (payload.scope !== ELEARNING_CHAT_GRANT_SCOPE) {
    tokenError(payload, 'wrong-scope')
  }
  if (payload.purpose !== ELEARNING_CHAT_GRANT_PURPOSE) {
    tokenError(payload, 'wrong-purpose')
  }
  if (typeof payload.exp !== 'number' || payload.exp <= 0) {
    tokenError(payload, 'expired')
  }
  const issuedAt = typeof payload.iat === 'number' ? payload.iat : 0
  if (payload.exp - issuedAt > ELEARNING_GRANT_MAX_AGE_SECONDS) {
    tokenError(payload, 'expired')
  }

  const sub = payload.sub
  if (!boundedString(sub, 256)) tokenError(payload, 'invalid-shape')
  const chatbotId = payload.chatbotId
  if (typeof chatbotId !== 'string' || !chatbotId) {
    tokenError(payload, 'invalid-shape')
  }
  const klickerCourseId = payload.klickerCourseId
  if (typeof klickerCourseId !== 'string' || !klickerCourseId) {
    tokenError(payload, 'invalid-shape')
  }
  const elearningCourseId = payload.elearningCourseId
  if (typeof elearningCourseId !== 'string' || !elearningCourseId) {
    tokenError(payload, 'invalid-shape')
  }

  return {
    learnerId: sub,
    ...(typeof payload.email === 'string' && payload.email
      ? { email: payload.email }
      : {}),
    chatbotId,
    klickerCourseId,
    elearningCourseId,
  }
}

// Shallowly verifies the signed learning-context snapshot envelope. The
// snapshot content is validated in depth by the chat route; this check bounds
// the largest fields so unbounded text cannot reach deeper layers.
export async function verifyElearningSnapshotEnvelope(
  token: string,
  secret?: string
): Promise<ElearningSnapshotEnvelope> {
  const payload = await verifyJWT(token, requireSharedSecret(secret), {
    issuer: ELEARNING_CHAT_ISSUER,
    clockTolerance: 0,
  })

  if (payload.aud !== undefined && !checkAudience(payload)) {
    tokenError(payload, 'wrong-audience')
  }
  if (payload.scope !== ELEARNING_SNAPSHOT_SCOPE) {
    tokenError(payload, 'wrong-scope')
  }
  if (typeof payload.exp !== 'number' || payload.exp <= 0) {
    tokenError(payload, 'expired')
  }

  const sub = payload.sub
  if (!boundedString(sub, 128)) tokenError(payload, 'invalid-shape')
  const chatbotId = payload.chatbotId
  if (typeof chatbotId !== 'string' || !chatbotId) {
    tokenError(payload, 'invalid-shape')
  }
  const klickerCourseId = payload.klickerCourseId
  if (typeof klickerCourseId !== 'string' || !klickerCourseId) {
    tokenError(payload, 'invalid-shape')
  }
  const snapshot = payload.snapshot
  if (!isRecord(snapshot)) tokenError(payload, 'invalid-shape')

  const snapshotId = snapshot.snapshotId
  if (!boundedString(snapshotId, 128)) tokenError(payload, 'invalid-shape')
  const observedAt = snapshot.observedAt
  if (!boundedString(observedAt, 64)) tokenError(payload, 'invalid-shape')
  const locale = snapshot.locale
  if (!boundedString(locale, 16)) tokenError(payload, 'invalid-shape')
  const location = snapshot.location
  if (!isRecord(location)) tokenError(payload, 'invalid-shape')
  const material = snapshot.material
  if (!isRecord(material)) tokenError(payload, 'invalid-shape')
  if (material.excerpt !== undefined) {
    if (typeof material.excerpt !== 'string') {
      tokenError(payload, 'invalid-shape')
    }
    if (material.excerpt.length > ELEARNING_SNAPSHOT_EXCERPT_MAX_LENGTH) {
      tokenError(payload, 'invalid-shape')
    }
  }
  if (snapshot.outline !== undefined) {
    if (!Array.isArray(snapshot.outline)) tokenError(payload, 'invalid-shape')
    if (snapshot.outline.length > ELEARNING_SNAPSHOT_OUTLINE_MAX_ITEMS) {
      tokenError(payload, 'invalid-shape')
    }
  }

  return {
    learnerBinding: sub,
    chatbotId,
    klickerCourseId,
    snapshot: snapshot as unknown as ELearningSnapshotContent,
    expiresAt: payload.exp,
  }
}

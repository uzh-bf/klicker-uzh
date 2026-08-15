import { createHash } from 'node:crypto'
import { UserRole } from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import { parseCookiesHeader } from './auth.js'
import { type JWTPayload, signJWT, verifyJWT } from './jwt.js'
import type { CorrelatedResponseInstanceInfo } from './liveQuizResponseMetadata.js'

export const PARTICIPANT_COOKIE_NAME = 'participant_token'
export const TEMPORARY_PARTICIPANT_COOKIE_NAME = 'temporary_participant_token'
export const LIVE_QUIZ_RESPONDENT_COOKIE_PREFIX = 'live_quiz_respondent_token_'
export const LIVE_QUIZ_RESPONDENT_ROLE = 'LIVE_QUIZ_RESPONDENT'
export const LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS = 14 * 24 * 60 * 60
export const CORRELATED_RESPONSE_EVENT = 'response-received:correlated-v1'

export function getLiveQuizRespondentCookieName(liveQuizId: string) {
  return `${LIVE_QUIZ_RESPONDENT_COOKIE_PREFIX}${liveQuizId}`
}

export type LiveQuizResponseIdentity =
  | {
      kind: 'participant'
      id: string
      token: string
      cookieName: typeof PARTICIPANT_COOKIE_NAME
    }
  | {
      kind: 'temporary'
      id: string
      liveQuizId: string
      token: string
      cookieName: typeof TEMPORARY_PARTICIPANT_COOKIE_NAME
    }
  | {
      kind: 'anonymous'
      id: string
      liveQuizId: string
      publicationGeneration: number
      token: string
      cookieName: string
    }

export type LiveQuizResponseIdentityKey =
  | `participant:${string}`
  | `respondent:${string}`

export function buildLiveQuizResponseIdentityKey({
  kind,
  id,
}: Pick<LiveQuizResponseIdentity, 'kind' | 'id'>): LiveQuizResponseIdentityKey {
  return kind === 'participant' ? `participant:${id}` : `respondent:${id}`
}

export async function createLiveQuizRespondentToken({
  respondentId,
  liveQuizId,
  publicationGeneration,
  secret,
  issuer,
}: {
  respondentId: string
  liveQuizId: string
  publicationGeneration: number
  secret: string
  issuer: string
}) {
  return signJWT(
    {
      sub: respondentId,
      role: LIVE_QUIZ_RESPONDENT_ROLE,
      liveQuizId,
      publicationGeneration,
    },
    secret,
    {
      algorithm: 'HS256',
      expiresIn: `${LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS}s`,
      issuer,
    }
  )
}

async function verifyIdentityToken({
  token,
  secret,
  issuer,
}: {
  token: string | undefined
  secret: string
  issuer: string
}): Promise<JWTPayload | null> {
  if (!token) return null

  try {
    return await verifyJWT(token, secret, { issuer, logError: false })
  } catch {
    return null
  }
}

export async function resolveLiveQuizResponseIdentity({
  cookieHeader,
  liveQuizId,
  secret,
  issuer,
  respondentToken,
  ignoreTemporaryParticipant = false,
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  secret: string
  issuer: string
  respondentToken?: string
  ignoreTemporaryParticipant?: boolean
}): Promise<LiveQuizResponseIdentity | null> {
  const cookies = parseCookiesHeader(cookieHeader)

  const participantToken = cookies[PARTICIPANT_COOKIE_NAME]
  const participantPayload = await verifyIdentityToken({
    token: participantToken,
    secret,
    issuer,
  })
  if (
    participantToken &&
    participantPayload?.role === UserRole.PARTICIPANT &&
    typeof participantPayload.sub === 'string'
  ) {
    return {
      kind: 'participant',
      id: participantPayload.sub,
      token: participantToken,
      cookieName: PARTICIPANT_COOKIE_NAME,
    }
  }

  if (!ignoreTemporaryParticipant) {
    const temporaryToken = cookies[TEMPORARY_PARTICIPANT_COOKIE_NAME]
    const temporaryPayload = await verifyIdentityToken({
      token: temporaryToken,
      secret,
      issuer,
    })
    const scopeQuizId = temporaryPayload?.scopeQuizId
    if (
      temporaryToken &&
      temporaryPayload?.role === UserRole.TEMPORARY_PARTICIPANT &&
      typeof temporaryPayload.sub === 'string' &&
      (scopeQuizId === undefined || scopeQuizId === liveQuizId)
    ) {
      return {
        kind: 'temporary',
        id: temporaryPayload.sub,
        liveQuizId,
        token: temporaryToken,
        cookieName: TEMPORARY_PARTICIPANT_COOKIE_NAME,
      }
    }
  }

  const respondentCookieName = getLiveQuizRespondentCookieName(liveQuizId)
  const respondentCookieToken = cookies[respondentCookieName]
  const respondentPayload = await verifyIdentityToken({
    token: respondentCookieToken,
    secret,
    issuer,
  })
  const publicationGeneration = respondentPayload?.publicationGeneration
  const cookieIdentity: Extract<
    LiveQuizResponseIdentity,
    { kind: 'anonymous' }
  > | null =
    respondentCookieToken !== undefined &&
    respondentPayload?.role === LIVE_QUIZ_RESPONDENT_ROLE &&
    respondentPayload.liveQuizId === liveQuizId &&
    typeof publicationGeneration === 'number' &&
    Number.isInteger(publicationGeneration) &&
    publicationGeneration >= 0 &&
    typeof respondentPayload.sub === 'string'
      ? {
          kind: 'anonymous',
          id: respondentPayload.sub,
          liveQuizId,
          publicationGeneration,
          token: respondentCookieToken,
          cookieName: respondentCookieName,
        }
      : null

  const explicitRespondentPayload = await verifyIdentityToken({
    token: respondentToken,
    secret,
    issuer,
  })
  const explicitPublicationGeneration =
    explicitRespondentPayload?.publicationGeneration
  if (
    respondentToken &&
    explicitRespondentPayload?.role === LIVE_QUIZ_RESPONDENT_ROLE &&
    explicitRespondentPayload.liveQuizId === liveQuizId &&
    typeof explicitPublicationGeneration === 'number' &&
    Number.isInteger(explicitPublicationGeneration) &&
    explicitPublicationGeneration >= 0 &&
    typeof explicitRespondentPayload.sub === 'string'
  ) {
    const explicitIdentity: LiveQuizResponseIdentity = {
      kind: 'anonymous',
      id: explicitRespondentPayload.sub,
      liveQuizId,
      publicationGeneration: explicitPublicationGeneration,
      token: respondentToken,
      cookieName: respondentCookieName,
    }

    if (cookieIdentity) {
      return cookieIdentity.publicationGeneration >=
        explicitPublicationGeneration
        ? cookieIdentity
        : explicitIdentity
    }

    return explicitIdentity
  }

  return cookieIdentity
}

export function hashLiveQuizRespondentToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export type AcceptedCorrelatedResponseIdentity = {
  kind: LiveQuizResponseIdentity['kind']
  id: string
}

export type LiveQuizResponseEventMessage = {
  messageId: string
  sessionId: string
  instanceId: string
  response: LiveQuizResponseInput
  cookie?: string
  responseTimestamp: number
}

export type CorrelatedResponseEventMessage = Omit<
  LiveQuizResponseEventMessage,
  'cookie'
> & {
  publicationGeneration: number
  acceptedIdentity: AcceptedCorrelatedResponseIdentity
  instanceInfo: CorrelatedResponseInstanceInfo
}

export type CorrelatedResponseDeliveryMessage = {
  messageId: string
}

export function buildCorrelatedResponseKey({
  liveQuizId,
  publicationGeneration,
  instanceId,
  blockExecution,
  identityKey,
}: {
  liveQuizId: string
  publicationGeneration: number
  instanceId: string
  blockExecution: string
  identityKey: LiveQuizResponseIdentityKey
}) {
  const identityHash = createHash('sha256').update(identityKey).digest('hex')
  return `lq:${liveQuizId}:g:${publicationGeneration}:i:${instanceId}:correlatedVotes:${blockExecution}:${identityHash}`
}

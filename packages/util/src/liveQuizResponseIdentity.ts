import { UserRole } from '@klicker-uzh/prisma/client'
import { createHash } from 'node:crypto'
import { parseCookiesHeader } from './auth.js'
import { signJWT, verifyJWT, type JWTPayload } from './jwt.js'

export const PARTICIPANT_COOKIE_NAME = 'participant_token'
export const TEMPORARY_PARTICIPANT_COOKIE_NAME = 'temporary_participant_token'
export const LIVE_QUIZ_RESPONDENT_COOKIE_PREFIX = 'live_quiz_respondent_token_'
export const LIVE_QUIZ_RESPONDENT_ROLE = 'LIVE_QUIZ_RESPONDENT'
export const LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS = 14 * 24 * 60 * 60

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
      token: string
      cookieName: string
    }

export async function createLiveQuizRespondentToken({
  respondentId,
  liveQuizId,
  secret,
  issuer,
}: {
  respondentId: string
  liveQuizId: string
  secret: string
  issuer: string
}) {
  return signJWT(
    {
      sub: respondentId,
      role: LIVE_QUIZ_RESPONDENT_ROLE,
      liveQuizId,
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
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  secret: string
  issuer: string
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

  const respondentCookieName = getLiveQuizRespondentCookieName(liveQuizId)
  const respondentToken = cookies[respondentCookieName]
  const respondentPayload = await verifyIdentityToken({
    token: respondentToken,
    secret,
    issuer,
  })
  if (
    respondentToken &&
    respondentPayload?.role === LIVE_QUIZ_RESPONDENT_ROLE &&
    respondentPayload.liveQuizId === liveQuizId &&
    typeof respondentPayload.sub === 'string'
  ) {
    return {
      kind: 'anonymous',
      id: respondentPayload.sub,
      liveQuizId,
      token: respondentToken,
      cookieName: respondentCookieName,
    }
  }

  return null
}

export function hashLiveQuizRespondentToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

interface CorrelatedResponseRedis {
  hsetnx(key: string, field: string, value: string): Promise<number>
  eval(
    script: string,
    numberOfKeys: number,
    ...args: string[]
  ): Promise<unknown>
}

const RELEASE_OWNED_CLAIM_SCRIPT = `
if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then
  return redis.call('HDEL', KEYS[1], ARGV[1])
end
return 0
`

export type CorrelatedResponseClaim = {
  key: string
  identityKey: string
}

export function buildCorrelatedVoteKey({
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  liveQuizId: string
  instanceId: string
  blockExecution: string
}) {
  return `lq:${liveQuizId}:i:${instanceId}:correlatedVotes:${blockExecution}`
}

export async function claimCorrelatedResponse({
  redis,
  key,
  identityKey,
  messageId,
}: {
  redis: CorrelatedResponseRedis
  key: string
  identityKey: string
  messageId: string
}) {
  return (await redis.hsetnx(key, identityKey, messageId)) === 1
}

export async function releaseCorrelatedResponse({
  redis,
  key,
  identityKey,
  messageId,
}: {
  redis: CorrelatedResponseRedis
  key: string
  identityKey: string
  messageId: string
}) {
  const released = await redis.eval(
    RELEASE_OWNED_CLAIM_SCRIPT,
    1,
    key,
    identityKey,
    messageId
  )
  return Number(released) === 1
}

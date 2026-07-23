import {
  LiveQuizResponseCollectionMode,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  CORRELATED_RESPONSE_WORKER_CAPABILITY_KEY,
  getLiveQuizRespondentCookieName,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  releaseCorrelatedResponse,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'

export {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  releaseCorrelatedResponse,
}

export function isAllowedCorsOrigin({
  origin,
  allowedOrigins,
}: {
  origin: string | undefined
  allowedOrigins: string[]
}) {
  return (
    origin === undefined ||
    (origin !== 'null' && allowedOrigins.includes(origin))
  )
}

export function hasJsonContentType(contentType: string | undefined) {
  return (
    contentType?.split(';', 1)[0]?.trim().toLowerCase() === 'application/json'
  )
}

export async function isCorrelatedResponseWorkerReady({
  redis,
}: {
  redis: { get(key: string): Promise<string | null> }
}) {
  return (await redis.get(CORRELATED_RESPONSE_WORKER_CAPABILITY_KEY)) !== null
}

export async function hasPersistedCorrelatedResponse({
  database,
  identity,
  instanceId,
  blockExecution,
}: {
  database: Pick<PrismaClient, 'liveQuizResponse'>
  identity: LiveQuizResponseIdentity
  instanceId: number
  blockExecution: number
}) {
  const response =
    identity.kind === 'participant'
      ? await database.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_participantId: {
              instanceId,
              elementBlockExecution: blockExecution,
              participantId: identity.id,
            },
          },
          select: { id: true },
        })
      : await database.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_respondentId: {
              instanceId,
              elementBlockExecution: blockExecution,
              respondentId: identity.id,
            },
          },
          select: { id: true },
        })

  return response !== null
}

export function serializeLiveQuizRespondentCookie({
  token,
  liveQuizId,
  domain,
  secure,
}: {
  token: string
  liveQuizId: string
  domain?: string
  secure: boolean
}) {
  const attributes = [
    `${getLiveQuizRespondentCookieName(liveQuizId)}=${token}`,
    `Max-Age=${LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS}`,
  ]
  if (domain) attributes.push(`Domain=${domain}`)
  attributes.push('Path=/', 'HttpOnly')
  if (secure) attributes.push('Secure')
  attributes.push('SameSite=Lax')

  return attributes.join('; ')
}

export function hasValidLiveQuizPin({
  cookieHeader,
  liveQuizId,
  pinCode,
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  pinCode: string | null
}) {
  if (!pinCode) return true

  const cookies = parseCookiesHeader(cookieHeader)
  return cookies[`live-quiz-pin-${liveQuizId}`] === pinCode
}

export async function resolveResponseCollectionMode({
  cachedMode,
  liveQuizId,
  lookupMode,
}: {
  cachedMode: string | undefined
  liveQuizId: string
  lookupMode: (
    liveQuizId: string
  ) => Promise<LiveQuizResponseCollectionMode | string | null>
}) {
  if (
    cachedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    cachedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return cachedMode
  }

  const storedMode = await lookupMode(liveQuizId)
  if (
    storedMode === LiveQuizResponseCollectionMode.AGGREGATED_ANONYMOUS ||
    storedMode === LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return storedMode
  }

  throw new Error(
    `Response collection mode for live quiz ${liveQuizId} is unavailable`
  )
}

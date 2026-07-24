import {
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  buildLiveQuizResponseIdentityKey,
  claimCorrelatedResponse,
  getLiveQuizRespondentCookieName,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  releaseCorrelatedResponse,
  type CorrelatedResponseClaim,
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

export function responseEndpointMatchesCollectionMode({
  endpointMode,
  responseCollectionMode,
}: {
  endpointMode: 'aggregate' | 'correlated'
  responseCollectionMode: LiveQuizResponseCollectionMode
}) {
  return (
    (endpointMode === 'correlated') ===
    (responseCollectionMode ===
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT)
  )
}

export async function getCorrelatedResponseAdmission({
  database,
  liveQuizId,
  cookieHeader,
}: {
  database: Pick<PrismaClient, 'liveQuiz'>
  liveQuizId: string
  cookieHeader: string | undefined
}) {
  const liveQuiz = await database.liveQuiz.findUnique({
    where: { id: liveQuizId },
    select: {
      isAssessmentEnabled: true,
      pinCode: true,
      responseCollectionMode: true,
      status: true,
    },
  })

  if (!liveQuiz || liveQuiz.status !== PublicationStatus.PUBLISHED) {
    return 'not_found' as const
  }
  if (
    liveQuiz.isAssessmentEnabled ||
    liveQuiz.responseCollectionMode !==
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  ) {
    return 'not_required' as const
  }
  if (
    !hasValidLiveQuizPin({
      cookieHeader,
      liveQuizId,
      pinCode: liveQuiz.pinCode,
    })
  ) {
    return 'pin_required' as const
  }
  return 'ready' as const
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

export async function prepareCorrelatedResponseSubmission({
  database,
  redis,
  identity,
  liveQuizId,
  instanceId,
  blockExecution,
  messageId,
}: {
  database: Pick<PrismaClient, 'liveQuizResponse'>
  redis: Parameters<typeof claimCorrelatedResponse>[0]['redis']
  identity: LiveQuizResponseIdentity
  liveQuizId: string
  instanceId: string
  blockExecution: string | undefined
  messageId: string
}): Promise<
  | { status: 'invalid_metadata' }
  | { status: 'duplicate' }
  | {
      status: 'ready'
      cookie: string
      claim: CorrelatedResponseClaim
    }
> {
  if (!blockExecution) {
    throw new Error(
      `Missing block execution in correlated response metadata for lq:${liveQuizId}:i:${instanceId}:info`
    )
  }

  const parsedInstanceId = Number(instanceId)
  const parsedBlockExecution = Number(blockExecution)
  if (
    !Number.isInteger(parsedInstanceId) ||
    !Number.isInteger(parsedBlockExecution)
  ) {
    return { status: 'invalid_metadata' }
  }

  if (
    await hasPersistedCorrelatedResponse({
      database,
      identity,
      instanceId: parsedInstanceId,
      blockExecution: parsedBlockExecution,
    })
  ) {
    return { status: 'duplicate' }
  }

  const identityKey = buildLiveQuizResponseIdentityKey(identity)
  const claim = {
    key: buildCorrelatedVoteKey({
      liveQuizId,
      instanceId,
      blockExecution,
      identityKey,
    }),
    identityKey,
  }
  if (
    !(await claimCorrelatedResponse({
      redis,
      ...claim,
      messageId,
    }))
  ) {
    return { status: 'duplicate' }
  }

  return {
    status: 'ready',
    cookie: `${identity.cookieName}=${identity.token}`,
    claim,
  }
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

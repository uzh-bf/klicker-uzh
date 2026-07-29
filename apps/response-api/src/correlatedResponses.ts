import {
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  buildLiveQuizResponseIdentityKey,
  CORRELATED_RESPONSE_EVENT,
  getLiveQuizRespondentCookieName,
  hashLiveQuizRespondentToken,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  type AcceptedCorrelatedResponseIdentity,
  type CorrelatedResponseClaim,
  type CorrelatedResponseDeliveryMessage,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'

export {
  decryptCorrelatedResponseEvent,
  encryptCorrelatedResponseEvent,
} from '@klicker-uzh/util'
export { buildCorrelatedVoteKey }

const CORRELATED_OUTBOX_RETRY_MS = 30_000
const CORRELATED_OUTBOX_BATCH_SIZE = 50

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

export async function registerPendingCorrelatedResponse({
  database,
  liveQuizId,
  messageId,
  responseKey,
  eventPayload,
  nextDeliveryAt = new Date(Date.now() + CORRELATED_OUTBOX_RETRY_MS),
}: {
  database: Pick<PrismaClient, '$transaction'>
  liveQuizId: string
  messageId: string
  responseKey: string
  eventPayload: string
  nextDeliveryAt?: Date
}) {
  try {
    return await database.$transaction(async (prisma) => {
      const [liveQuiz] = await prisma.$queryRaw<
        {
          isAssessmentEnabled: boolean
          responseCollectionMode: LiveQuizResponseCollectionMode
          status: PublicationStatus
        }[]
      >`
        SELECT
          "isAssessmentEnabled",
          "responseCollectionMode"::text AS "responseCollectionMode",
          "status"::text AS "status"
        FROM "public"."LiveQuiz"
        WHERE "id" = ${liveQuizId}::uuid AND "isDeleted" = false
        FOR UPDATE
      `

      if (
        !liveQuiz ||
        liveQuiz.status !== PublicationStatus.PUBLISHED ||
        liveQuiz.isAssessmentEnabled ||
        liveQuiz.responseCollectionMode !==
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT
      ) {
        return 'not_found' as const
      }

      await prisma.liveQuizPendingResponse.create({
        data: {
          id: messageId,
          liveQuizId,
          responseKey,
          eventPayload,
          nextDeliveryAt,
        },
      })
      return 'registered' as const
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return 'duplicate' as const
    }
    throw error
  }
}

export async function reservePendingCorrelatedResponses({
  database,
  now = new Date(),
  nextDeliveryAt = new Date(now.getTime() + CORRELATED_OUTBOX_RETRY_MS),
  batchSize = CORRELATED_OUTBOX_BATCH_SIZE,
}: {
  database: Pick<PrismaClient, '$queryRaw'>
  now?: Date
  nextDeliveryAt?: Date
  batchSize?: number
}) {
  return database.$queryRaw<{ id: string }[]>`
    WITH due AS (
      SELECT "id"
      FROM "public"."LiveQuizPendingResponse"
      WHERE "nextDeliveryAt" <= ${now}
      ORDER BY "nextDeliveryAt" ASC, "createdAt" ASC
      LIMIT ${batchSize}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "public"."LiveQuizPendingResponse" AS pending
    SET
      "nextDeliveryAt" = ${nextDeliveryAt},
      "deliveryAttempts" = pending."deliveryAttempts" + 1
    FROM due
    WHERE pending."id" = due."id"
    RETURNING pending."id"
  `
}

export async function dispatchPendingCorrelatedResponses({
  database,
  pushEvent,
  now,
}: {
  database: Pick<PrismaClient, '$queryRaw'>
  pushEvent: (
    eventName: string,
    message: CorrelatedResponseDeliveryMessage
  ) => Promise<unknown>
  now?: Date
}) {
  const pendingResponses = await reservePendingCorrelatedResponses({
    database,
    now,
  })
  const results = await Promise.allSettled(
    pendingResponses.map(({ id }) =>
      pushEvent(CORRELATED_RESPONSE_EVENT, { messageId: id })
    )
  )

  return {
    attempted: results.length,
    failed: results.filter((result) => result.status === 'rejected').length,
  }
}

export async function hasPersistedCorrelatedResponse({
  database,
  identity,
  instanceId,
  blockExecution,
}: {
  database: Pick<PrismaClient, 'liveQuizResponse'>
  identity: Pick<AcceptedCorrelatedResponseIdentity, 'kind' | 'id'>
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
  identity,
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  database: Pick<
    PrismaClient,
    | 'liveQuizResponse'
    | 'temporaryLeaderboardEntry'
    | 'liveQuizRespondent'
    | 'participant'
  >
  identity: LiveQuizResponseIdentity
  liveQuizId: string
  instanceId: string
  blockExecution: string | undefined
}): Promise<
  | { status: 'invalid_identity' }
  | { status: 'invalid_metadata' }
  | { status: 'duplicate' }
  | {
      status: 'ready'
      acceptedIdentity: AcceptedCorrelatedResponseIdentity
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

  if (identity.kind === 'participant') {
    const participant = await database.participant.findUnique({
      where: { id: identity.id },
      select: { id: true },
    })
    if (!participant) {
      return { status: 'invalid_identity' }
    }
  } else if (identity.kind === 'temporary') {
    const temporaryEntry = await database.temporaryLeaderboardEntry.findUnique({
      where: {
        id_quizId: {
          id: identity.id,
          quizId: liveQuizId,
        },
      },
      select: { id: true },
    })
    if (!temporaryEntry) {
      return { status: 'invalid_identity' }
    }

    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.TEMPORARY_PSEUDONYM
    ) {
      return { status: 'invalid_identity' }
    }
  } else {
    const verificationSecretHash = hashLiveQuizRespondentToken(identity.token)
    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
        verificationSecretHash,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.ANONYMOUS_CORRELATED ||
      respondent.verificationSecretHash !== verificationSecretHash
    ) {
      return { status: 'invalid_identity' }
    }
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

  return {
    status: 'ready',
    acceptedIdentity: {
      kind: identity.kind,
      id: identity.id,
      identityKey,
    },
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

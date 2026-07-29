import {
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  type PrismaClient,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  buildLiveQuizResponseIdentityKey,
  claimCorrelatedResponse,
  CORRELATED_RESPONSE_EVENT,
  getLiveQuizRespondentCookieName,
  LIVE_QUIZ_RESPONDENT_TOKEN_MAX_AGE_SECONDS,
  parseCookiesHeader,
  releaseCorrelatedResponse,
  type CorrelatedResponseClaim,
  type LiveQuizResponseIdentity,
} from '@klicker-uzh/util'
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto'

export {
  buildCorrelatedVoteKey,
  claimCorrelatedResponse,
  releaseCorrelatedResponse,
}

const CORRELATED_OUTBOX_RETRY_MS = 30_000
const CORRELATED_OUTBOX_BATCH_SIZE = 50
const CORRELATED_OUTBOX_ENCRYPTION_CONTEXT =
  'klicker-live-quiz-correlated-outbox-v1'

export type CorrelatedResponseEventMessage = {
  messageId: string
  sessionId: string
  instanceId: string
  response: unknown
  cookie?: string
  responseTimestamp: number
  correlatedClaim: CorrelatedResponseClaim
}

function getOutboxEncryptionKey(secret: string) {
  return createHash('sha256')
    .update(CORRELATED_OUTBOX_ENCRYPTION_CONTEXT)
    .update('\0')
    .update(secret)
    .digest()
}

export function encryptCorrelatedResponseEvent({
  message,
  secret,
}: {
  message: CorrelatedResponseEventMessage
  secret: string
}) {
  const iv = randomBytes(12)
  const cipher = createCipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    iv
  )
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(message), 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return `v1.${iv.toString('base64url')}.${tag.toString('base64url')}.${encrypted.toString('base64url')}`
}

export function decryptCorrelatedResponseEvent({
  encryptedPayload,
  secret,
}: {
  encryptedPayload: string
  secret: string
}): CorrelatedResponseEventMessage {
  const [version, encodedIv, encodedTag, encodedPayload, ...rest] =
    encryptedPayload.split('.')
  if (
    version !== 'v1' ||
    !encodedIv ||
    !encodedTag ||
    !encodedPayload ||
    rest.length > 0
  ) {
    throw new Error('Invalid correlated response outbox payload')
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    getOutboxEncryptionKey(secret),
    Buffer.from(encodedIv, 'base64url')
  )
  decipher.setAuthTag(Buffer.from(encodedTag, 'base64url'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encodedPayload, 'base64url')),
    decipher.final(),
  ])
  const message: unknown = JSON.parse(decrypted.toString('utf8'))
  if (
    typeof message !== 'object' ||
    message === null ||
    !('messageId' in message) ||
    typeof message.messageId !== 'string' ||
    !('sessionId' in message) ||
    typeof message.sessionId !== 'string' ||
    !('instanceId' in message) ||
    typeof message.instanceId !== 'string' ||
    !('responseTimestamp' in message) ||
    typeof message.responseTimestamp !== 'number' ||
    !('correlatedClaim' in message) ||
    typeof message.correlatedClaim !== 'object' ||
    message.correlatedClaim === null ||
    !('key' in message.correlatedClaim) ||
    typeof message.correlatedClaim.key !== 'string' ||
    !('identityKey' in message.correlatedClaim) ||
    typeof message.correlatedClaim.identityKey !== 'string'
  ) {
    throw new Error('Invalid correlated response outbox message')
  }
  return message as CorrelatedResponseEventMessage
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

export async function registerPendingCorrelatedResponse({
  database,
  liveQuizId,
  messageId,
  eventPayload,
  nextDeliveryAt = new Date(Date.now() + CORRELATED_OUTBOX_RETRY_MS),
}: {
  database: Pick<PrismaClient, '$transaction'>
  liveQuizId: string
  messageId: string
  eventPayload: string
  nextDeliveryAt?: Date
}) {
  return database.$transaction(async (prisma) => {
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
      return false
    }

    await prisma.liveQuizPendingResponse.create({
      data: { id: messageId, liveQuizId, eventPayload, nextDeliveryAt },
    })
    return true
  })
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
  return database.$queryRaw<{ id: string; eventPayload: string }[]>`
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
    RETURNING pending."id", pending."eventPayload"
  `
}

export async function dispatchPendingCorrelatedResponses({
  database,
  pushEvent,
  secret,
  now,
}: {
  database: Pick<PrismaClient, '$queryRaw'>
  pushEvent: (
    eventName: string,
    message: CorrelatedResponseEventMessage
  ) => Promise<unknown>
  secret: string
  now?: Date
}) {
  const pendingResponses = await reservePendingCorrelatedResponses({
    database,
    now,
  })
  const results = await Promise.allSettled(
    pendingResponses.map(async ({ id, eventPayload }) => {
      const message = decryptCorrelatedResponseEvent({
        encryptedPayload: eventPayload,
        secret,
      })
      if (message.messageId !== id) {
        throw new Error(
          `Correlated response outbox message id mismatch for ${id}`
        )
      }
      await pushEvent(CORRELATED_RESPONSE_EVENT, message)
    })
  )

  return {
    attempted: results.length,
    failed: results.filter((result) => result.status === 'rejected').length,
  }
}

export async function removePendingCorrelatedResponse({
  database,
  messageId,
}: {
  database: Pick<PrismaClient, 'liveQuizPendingResponse'>
  messageId: string
}) {
  await database.liveQuizPendingResponse.deleteMany({
    where: { id: messageId },
  })
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

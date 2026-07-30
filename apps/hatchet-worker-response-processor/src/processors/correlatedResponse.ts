import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  LiveQuizRespondentType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  buildCorrelatedResponseKey,
  buildLiveQuizResponseIdentityKey,
  decryptCorrelatedResponseEvent,
  type AcceptedCorrelatedResponseIdentity,
  type CorrelatedResponseEventMessage,
  type LiveQuizResponseEventMessage,
  type LiveQuizResponseIdentityKey,
} from '@klicker-uzh/util'
import type { RedisHashMutation } from './responseEffects.js'

type CorrelatedResponseDatabase = Pick<
  PrismaClient,
  '$transaction' | 'liveQuizRespondent' | 'liveQuizResponse' | 'participant'
>

export function resolveCorrelatedResponseInstanceInfo(
  acceptedInstanceInfo: Record<string, string> | undefined
) {
  return acceptedInstanceInfo
}

interface CorrelatedProcessingRedis {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: (number | string)[]
  ): Promise<unknown>
  hget(key: string, field: string): Promise<string | null>
  set(
    key: string,
    value: string,
    expiryMode: 'PX',
    time: number,
    setMode: 'NX'
  ): Promise<'OK' | null>
}

export type CorrelatedResponseOwner = AcceptedCorrelatedResponseIdentity & {
  identityKey: LiveQuizResponseIdentityKey
}

export type CorrelatedProcessingState = {
  owner: CorrelatedResponseOwner
  processedKey: string
  processingLockKey: string
  instanceId: number
  blockExecution: number
}

export class CorrelatedResponseIdentityError extends Error {}
export class CorrelatedResponseProcessingBusyError extends Error {}

export async function resolveCorrelatedResponseDelivery({
  database,
  messageId,
  secret,
}: {
  database: Pick<PrismaClient, 'liveQuizPendingResponse'>
  messageId: string
  secret: string
}): Promise<{
  message: CorrelatedResponseEventMessage
  responseKey: string
} | null> {
  const pendingResponse = await database.liveQuizPendingResponse.findUnique({
    where: { id: messageId },
    select: { eventPayload: true, responseKey: true, settledAt: true },
  })
  if (
    !pendingResponse ||
    pendingResponse.settledAt !== null ||
    pendingResponse.eventPayload === null
  ) {
    return null
  }

  const message = decryptCorrelatedResponseEvent({
    encryptedPayload: pendingResponse.eventPayload,
    secret,
  })
  if (message.messageId !== messageId) {
    throw new Error(
      `Correlated response outbox message id mismatch for ${messageId}`
    )
  }
  return { message, responseKey: pendingResponse.responseKey }
}

export async function settleCorrelatedResponseOutbox({
  database,
  messageId,
}: {
  database: Pick<PrismaClient, 'liveQuizPendingResponse'>
  messageId: string
}) {
  await database.liveQuizPendingResponse.updateMany({
    where: { id: messageId, settledAt: null },
    data: {
      eventPayload: null,
      nextDeliveryAt: null,
      settledAt: new Date(),
    },
  })
}

const CORRELATED_PROCESSING_LOCK_TTL_MS = 5 * 60 * 1000
const RELEASE_PROCESSING_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`
const APPLY_CORRELATED_MUTATIONS_SCRIPT = `
local markerType = redis.call('TYPE', KEYS[1])
if type(markerType) == 'table' then
  markerType = markerType['ok']
end
if markerType ~= 'none' and markerType ~= 'hash' then
  return redis.error_reply(
    'Expected Redis hash at ' .. KEYS[1] .. ', found ' .. markerType
  )
end

local existingMarker = redis.call('HGET', KEYS[1], ARGV[2])
if existingMarker then
  if existingMarker == ARGV[3] then
    return 2
  end
  return 3
end

local infoType = redis.call('TYPE', KEYS[2])
if type(infoType) == 'table' then
  infoType = infoType['ok']
end
if infoType ~= 'hash' then
  return redis.error_reply(
    'Expected current instance info hash at ' .. KEYS[2] .. ', found ' .. infoType
  )
end

local currentBlockExecution = redis.call('HGET', KEYS[2], 'blockExecution')
if currentBlockExecution ~= ARGV[4] then
  return redis.error_reply(
    'Correlated response belongs to stale block execution'
  )
end

local mutations = cjson.decode(ARGV[1])
local checkedKeys = {}
for _, mutation in ipairs(mutations) do
  if mutation.command ~= 'hincrby' and
    mutation.command ~= 'hset' and
    mutation.command ~= 'hsetnx' then
    return redis.error_reply('Unsupported correlated Redis mutation')
  end

  if not checkedKeys[mutation.key] then
    local keyType = redis.call('TYPE', mutation.key)
    if type(keyType) == 'table' then
      keyType = keyType['ok']
    end
    if keyType ~= 'none' and keyType ~= 'hash' then
      return redis.error_reply(
        'Expected Redis hash at ' .. mutation.key .. ', found ' .. keyType
      )
    end
    checkedKeys[mutation.key] = true
  end

  if mutation.command == 'hincrby' then
    local current = redis.call('HGET', mutation.key, mutation.field)
    if current and not string.match(current, '^-?%d+$') then
      return redis.error_reply(
        'Expected integer hash value at ' .. mutation.key .. ':' .. mutation.field
      )
    end

    local currentNumber = tonumber(current or '0')
    local incrementNumber = tonumber(mutation.value)
    if not currentNumber or not incrementNumber or
      math.abs(currentNumber) > 9007199254740991 or
      math.abs(incrementNumber) > 9007199254740991 or
      math.abs(currentNumber + incrementNumber) > 9007199254740991 then
      return redis.error_reply(
        'Unsafe integer increment at ' .. mutation.key .. ':' .. mutation.field
      )
    end
  end
end

for _, mutation in ipairs(mutations) do
  if mutation.command == 'hincrby' then
    redis.call(
      'HINCRBY',
      mutation.key,
      mutation.field,
      mutation.value
    )
  elseif mutation.command == 'hset' then
    redis.call('HSET', mutation.key, mutation.field, mutation.value)
  elseif mutation.command == 'hsetnx' then
    redis.call('HSETNX', mutation.key, mutation.field, mutation.value)
  end
end

redis.call('HSET', KEYS[1], ARGV[2], ARGV[3])
return 1
`

export async function applyCorrelatedRedisMutations({
  redis,
  mutations,
  processedKey,
  instanceInfoKey,
  blockExecution,
  identityKey,
  messageId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval'>
  mutations: RedisHashMutation[]
  processedKey: string
  instanceInfoKey: string
  blockExecution: number
  identityKey: LiveQuizResponseIdentityKey
  messageId: string
}) {
  const result = Number(
    await redis.eval(
      APPLY_CORRELATED_MUTATIONS_SCRIPT,
      2,
      processedKey,
      instanceInfoKey,
      JSON.stringify(mutations),
      identityKey,
      messageId,
      String(blockExecution)
    )
  )

  if (result === 1) return 'applied' as const
  if (result === 2) return 'processed' as const
  if (result === 3) return 'duplicate' as const
  throw new Error(`Unexpected correlated Redis mutation result: ${result}`)
}

export async function resolveCorrelatedResponseOwner({
  acceptedIdentity,
  liveQuizId,
  database,
}: {
  acceptedIdentity: AcceptedCorrelatedResponseIdentity
  liveQuizId: string
  database: CorrelatedResponseDatabase
}): Promise<CorrelatedResponseOwner> {
  const identityKey = buildLiveQuizResponseIdentityKey(acceptedIdentity)

  if (acceptedIdentity.kind === 'participant') {
    const participant = await database.participant.findUnique({
      where: { id: acceptedIdentity.id },
      select: { id: true },
    })
    if (!participant) {
      throw new CorrelatedResponseIdentityError(
        'Correlated response participant no longer exists'
      )
    }

    return { ...acceptedIdentity, identityKey }
  }

  const respondent = await database.liveQuizRespondent.findUnique({
    where: { id: acceptedIdentity.id },
  })
  const expectedType =
    acceptedIdentity.kind === 'temporary'
      ? LiveQuizRespondentType.TEMPORARY_PSEUDONYM
      : LiveQuizRespondentType.ANONYMOUS_CORRELATED
  if (
    !respondent ||
    respondent.liveQuizId !== liveQuizId ||
    respondent.type !== expectedType
  ) {
    throw new CorrelatedResponseIdentityError(
      'Accepted correlated response identity has invalid scope'
    )
  }

  return { ...acceptedIdentity, identityKey }
}

export function buildCorrelatedResponseCreateData({
  owner,
  instanceId,
  blockExecution,
  response,
  submittedAt,
  correctnessPercentage,
  basePoints,
  correctnessPoints,
  bonusPoints,
}: {
  owner: CorrelatedResponseOwner
  instanceId: number
  blockExecution: number
  response: LiveQuizResponseInput
  submittedAt: number
  correctnessPercentage: number | null
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}): Prisma.LiveQuizResponseCreateInput {
  return {
    submittedAt: new Date(submittedAt),
    response,
    timeSpent: -1,
    correctness:
      correctnessPercentage === null || correctnessPercentage === 1
        ? ResponseCorrectness.CORRECT
        : correctnessPercentage === 0
          ? ResponseCorrectness.WRONG
          : ResponseCorrectness.PARTIAL,
    basePoints: Number.isNaN(basePoints) ? 0 : basePoints,
    correctnessPoints: Number.isNaN(correctnessPoints) ? 0 : correctnessPoints,
    bonusPoints: Number.isNaN(bonusPoints) ? 0 : bonusPoints,
    elementBlockExecution: blockExecution,
    instance: { connect: { id: instanceId } },
    ...(owner.kind === 'participant'
      ? { participant: { connect: { id: owner.id } } }
      : { respondent: { connect: { id: owner.id } } }),
  }
}

export async function persistCorrelatedResponseForPublishedQuiz({
  database,
  liveQuizId,
  owner,
  instanceId,
  blockExecution,
  response,
  submittedAt,
  correctnessPercentage,
  basePoints,
  correctnessPoints,
  bonusPoints,
}: {
  database: Pick<CorrelatedResponseDatabase, '$transaction'>
  liveQuizId: string
  owner: CorrelatedResponseOwner
  instanceId: number
  blockExecution: number
  response: LiveQuizResponseInput
  submittedAt: number
  correctnessPercentage: number | null
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}) {
  try {
    return await database.$transaction(async (prisma) => {
      const [liveQuiz] = await prisma.$queryRaw<
        {
          blockExecution: number
          isAssessmentEnabled: boolean
          responseCollectionMode: LiveQuizResponseCollectionMode
          status: PublicationStatus
        }[]
      >`
        SELECT
          block."execution" AS "blockExecution",
          "LiveQuiz"."isAssessmentEnabled",
          "LiveQuiz"."responseCollectionMode"::text AS "responseCollectionMode",
          "LiveQuiz"."status"::text AS "status"
        FROM "public"."LiveQuiz"
        JOIN "public"."ElementBlock" AS block
          ON block."liveQuizId" = "LiveQuiz"."id"
        JOIN "public"."ElementInstance" AS instance
          ON instance."elementBlockId" = block."id"
        WHERE
          "LiveQuiz"."id" = ${liveQuizId}::uuid AND
          "LiveQuiz"."isDeleted" = false AND
          instance."id" = ${instanceId}
        FOR UPDATE OF "LiveQuiz"
      `

      if (
        !liveQuiz ||
        liveQuiz.blockExecution !== blockExecution ||
        liveQuiz.status !== PublicationStatus.PUBLISHED ||
        liveQuiz.isAssessmentEnabled ||
        liveQuiz.responseCollectionMode !==
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT
      ) {
        return 'inactive' as const
      }

      const existingResponse =
        owner.kind === 'participant'
          ? await prisma.liveQuizResponse.findUnique({
              where: {
                instanceId_elementBlockExecution_participantId: {
                  instanceId,
                  elementBlockExecution: blockExecution,
                  participantId: owner.id,
                },
              },
              select: { submittedAt: true },
            })
          : await prisma.liveQuizResponse.findUnique({
              where: {
                instanceId_elementBlockExecution_respondentId: {
                  instanceId,
                  elementBlockExecution: blockExecution,
                  respondentId: owner.id,
                },
              },
              select: { submittedAt: true },
            })

      if (existingResponse) {
        return isPersistedResponseRetry({
          existingSubmittedAt: existingResponse.submittedAt,
          responseTimestamp: submittedAt,
        })
          ? ('persisted' as const)
          : ('duplicate' as const)
      }

      await prisma.liveQuizResponse.create({
        data: buildCorrelatedResponseCreateData({
          owner,
          instanceId,
          blockExecution,
          response,
          submittedAt,
          correctnessPercentage,
          basePoints,
          correctnessPoints,
          bonusPoints,
        }),
      })
      return 'created' as const
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

export function getCorrelatedProcessedKey({
  liveQuizId,
  instanceId,
  blockExecution,
}: {
  liveQuizId: string
  instanceId: string
  blockExecution: number
}) {
  return `lq:${liveQuizId}:i:${instanceId}:correlatedProcessed:${blockExecution}`
}

export function getCorrelatedProcessingLockKey({
  processedKey,
  identityKey,
}: {
  processedKey: string
  identityKey: string
}) {
  return `${processedKey}:processing:${identityKey}`
}

export async function releaseCorrelatedProcessingLock({
  redis,
  lockKey,
  messageId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval'>
  lockKey: string
  messageId: string
}) {
  const released = await redis.eval(
    RELEASE_PROCESSING_LOCK_SCRIPT,
    1,
    lockKey,
    messageId
  )
  return Number(released) === 1
}

export async function prepareCorrelatedResponseProcessing({
  redis,
  processedKey,
  owner,
  messageId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval' | 'hget' | 'set'>
  processedKey: string
  owner: CorrelatedResponseOwner
  messageId: string
}): Promise<
  | { status: 'duplicate' }
  | { status: 'processed' }
  | { status: 'process'; lockKey: string }
> {
  const processedMessageId = await redis.hget(processedKey, owner.identityKey)
  if (processedMessageId === messageId) return { status: 'processed' }
  if (processedMessageId) return { status: 'duplicate' }

  const lockKey = getCorrelatedProcessingLockKey({
    processedKey,
    identityKey: owner.identityKey,
  })
  const lockAcquired =
    (await redis.set(
      lockKey,
      messageId,
      'PX',
      CORRELATED_PROCESSING_LOCK_TTL_MS,
      'NX'
    )) === 'OK'
  if (!lockAcquired) {
    throw new CorrelatedResponseProcessingBusyError(
      'Correlated response is already being processed'
    )
  }

  const processedAfterLock = await redis.hget(processedKey, owner.identityKey)
  if (processedAfterLock) {
    await releaseCorrelatedProcessingLock({ redis, lockKey, messageId })
    return {
      status: processedAfterLock === messageId ? 'processed' : 'duplicate',
    }
  }

  return { status: 'process', lockKey }
}

export async function prepareCorrelatedMessageProcessing({
  redis,
  database,
  message,
  blockExecution,
  sessionBlockId,
  responseKey,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval' | 'hget' | 'set'>
  database: CorrelatedResponseDatabase
  message: Pick<
    LiveQuizResponseEventMessage,
    'messageId' | 'sessionId' | 'instanceId' | 'responseTimestamp'
  > & {
    acceptedIdentity?: AcceptedCorrelatedResponseIdentity
  }
  blockExecution: string | undefined
  sessionBlockId: string | undefined
  responseKey: string
}): Promise<
  | { status: 'invalid' }
  | { status: 'processed' }
  | { status: 'duplicate' }
  | { status: 'process'; state: CorrelatedProcessingState }
> {
  if (!message.acceptedIdentity || !blockExecution || !sessionBlockId) {
    return { status: 'invalid' }
  }

  const instanceId = Number(message.instanceId)
  const execution = Number(blockExecution)
  if (!Number.isInteger(instanceId) || !Number.isInteger(execution)) {
    return { status: 'invalid' }
  }

  const owner = await resolveCorrelatedResponseOwner({
    acceptedIdentity: message.acceptedIdentity,
    liveQuizId: message.sessionId,
    database,
  })
  const expectedResponseKey = buildCorrelatedResponseKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    blockExecution,
    identityKey: owner.identityKey,
  })
  if (responseKey !== expectedResponseKey) {
    return { status: 'invalid' }
  }

  const processedKey = getCorrelatedProcessedKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    blockExecution: execution,
  })
  const processing = await prepareCorrelatedResponseProcessing({
    redis,
    processedKey,
    owner,
    messageId: message.messageId,
  })
  if (processing.status !== 'process') {
    return processing
  }

  return {
    status: 'process',
    state: {
      owner,
      processedKey,
      processingLockKey: processing.lockKey,
      instanceId,
      blockExecution: execution,
    },
  }
}

export function isPersistedResponseRetry({
  existingSubmittedAt,
  responseTimestamp,
}: {
  existingSubmittedAt: Date
  responseTimestamp: number
}) {
  return existingSubmittedAt.getTime() === responseTimestamp
}

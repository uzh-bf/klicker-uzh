import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  LiveQuizRespondentType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  buildCorrelatedVoteKey,
  buildLiveQuizResponseIdentityKey,
  decryptCorrelatedResponseEvent,
  type AcceptedCorrelatedResponseIdentity,
  type CorrelatedResponseClaim,
  type CorrelatedResponseEventMessage,
  type LiveQuizResponseEventMessage,
  type LiveQuizResponseIdentityKey,
} from '@klicker-uzh/util'
import type { RedisHashMutation } from './responseEffects.js'

type CorrelatedResponseDatabase = Pick<
  PrismaClient,
  'liveQuizRespondent' | 'liveQuizResponse' | 'participant'
>

export function resolveAggregateResponseInstanceInfo(
  cachedInstanceInfo: Record<string, string>
) {
  return Object.keys(cachedInstanceInfo).length > 0
    ? cachedInstanceInfo
    : undefined
}

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
  type(key: string): Promise<string>
}

export type CorrelatedResponseOwner = AcceptedCorrelatedResponseIdentity

export type CorrelatedProcessingState = {
  owner: CorrelatedResponseOwner
  processedKey: string
  processingLockKey: string
  instanceId: number
  blockExecution: number
  responsePersisted: boolean
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
}): Promise<CorrelatedResponseEventMessage | null> {
  const pendingResponse = await database.liveQuizPendingResponse.findUnique({
    where: { id: messageId },
    select: { eventPayload: true, settledAt: true },
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
  return message
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
  identityKey,
  messageId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval'>
  mutations: RedisHashMutation[]
  processedKey: string
  identityKey: LiveQuizResponseIdentityKey
  messageId: string
}) {
  const result = Number(
    await redis.eval(
      APPLY_CORRELATED_MUTATIONS_SCRIPT,
      1,
      processedKey,
      JSON.stringify(mutations),
      identityKey,
      messageId
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
  const expectedIdentityKey = buildLiveQuizResponseIdentityKey(acceptedIdentity)
  if (acceptedIdentity.identityKey !== expectedIdentityKey) {
    throw new CorrelatedResponseIdentityError(
      'Accepted correlated response identity key is invalid'
    )
  }

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

    return acceptedIdentity
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

  return acceptedIdentity
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

export async function validateCorrelatedRedisHashKeys({
  redis,
  keys,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'type'>
  keys: string[]
}) {
  const uniqueKeys = [...new Set(keys)]
  const keyTypes = await Promise.all(
    uniqueKeys.map(async (key) => ({ key, type: await redis.type(key) }))
  )
  const invalidKey = keyTypes.find(
    ({ type }) => type !== 'none' && type !== 'hash'
  )
  if (invalidKey) {
    throw new Error(
      `Expected Redis hash at ${invalidKey.key}, found ${invalidKey.type}`
    )
  }
}

export async function prepareCorrelatedResponseProcessing({
  redis,
  database,
  processedKey,
  owner,
  instanceId,
  blockExecution,
  responseTimestamp,
  claimOwnerMessageId,
  messageId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval' | 'hget' | 'set'>
  database: Pick<CorrelatedResponseDatabase, 'liveQuizResponse'>
  processedKey: string
  owner: CorrelatedResponseOwner
  instanceId: number
  blockExecution: number
  responseTimestamp: number
  claimOwnerMessageId: string
  messageId: string
}): Promise<
  | { status: 'duplicate' }
  | { status: 'processed' }
  | { status: 'process'; lockKey: string; responsePersisted: boolean }
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

  const existingResponse =
    owner.kind === 'participant'
      ? await database.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_participantId: {
              instanceId,
              elementBlockExecution: blockExecution,
              participantId: owner.id,
            },
          },
        })
      : await database.liveQuizResponse.findUnique({
          where: {
            instanceId_elementBlockExecution_respondentId: {
              instanceId,
              elementBlockExecution: blockExecution,
              respondentId: owner.id,
            },
          },
        })

  if (
    existingResponse &&
    !isPersistedResponseRetry({
      existingSubmittedAt: existingResponse.submittedAt,
      responseTimestamp,
      claimOwnerMessageId,
      messageId,
    })
  ) {
    await releaseCorrelatedProcessingLock({ redis, lockKey, messageId })
    return { status: 'duplicate' }
  }

  return {
    status: 'process',
    lockKey,
    responsePersisted: Boolean(existingResponse),
  }
}

export async function prepareCorrelatedMessageProcessing({
  redis,
  database,
  message,
  blockExecution,
  sessionBlockId,
}: {
  redis: Pick<CorrelatedProcessingRedis, 'eval' | 'hget' | 'set'>
  database: CorrelatedResponseDatabase
  message: Pick<
    LiveQuizResponseEventMessage,
    'messageId' | 'sessionId' | 'instanceId' | 'responseTimestamp'
  > & {
    acceptedIdentity?: AcceptedCorrelatedResponseIdentity
    correlatedClaim?: CorrelatedResponseClaim
  }
  blockExecution: string | undefined
  sessionBlockId: string | undefined
}): Promise<
  | { status: 'invalid' }
  | { status: 'processed' }
  | { status: 'duplicate' }
  | { status: 'process'; state: CorrelatedProcessingState }
> {
  if (
    !message.acceptedIdentity ||
    !message.correlatedClaim ||
    !blockExecution ||
    !sessionBlockId
  ) {
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
  const expectedClaimKey = buildCorrelatedVoteKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    blockExecution,
    identityKey: owner.identityKey,
  })
  if (
    message.correlatedClaim.key !== expectedClaimKey ||
    message.correlatedClaim.identityKey !== owner.identityKey
  ) {
    return { status: 'invalid' }
  }

  const processedKey = getCorrelatedProcessedKey({
    liveQuizId: message.sessionId,
    instanceId: message.instanceId,
    blockExecution: execution,
  })
  const processing = await prepareCorrelatedResponseProcessing({
    redis,
    database,
    processedKey,
    owner,
    instanceId,
    blockExecution: execution,
    responseTimestamp: message.responseTimestamp,
    claimOwnerMessageId: message.messageId,
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
      responsePersisted: processing.responsePersisted,
    },
  }
}

export function isPersistedResponseRetry({
  existingSubmittedAt,
  responseTimestamp,
  claimOwnerMessageId,
  messageId,
}: {
  existingSubmittedAt: Date
  responseTimestamp: number
  claimOwnerMessageId: string | null
  messageId: string
}) {
  return (
    existingSubmittedAt.getTime() === responseTimestamp &&
    claimOwnerMessageId === messageId
  )
}

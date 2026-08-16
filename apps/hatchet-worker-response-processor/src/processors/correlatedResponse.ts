import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  ElementBlockStatus,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  type AcceptedCorrelatedResponseIdentity,
  buildCorrelatedResponseKey,
  type CorrelatedResponseEventMessage,
  decryptCorrelatedResponseEvent,
  type LiveQuizResponseIdentityKey,
} from '@klicker-uzh/util'
import type { RedisHashMutation } from './responseEffects.js'

type CorrelatedResponseDatabase = Pick<
  PrismaClient,
  '$transaction' | 'liveQuizRespondent' | 'liveQuizResponse'
>

interface CorrelatedProcessingRedis {
  eval(
    script: string,
    numberOfKeys: number,
    ...args: (number | string)[]
  ): Promise<unknown>
}

type CorrelatedLiveQuizState = {
  activeBlockId: number | null
  blockId: number
  blockExecution: number
  blockStatus: ElementBlockStatus
  isAssessmentEnabled: boolean
  publicationGeneration: number
  responseCollectionMode: LiveQuizResponseCollectionMode
  status: PublicationStatus
}

export type CorrelatedResponseOwner = {
  kind: 'anonymous'
  id: string
  identityKey: Extract<LiveQuizResponseIdentityKey, `respondent:${string}`>
}

export type CorrelatedProcessingState = {
  owner: CorrelatedResponseOwner
  processedKey: string
  instanceId: number
  blockExecution: number
}

export class CorrelatedResponseIdentityError extends Error {}
export class CorrelatedResponseMutationLimitError extends Error {}

const MAX_CORRELATED_REDIS_MUTATIONS = 10_000

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
    select: {
      eventPayload: true,
      publicationGeneration: true,
      responseKey: true,
      settledAt: true,
    },
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
  if (message.publicationGeneration !== pendingResponse.publicationGeneration) {
    throw new Error(
      `Correlated response outbox generation mismatch for ${messageId}`
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
  if (mutations.length > MAX_CORRELATED_REDIS_MUTATIONS) {
    throw new CorrelatedResponseMutationLimitError(
      `Correlated response produced ${mutations.length} Redis mutations`
    )
  }

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

async function lockCorrelatedLiveQuizState({
  transaction,
  liveQuizId,
  instanceId,
  publicationGeneration,
}: {
  transaction: Pick<Prisma.TransactionClient, '$queryRaw'>
  liveQuizId: string
  instanceId: number
  publicationGeneration: number
}) {
  const [liveQuiz] = await transaction.$queryRaw<CorrelatedLiveQuizState[]>`
    SELECT
      "LiveQuiz"."activeBlockId",
      block."id" AS "blockId",
      block."execution" AS "blockExecution",
      block."status"::text AS "blockStatus",
      "LiveQuiz"."isAssessmentEnabled",
      "LiveQuiz"."publicationGeneration",
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
      "LiveQuiz"."publicationGeneration" = ${publicationGeneration} AND
      instance."id" = ${instanceId}
    FOR SHARE OF "LiveQuiz", block
  `

  return liveQuiz
}

function canApplyCorrelatedRedisEffects(
  liveQuiz: CorrelatedLiveQuizState | undefined,
  blockExecution: number,
  publicationGeneration: number
) {
  return (
    liveQuiz !== undefined &&
    liveQuiz.publicationGeneration === publicationGeneration &&
    liveQuiz.blockExecution === blockExecution &&
    liveQuiz.status === PublicationStatus.PUBLISHED &&
    liveQuiz.blockStatus === ElementBlockStatus.ACTIVE &&
    liveQuiz.activeBlockId === liveQuiz.blockId &&
    !liveQuiz.isAssessmentEnabled &&
    liveQuiz.responseCollectionMode ===
      LiveQuizResponseCollectionMode.CORRELATED_EXPORT
  )
}

export async function applyCorrelatedRedisMutationsWithFence({
  database,
  redis,
  liveQuizId,
  instanceId,
  publicationGeneration,
  blockExecution,
  mutations,
  processedKey,
  instanceInfoKey,
  identityKey,
  messageId,
}: {
  database: Pick<PrismaClient, '$transaction'>
  redis: Pick<CorrelatedProcessingRedis, 'eval'>
  liveQuizId: string
  instanceId: number
  publicationGeneration: number
  blockExecution: number
  mutations: RedisHashMutation[]
  processedKey: string
  instanceInfoKey: string
  identityKey: LiveQuizResponseIdentityKey
  messageId: string
}) {
  return database.$transaction(async (transaction) => {
    const liveQuiz = await lockCorrelatedLiveQuizState({
      transaction,
      liveQuizId,
      instanceId,
      publicationGeneration,
    })
    if (
      !canApplyCorrelatedRedisEffects(
        liveQuiz,
        blockExecution,
        publicationGeneration
      )
    ) {
      return 'inactive' as const
    }

    return applyCorrelatedRedisMutations({
      redis,
      mutations,
      processedKey,
      instanceInfoKey,
      blockExecution,
      identityKey,
      messageId,
    })
  })
}

export async function resolveCorrelatedResponseOwner({
  acceptedIdentity,
  liveQuizId,
  publicationGeneration,
  database,
}: {
  acceptedIdentity: AcceptedCorrelatedResponseIdentity
  liveQuizId: string
  publicationGeneration: number
  database: CorrelatedResponseDatabase
}): Promise<CorrelatedResponseOwner> {
  if (acceptedIdentity.kind !== 'anonymous') {
    throw new CorrelatedResponseIdentityError(
      'Correlated responses must use an admitted respondent identity'
    )
  }
  const respondent = await database.liveQuizRespondent.findUnique({
    where: {
      id_liveQuizId_publicationGeneration: {
        id: acceptedIdentity.id,
        liveQuizId,
        publicationGeneration,
      },
    },
    select: { finalizedAt: true },
  })
  if (!respondent || respondent.finalizedAt !== null) {
    throw new CorrelatedResponseIdentityError(
      'Accepted correlated response identity has invalid scope'
    )
  }

  const identityKey = `respondent:${acceptedIdentity.id}` as const
  return { kind: 'anonymous', id: acceptedIdentity.id, identityKey }
}

export function buildCorrelatedResponseCreateData({
  owner,
  instanceId,
  blockExecution,
  response,
  submittedAt: _submittedAt,
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
  // The shared LiveQuizResponse model keeps these required legacy columns for
  // assessment rows. Correlated teaching rows deliberately persist no event
  // timestamp or time-spent value: the epoch and -1 are non-information
  // sentinels, and the response timestamp remains transient for grading only.
  return {
    submittedAt: new Date(0),
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
    respondent: { connect: { id: owner.id } },
  }
}

export async function persistAcceptedCorrelatedResponse({
  database,
  liveQuizId,
  owner,
  instanceId,
  publicationGeneration,
  blockExecution,
  response,
  submittedAt,
  correctnessPercentage,
  basePoints,
  correctnessPoints,
  bonusPoints,
}: {
  database: Pick<
    CorrelatedResponseDatabase,
    '$transaction' | 'liveQuizResponse'
  >
  liveQuizId: string
  owner: CorrelatedResponseOwner
  instanceId: number
  publicationGeneration: number
  blockExecution: number
  response: LiveQuizResponseInput
  submittedAt: number
  correctnessPercentage: number | null
  basePoints: number
  correctnessPoints: number
  bonusPoints: number
}) {
  let applyRedisEffects = false
  try {
    return await database.$transaction(async (prisma) => {
      const liveQuiz = await lockCorrelatedLiveQuizState({
        transaction: prisma,
        liveQuizId,
        instanceId,
        publicationGeneration,
      })

      if (
        !liveQuiz ||
        liveQuiz.publicationGeneration !== publicationGeneration ||
        liveQuiz.blockExecution !== blockExecution ||
        (liveQuiz.status !== PublicationStatus.PUBLISHED &&
          liveQuiz.status !== PublicationStatus.ENDED) ||
        liveQuiz.isAssessmentEnabled ||
        liveQuiz.responseCollectionMode !==
          LiveQuizResponseCollectionMode.CORRELATED_EXPORT
      ) {
        return 'inactive' as const
      }
      applyRedisEffects = canApplyCorrelatedRedisEffects(
        liveQuiz,
        blockExecution,
        publicationGeneration
      )

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
      return {
        status: 'created' as const,
        applyRedisEffects,
      }
    })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      const existingResponse = await findPersistedCorrelatedResponse({
        database,
        owner,
        instanceId,
        blockExecution,
      })
      return existingResponse
        ? ({
            status: 'persisted' as const,
            applyRedisEffects,
          } as const)
        : ('duplicate' as const)
    }
    throw error
  }
}

export function getCorrelatedProcessedKey({
  liveQuizId,
  publicationGeneration,
  instanceId,
  blockExecution,
}: {
  liveQuizId: string
  publicationGeneration: number
  instanceId: string
  blockExecution: number
}) {
  return `lq:${liveQuizId}:g:${publicationGeneration}:i:${instanceId}:correlatedProcessed:${blockExecution}`
}

export async function prepareCorrelatedMessageProcessing({
  database,
  message,
  blockExecution,
  responseKey,
}: {
  database: CorrelatedResponseDatabase
  message: Pick<
    CorrelatedResponseEventMessage,
    'acceptedIdentity' | 'publicationGeneration' | 'sessionId' | 'instanceId'
  >
  blockExecution: string
  responseKey: string
}): Promise<
  | { status: 'invalid' }
  | { status: 'process'; state: CorrelatedProcessingState }
> {
  const instanceId = Number(message.instanceId)
  const execution = Number(blockExecution)
  if (
    !Number.isInteger(instanceId) ||
    !Number.isInteger(execution) ||
    !Number.isInteger(message.publicationGeneration) ||
    message.publicationGeneration < 0
  ) {
    return { status: 'invalid' }
  }

  const owner = await resolveCorrelatedResponseOwner({
    acceptedIdentity: message.acceptedIdentity,
    liveQuizId: message.sessionId,
    publicationGeneration: message.publicationGeneration,
    database,
  })
  const expectedResponseKey = buildCorrelatedResponseKey({
    liveQuizId: message.sessionId,
    publicationGeneration: message.publicationGeneration,
    instanceId: message.instanceId,
    blockExecution,
    identityKey: owner.identityKey,
  })
  if (responseKey !== expectedResponseKey) {
    return { status: 'invalid' }
  }

  const processedKey = getCorrelatedProcessedKey({
    liveQuizId: message.sessionId,
    publicationGeneration: message.publicationGeneration,
    instanceId: message.instanceId,
    blockExecution: execution,
  })

  return {
    status: 'process',
    state: {
      owner,
      processedKey,
      instanceId,
      blockExecution: execution,
    },
  }
}

async function findPersistedCorrelatedResponse({
  database,
  owner,
  instanceId,
  blockExecution,
}: {
  database: Pick<PrismaClient, 'liveQuizResponse'>
  owner: CorrelatedResponseOwner
  instanceId: number
  blockExecution: number
}) {
  return database.liveQuizResponse.findFirst({
    where: {
      instanceId,
      elementBlockExecution: blockExecution,
      respondentId: owner.id,
    },
    select: { id: true },
  })
}

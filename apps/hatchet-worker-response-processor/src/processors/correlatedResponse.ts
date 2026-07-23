import type { Prisma, PrismaClient } from '@klicker-uzh/prisma/client'
import {
  LiveQuizRespondentType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  hashLiveQuizRespondentToken,
  resolveLiveQuizResponseIdentity,
} from '@klicker-uzh/util'

type CorrelatedResponseDatabase = Pick<
  PrismaClient,
  | 'liveQuizRespondent'
  | 'liveQuizResponse'
  | 'participant'
  | 'temporaryLeaderboardEntry'
>

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

export type CorrelatedResponseOwner = {
  kind: 'participant' | 'temporary' | 'anonymous'
  id: string
  identityKey: string
}

export class CorrelatedResponseIdentityError extends Error {}
export class CorrelatedResponseProcessingBusyError extends Error {}

const CORRELATED_PROCESSING_LOCK_TTL_MS = 5 * 60 * 1000
const RELEASE_PROCESSING_LOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0
`

export async function resolveCorrelatedResponseOwner({
  cookieHeader,
  liveQuizId,
  secret,
  issuer,
  database,
}: {
  cookieHeader: string | undefined
  liveQuizId: string
  secret: string
  issuer: string
  database: CorrelatedResponseDatabase
}): Promise<CorrelatedResponseOwner> {
  const identity = await resolveLiveQuizResponseIdentity({
    cookieHeader,
    liveQuizId,
    secret,
    issuer,
  })
  if (!identity) {
    throw new CorrelatedResponseIdentityError(
      'Missing or invalid correlated response identity'
    )
  }

  if (identity.kind === 'participant') {
    const participant = await database.participant.findUnique({
      where: { id: identity.id },
      select: { id: true },
    })
    if (!participant) {
      throw new CorrelatedResponseIdentityError(
        'Correlated response participant no longer exists'
      )
    }

    return {
      kind: 'participant',
      id: identity.id,
      identityKey: `participant:${identity.id}`,
    }
  }

  if (identity.kind === 'temporary') {
    const legacyEntry = await database.temporaryLeaderboardEntry.findUnique({
      where: {
        id_quizId: {
          id: identity.id,
          quizId: liveQuizId,
        },
      },
    })
    if (!legacyEntry) {
      throw new CorrelatedResponseIdentityError(
        'Temporary correlated response identity is no longer active'
      )
    }

    const respondent = await database.liveQuizRespondent.upsert({
      where: { id: identity.id },
      update: {},
      create: {
        id: identity.id,
        type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
        username: legacyEntry.username,
        avatar: legacyEntry.avatar,
        score: legacyEntry.score,
        liveQuiz: { connect: { id: liveQuizId } },
      },
    })
    if (
      respondent.liveQuizId !== liveQuizId ||
      respondent.type !== LiveQuizRespondentType.TEMPORARY_PSEUDONYM
    ) {
      throw new CorrelatedResponseIdentityError(
        'Temporary correlated response identity has invalid scope'
      )
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
      throw new CorrelatedResponseIdentityError(
        'Anonymous correlated response identity has invalid scope or secret'
      )
    }
  }

  return {
    kind: identity.kind,
    id: identity.id,
    identityKey: `respondent:${identity.id}`,
  }
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

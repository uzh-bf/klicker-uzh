import type { Redis } from 'ioredis'

export const LIVE_QUIZ_RESPONSE_LEASE_TTL_SECONDS = 120
export const LIVE_QUIZ_RESPONSE_ADMISSION_LEASE_TTL_SECONDS = 10 * 60
export const LIVE_QUIZ_RESPONSE_LEASE_RENEWAL_MS = 30_000
export const LIVE_QUIZ_RESPONSE_PROCESSED_TTL_SECONDS = 24 * 60 * 60
const LIVE_QUIZ_RESPONSE_PROCESSING_VALUE_PREFIX = 'PROCESSING:'
export const LIVE_QUIZ_RESPONSE_PROCESSED_VALUE = 'COMPLETED'

export type LiveQuizResponseProcessingClaim =
  | 'acquired'
  | 'busy'
  | 'fenced'
  | 'processed'

export type LiveQuizResponseRedisMutation =
  | {
      command: 'hincrby'
      field: string
      increment: number
      key: string
    }
  | {
      command: 'hset'
      field: string
      key: string
      value: string
    }

export interface LiveQuizResponseRedisMutationSink {
  hincrby(
    key: string,
    field: string,
    increment: number
  ): LiveQuizResponseRedisMutationSink
  hset(
    key: string,
    field: string,
    value: string
  ): LiveQuizResponseRedisMutationSink
}

export function shouldRetryLiveQuizResponseProcessingResult({
  status,
  wasDurablyAdmitted,
}: {
  status: number
  wasDurablyAdmitted: boolean
}) {
  return status >= 500 || (wasDurablyAdmitted && status === 410)
}

export function throwLiveQuizResponseProcessingClaimLost(): never {
  throw new Error('Live quiz response processing claim was lost')
}

export function getLiveQuizCourseDeletedKey(liveQuizId: string) {
  return `lq:${liveQuizId}:course-deleted`
}

export function getLiveQuizResponseProcessingKey(liveQuizId: string) {
  return `lq:${liveQuizId}:response-processing`
}

export function getLiveQuizResponseProcessedKey(
  liveQuizId: string,
  token: string
) {
  return `lq:${liveQuizId}:response-processed:${token}`
}

export function getLiveQuizResponseProcessingToken({
  messageId,
  responseLeaseToken,
}: {
  messageId: string
  responseLeaseToken?: string
}) {
  return responseLeaseToken ?? messageId
}

function getLiveQuizResponseProcessingValue(ownerNonce: string) {
  return `${LIVE_QUIZ_RESPONSE_PROCESSING_VALUE_PREFIX}${ownerNonce}`
}

/**
 * Claim one response for processing without excluding unrelated responses.
 *
 * The claim and deletion-fence check are one Redis operation. A completed
 * marker survives ambiguous worker completion, while an in-progress claim
 * expires with its renewable lease so a crashed attempt can be retried.
 */
export async function claimLiveQuizResponseProcessing(
  redis: Redis,
  liveQuizId: string,
  processingToken: string,
  ownerNonce: string,
  ttlSeconds = LIVE_QUIZ_RESPONSE_LEASE_TTL_SECONDS
): Promise<LiveQuizResponseProcessingClaim> {
  const now = Date.now()
  const expiresAt = now + ttlSeconds * 1000
  const result = await redis.eval(
    `redis.call("zremrangebyscore", KEYS[2], "-inf", ARGV[3])
    if redis.call("exists", KEYS[1]) == 1 then
      return -1
    end
    local processed = redis.call("get", KEYS[3])
    if processed == ARGV[6] then
      return 2
    end
    if processed then
      return 0
    end
    redis.call("zrem", KEYS[2], ARGV[1])
    redis.call("zadd", KEYS[2], ARGV[4], ARGV[2])
    redis.call("set", KEYS[3], ARGV[5], "EX", ARGV[7])
    return 1`,
    3,
    getLiveQuizCourseDeletedKey(liveQuizId),
    getLiveQuizResponseProcessingKey(liveQuizId),
    getLiveQuizResponseProcessedKey(liveQuizId, processingToken),
    processingToken,
    ownerNonce,
    now,
    expiresAt,
    getLiveQuizResponseProcessingValue(ownerNonce),
    LIVE_QUIZ_RESPONSE_PROCESSED_VALUE,
    ttlSeconds
  )

  if (Number(result) === 1) return 'acquired'
  if (Number(result) === 2) return 'processed'
  if (Number(result) === -1) return 'fenced'
  return 'busy'
}

export async function renewLiveQuizResponseProcessingClaim(
  redis: Redis,
  liveQuizId: string,
  processingToken: string,
  ownerNonce: string,
  ttlSeconds = LIVE_QUIZ_RESPONSE_LEASE_TTL_SECONDS
) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const renewed = await redis.eval(
    `if redis.call("zscore", KEYS[1], ARGV[1]) and redis.call("get", KEYS[2]) == ARGV[3] then
      redis.call("zadd", KEYS[1], ARGV[2], ARGV[1])
      redis.call("expire", KEYS[2], ARGV[4])
      return 1
    end
    return 0`,
    2,
    getLiveQuizResponseProcessingKey(liveQuizId),
    getLiveQuizResponseProcessedKey(liveQuizId, processingToken),
    ownerNonce,
    expiresAt,
    getLiveQuizResponseProcessingValue(ownerNonce),
    ttlSeconds
  )
  return Number(renewed) === 1
}

export async function releaseLiveQuizResponseProcessingClaim(
  redis: Redis,
  liveQuizId: string,
  processingToken: string,
  ownerNonce: string
) {
  await redis.eval(
    `redis.call("zrem", KEYS[1], ARGV[1])
    if redis.call("zcard", KEYS[1]) == 0 then
      redis.call("del", KEYS[1])
    end
    if redis.call("get", KEYS[2]) == ARGV[2] then
      redis.call("del", KEYS[2])
    end
    return 1`,
    2,
    getLiveQuizResponseProcessingKey(liveQuizId),
    getLiveQuizResponseProcessedKey(liveQuizId, processingToken),
    ownerNonce,
    getLiveQuizResponseProcessingValue(ownerNonce)
  )
}

/** Commit all response effects iff this worker still owns the claim. */
export async function commitLiveQuizResponseProcessing(
  redis: Redis,
  liveQuizId: string,
  processingToken: string,
  ownerNonce: string,
  mutations: LiveQuizResponseRedisMutation[]
) {
  const committed = await redis.eval(
    `if redis.call("get", KEYS[2]) ~= ARGV[2] then
      return 0
    end
    local mutations = cjson.decode(ARGV[3])
    for _, mutation in ipairs(mutations) do
      if mutation.command == "hincrby" then
        redis.call("hincrby", mutation.key, mutation.field, mutation.increment)
      elseif mutation.command == "hset" then
        redis.call("hset", mutation.key, mutation.field, mutation.value)
      else
        return redis.error_reply("Unsupported live quiz response mutation")
      end
    end
    redis.call("set", KEYS[2], ARGV[4], "EX", ARGV[5])
    redis.call("zrem", KEYS[1], ARGV[1])
    if redis.call("zcard", KEYS[1]) == 0 then
      redis.call("del", KEYS[1])
    end
    return 1`,
    2,
    getLiveQuizResponseProcessingKey(liveQuizId),
    getLiveQuizResponseProcessedKey(liveQuizId, processingToken),
    ownerNonce,
    getLiveQuizResponseProcessingValue(ownerNonce),
    JSON.stringify(mutations),
    LIVE_QUIZ_RESPONSE_PROCESSED_VALUE,
    LIVE_QUIZ_RESPONSE_PROCESSED_TTL_SECONDS
  )
  return Number(committed) === 1
}

export async function acquireLiveQuizResponseProcessingLease(
  redis: Redis,
  liveQuizId: string,
  token: string,
  ttlSeconds = LIVE_QUIZ_RESPONSE_LEASE_TTL_SECONDS
) {
  const now = Date.now()
  const expiresAt = now + ttlSeconds * 1000
  const acquired = await redis.eval(
    `redis.call("zremrangebyscore", KEYS[2], "-inf", ARGV[2])
    if redis.call("exists", KEYS[1]) == 1 then
      return 0
    end
    redis.call("zadd", KEYS[2], ARGV[3], ARGV[1])
    return 1`,
    2,
    getLiveQuizCourseDeletedKey(liveQuizId),
    getLiveQuizResponseProcessingKey(liveQuizId),
    token,
    now,
    expiresAt
  )
  return Number(acquired) === 1
}

export async function renewLiveQuizResponseProcessingLease(
  redis: Redis,
  liveQuizId: string,
  token: string,
  ttlSeconds = LIVE_QUIZ_RESPONSE_LEASE_TTL_SECONDS
) {
  const expiresAt = Date.now() + ttlSeconds * 1000
  const renewed = await redis.eval(
    `if redis.call("zscore", KEYS[1], ARGV[1]) then
      redis.call("zadd", KEYS[1], ARGV[2], ARGV[1])
      return 1
    end
    return 0`,
    1,
    getLiveQuizResponseProcessingKey(liveQuizId),
    token,
    expiresAt
  )
  return Number(renewed) === 1
}

export async function releaseLiveQuizResponseProcessingLease(
  redis: Redis,
  liveQuizId: string,
  token: string
) {
  await redis.eval(
    `redis.call("zrem", KEYS[1], ARGV[1])
    if redis.call("zcard", KEYS[1]) == 0 then
      redis.call("del", KEYS[1])
    end
    return 1`,
    1,
    getLiveQuizResponseProcessingKey(liveQuizId),
    token
  )
}

export async function trySetLiveQuizCourseDeletedFence(
  redis: Redis,
  liveQuizId: string,
  value: string,
  ttlSeconds?: number
) {
  const now = Date.now()
  const fenced = await redis.eval(
    `redis.call("zremrangebyscore", KEYS[2], "-inf", ARGV[2])
    if redis.call("zcard", KEYS[2]) > 0 then
      return 0
    end
    redis.call("del", KEYS[2])
    if ARGV[3] == "" then
      redis.call("set", KEYS[1], ARGV[1])
    else
      redis.call("set", KEYS[1], ARGV[1], "EX", ARGV[3])
    end
    return 1`,
    2,
    getLiveQuizCourseDeletedKey(liveQuizId),
    getLiveQuizResponseProcessingKey(liveQuizId),
    value,
    now,
    ttlSeconds ? String(ttlSeconds) : ''
  )
  return Number(fenced) === 1
}

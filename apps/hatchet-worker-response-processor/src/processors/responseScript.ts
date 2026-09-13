import type { JWTPayload } from '@klicker-uzh/util'
import { isValidSubmissionId } from '@klicker-uzh/util'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'

/**
 * Atomically applies one live-quiz response aggregation: the authoritative
 * duplicate check, the response marker, all counter increments and all hash
 * writes. Redis does not roll back a partially executed script, so every
 * validation runs before the first mutation:
 *
 * 1. TYPE validation for every touched key, including the response key
 *    itself (returns -2)
 * 2. duplicate check on the response marker (returns 0)
 * 3. integer and cumulative-magnitude validation for every counter target
 *    (returns -1)
 *
 * Counters are bounded to the double-safe integer range (2^53): JavaScript
 * consumers read these aggregates back as numbers, and Lua tonumber is exact
 * there. Values beyond it are treated as corrupted state rather than
 * overflowed counters.
 *
 * Return codes: 1 = applied, 0 = duplicate (nothing written),
 * -1 = invalid integer/counter state, -2 = wrong key type.
 */
export const ATOMIC_RESPONSE_SCRIPT = `
local function touchedKeyIndexes()
  local indexes = {}
  indexes[1] = true
  local index = 4
  for _ = 1, tonumber(ARGV[3]) do
    indexes[tonumber(ARGV[index])] = true
    index = index + 3
  end
  local hsetCount = tonumber(ARGV[index])
  index = index + 1
  for _ = 1, hsetCount do
    indexes[tonumber(ARGV[index])] = true
    index = index + 4
  end
  return indexes
end

local safeBound = 9007199254740992
for keyIndex in pairs(touchedKeyIndexes()) do
  -- TYPE answers a status reply, which redis.call converts to a table with
  -- an ok field rather than a plain Lua string
  local keyType = redis.call('TYPE', KEYS[keyIndex])['ok']
  if keyType ~= 'none' and keyType ~= 'hash' then
    return -2
  end
end

if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
  return 0
end

local cumulative = {}
local index = 4
for _ = 1, tonumber(ARGV[3]) do
  local keyIndex = tonumber(ARGV[index])
  local field = ARGV[index + 1]
  local increment = ARGV[index + 2]

  local currentValue = redis.call('HGET', KEYS[keyIndex], field)
  if currentValue and not string.match(currentValue, '^-?%d+$') then
    return -1
  end
  if not string.match(increment, '^-?%d+$') then
    return -1
  end

  local slot = tostring(keyIndex) .. string.char(1) .. field
  local total = cumulative[slot]
  if total == nil then
    total = 0
    if currentValue then
      total = tonumber(currentValue)
    end
  end
  total = total + tonumber(increment)
  if total > safeBound or total < -safeBound then
    return -1
  end
  cumulative[slot] = total

  index = index + 3
end

redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])

index = 4
for _ = 1, tonumber(ARGV[3]) do
  local keyIndex = tonumber(ARGV[index])
  redis.call('HINCRBY', KEYS[keyIndex], ARGV[index + 1], tonumber(ARGV[index + 2]))
  index = index + 3
end

local hsetCount = tonumber(ARGV[index])
index = index + 1
for _ = 1, hsetCount do
  local keyIndex = tonumber(ARGV[index])
  local mode = ARGV[index + 3]
  if mode == 'setnx' then
    redis.call('HSETNX', KEYS[keyIndex], ARGV[index + 1], ARGV[index + 2])
  else
    redis.call('HSET', KEYS[keyIndex], ARGV[index + 1], ARGV[index + 2])
  end
  index = index + 4
end

return 1
`

/**
 * Aggregates must stay within the double-safe integer range; the Lua script
 * enforces the same bound on the Redis side.
 */
export const RESPONSE_COUNTER_SAFE_BOUND = Number.MAX_SAFE_INTEGER

export type RedisHashOperation =
  | {
      type: 'hincrby'
      key: string
      field: string
      increment: number
    }
  | {
      type: 'hset'
      key: string
      field: string
      value: string
      mode: 'set' | 'setnx'
    }

export function getParticipantResponseField(participantData: JWTPayload) {
  return participantData.role === 'TEMPORARY_PARTICIPANT'
    ? `temporary-${participantData.sub}`
    : participantData.sub
}

export function getAnonymousResponseField(submissionId: string) {
  return `anonymous-${createHash('sha256').update(submissionId).digest('hex')}`
}

/**
 * Redelivery identity for anonymous events without a valid client
 * submissionId: the response API mints one messageId per accepted HTTP
 * request, and the same messageId survives Hatchet event retries. Hashing it
 * deduplicates repeated delivery of one queued submission while leaving two
 * separate HTTP submissions from an old client as distinct responses.
 */
export function getRedeliveryResponseField(messageId: string) {
  return `redelivery-${createHash('sha256').update(messageId).digest('hex')}`
}

export { isValidSubmissionId }

export type RedisOperationCollector = {
  hincrby(
    key: string,
    field: string,
    increment: number
  ): RedisOperationCollector
  hset(key: string, field: string, value: unknown): RedisOperationCollector
  hsetnx(key: string, field: string, value: unknown): RedisOperationCollector
  discard(): RedisOperationCollector
}

export type RedisResponseOperations =
  | ChainableCommander
  | RedisOperationCollector

export function createRedisOperationCollector(
  operations: RedisHashOperation[]
): RedisOperationCollector {
  const collector = {
    hincrby(key: string, field: string, increment: number) {
      operations.push({ type: 'hincrby', key, field, increment })
      return collector
    },
    hset(key: string, field: string, value: unknown) {
      operations.push({
        type: 'hset',
        key,
        field,
        value: String(value),
        mode: 'set',
      })
      return collector
    },
    hsetnx(key: string, field: string, value: unknown) {
      operations.push({
        type: 'hset',
        key,
        field,
        value: String(value),
        mode: 'setnx',
      })
      return collector
    },
    discard() {
      operations.length = 0
      return collector
    },
  }

  return collector
}

/**
 * Encode the collected hash operations for the atomic response script. The
 * marker operation (the response field on the participant response key) must
 * be present exactly once; it doubles as the duplicate guard inside the
 * script. All increments are validated as safe integers — individually and
 * cumulatively per key/field — mirroring the validation the script itself
 * performs before its first write.
 */
export function buildResponseScriptInvocation({
  operations,
  participantResponseKey,
  participantResponseField,
}: {
  operations: RedisHashOperation[]
  participantResponseKey: string
  participantResponseField: string
}): { keys: string[]; args: string[] } {
  const markerOperations = operations.filter(
    (operation) =>
      operation.type === 'hset' &&
      operation.key === participantResponseKey &&
      operation.field === participantResponseField
  )

  if (markerOperations.length === 0) {
    throw new Error('Missing participant response marker operation')
  }
  if (markerOperations.length > 1) {
    throw new Error('Conflicting participant response marker operations')
  }
  const markerOperation = markerOperations[0] as Extract<
    RedisHashOperation,
    { type: 'hset' }
  >

  const incrementOperations = operations.filter(
    (
      operation
    ): operation is Extract<RedisHashOperation, { type: 'hincrby' }> =>
      operation.type === 'hincrby'
  )

  const cumulativeByKeyField = new Map<string, number>()
  for (const operation of incrementOperations) {
    if (!Number.isInteger(operation.increment)) {
      throw new Error(
        `Invalid Redis integer increment ${operation.increment} for ${operation.key}:${operation.field}`
      )
    }
    const slot = `${operation.key}\u0001${operation.field}`
    const total = (cumulativeByKeyField.get(slot) ?? 0) + operation.increment
    if (Math.abs(total) > RESPONSE_COUNTER_SAFE_BOUND) {
      throw new Error(
        `Cumulative Redis increment ${total} exceeds the safe integer bound for ${operation.key}:${operation.field}`
      )
    }
    cumulativeByKeyField.set(slot, total)
  }

  const hsetOperations = operations.filter(
    (operation): operation is Extract<RedisHashOperation, { type: 'hset' }> =>
      operation.type === 'hset' &&
      (operation.key !== participantResponseKey ||
        operation.field !== participantResponseField)
  )
  const scriptKeys = [
    participantResponseKey,
    ...new Set(
      [...incrementOperations, ...hsetOperations]
        .map((operation) => operation.key)
        .filter((key) => key !== participantResponseKey)
    ),
  ]
  const keyIndexByKey = new Map(
    scriptKeys.map((key, index) => [key, index + 1])
  )

  const args = [
    participantResponseField,
    markerOperation.value,
    String(incrementOperations.length),
    ...incrementOperations.flatMap((operation) => [
      String(keyIndexByKey.get(operation.key)!),
      operation.field,
      String(operation.increment),
    ]),
    String(hsetOperations.length),
    ...hsetOperations.flatMap((operation) => [
      String(keyIndexByKey.get(operation.key)!),
      operation.field,
      operation.value,
      operation.mode,
    ]),
  ]

  return { keys: scriptKeys, args }
}

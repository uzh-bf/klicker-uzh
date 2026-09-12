import type { JWTPayload } from '@klicker-uzh/util'
import { createHash } from 'crypto'
import type { ChainableCommander } from 'ioredis'

export const ADD_AUTHENTICATED_RESPONSE_SCRIPT = `
if redis.call('HEXISTS', KEYS[1], ARGV[1]) == 1 then
  return 0
end

local index = 3
local incrementCount = tonumber(ARGV[index])
index = index + 1
for _ = 1, incrementCount do
  local keyIndex = tonumber(ARGV[index])
  local currentValue = redis.call('HGET', KEYS[keyIndex], ARGV[index + 1])
  if currentValue and not string.match(currentValue, '^-?%d+$') then
    return -1
  end
  if not string.match(ARGV[index + 2], '^-?%d+$') then
    return -1
  end
  index = index + 3
end

redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])

-- Replay the increment operations after validation. Base ARGV slots 1-3 are
-- participantResponseField, markerValue, and incrementCount, so increments
-- start at slot 4.
index = 4
for _ = 1, incrementCount do
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
 * be present; it doubles as the duplicate guard inside the script. All
 * increments are validated as integers before encoding, mirroring the
 * validation the script itself performs before its first write.
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
  const markerOperation = operations.find(
    (operation) =>
      operation.type === 'hset' &&
      operation.key === participantResponseKey &&
      operation.field === participantResponseField
  )

  if (!markerOperation || markerOperation.type !== 'hset') {
    throw new Error('Missing authenticated participant response marker')
  }

  const incrementOperations = operations.filter(
    (
      operation
    ): operation is Extract<RedisHashOperation, { type: 'hincrby' }> =>
      operation.type === 'hincrby'
  )
  const invalidIncrementOperation = incrementOperations.find(
    (operation) => !Number.isInteger(Number(operation.increment))
  )
  if (invalidIncrementOperation) {
    throw new Error(
      `Invalid Redis integer increment ${invalidIncrementOperation.increment} for ${invalidIncrementOperation.key}:${invalidIncrementOperation.field}`
    )
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

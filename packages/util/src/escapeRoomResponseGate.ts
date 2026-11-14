import type { Redis } from 'ioredis'
import { randomUUID } from 'node:crypto'

const RESPONSE_SLOT_TTL_SECONDS = 300
const RESPONSE_EVENT_TTL_SECONDS = 60 * 60 * 24 * 30
const CLOSE_GATE_TTL_SECONDS = 60 * 60

const ACQUIRE_RESPONSE_SLOT = `
  -- escape-room-response-acquire
  if redis.call('exists', KEYS[1]) == 1 then
    return 0
  end
  redis.call('zremrangebyscore', KEYS[2], '-inf', ARGV[1])
  redis.call('zadd', KEYS[2], ARGV[2], ARGV[3])
  redis.call('expire', KEYS[2], ARGV[4])
  return 1
`

const CLOSE_RESPONSE_GATE = `
  -- escape-room-response-close
  local ownsGate = redis.call('set', KEYS[1], ARGV[2], 'EX', ARGV[3], 'NX')
  redis.call('zremrangebyscore', KEYS[2], '-inf', ARGV[1])
  return {
    ownsGate and 1 or 0,
    redis.call('zcard', KEYS[2]),
    redis.call('zcard', KEYS[3])
  }
`

const READ_RESPONSE_GATE_STATUS = `
  -- escape-room-response-status
  redis.call('zremrangebyscore', KEYS[1], '-inf', ARGV[1])
  return {
    redis.call('zcard', KEYS[1]),
    redis.call('zcard', KEYS[2])
  }
`

const REOPEN_RESPONSE_GATE = `
  -- escape-room-response-reopen
  if redis.call('get', KEYS[1]) == ARGV[1] then
    return redis.call('del', KEYS[1])
  end
  return 0
`

function gateKey(blockId: number) {
  return `escape-room:liveQuizBlock:${blockId}:closing`
}

function inFlightKey(blockId: number) {
  return `escape-room:liveQuizBlock:${blockId}:in-flight`
}

export function pendingEventKey(blockId: number) {
  return `escape-room:liveQuizBlock:${blockId}:pending-events`
}

export async function acquireEscapeRoomResponseSlot({
  redis,
  blockId,
  token,
}: {
  redis: Redis
  blockId: number
  token: string
}) {
  const now = Date.now()
  const result = await redis.eval(
    ACQUIRE_RESPONSE_SLOT,
    2,
    gateKey(blockId),
    inFlightKey(blockId),
    String(now),
    String(now + RESPONSE_SLOT_TTL_SECONDS * 1000),
    token,
    String(RESPONSE_SLOT_TTL_SECONDS)
  )
  return Number(result) === 1
}

export async function releaseEscapeRoomResponseSlot({
  redis,
  blockId,
  token,
}: {
  redis: Redis
  blockId: number
  token: string
}) {
  await redis.zrem(inFlightKey(blockId), token)
}

export async function trackEscapeRoomResponseEvent({
  redis,
  blockId,
  messageId,
}: {
  redis: Redis
  blockId: number
  messageId: string
}) {
  await redis
    .multi()
    .zadd(pendingEventKey(blockId), Date.now(), messageId)
    .expire(pendingEventKey(blockId), RESPONSE_EVENT_TTL_SECONDS)
    .exec()
}

export async function completeEscapeRoomResponseEvent({
  redis,
  blockId,
  messageId,
}: {
  redis: Redis
  blockId: number
  messageId: string
}) {
  await redis.zrem(pendingEventKey(blockId), messageId)
}

function parseCounts(value: unknown): [number, number] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error('Invalid Escape Room response gate state')
  }
  return [Number(value[0]), Number(value[1])]
}

export async function closeEscapeRoomResponseGate({
  redis,
  blockId,
  timeoutMs = 30_000,
  pollIntervalMs = 25,
}: {
  redis: Redis
  blockId: number
  timeoutMs?: number
  pollIntervalMs?: number
}) {
  const gateToken = randomUUID()
  const closeState = await redis.eval(
    CLOSE_RESPONSE_GATE,
    3,
    gateKey(blockId),
    inFlightKey(blockId),
    pendingEventKey(blockId),
    String(Date.now()),
    gateToken,
    String(CLOSE_GATE_TTL_SECONDS)
  )
  if (!Array.isArray(closeState) || closeState.length !== 3) {
    throw new Error('Invalid Escape Room response close-gate state')
  }
  const ownsGate = Number(closeState[0]) === 1
  if (!ownsGate) {
    throw new Error(
      `Escape Room responses are already closing for Live Quiz block ${blockId}`
    )
  }
  let counts: [number, number] = [Number(closeState[1]), Number(closeState[2])]
  const deadline = Date.now() + timeoutMs

  try {
    while (counts[0] > 0 || counts[1] > 0) {
      if (Date.now() >= deadline) {
        throw new Error(
          `Timed out draining Escape Room responses for Live Quiz block ${blockId}`
        )
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
      counts = parseCounts(
        await redis.eval(
          READ_RESPONSE_GATE_STATUS,
          2,
          inFlightKey(blockId),
          pendingEventKey(blockId),
          String(Date.now())
        )
      )
    }
  } catch (error) {
    await reopenEscapeRoomResponseGate({
      redis,
      blockId,
      token: gateToken,
    })
    throw error
  }

  return gateToken
}

export async function reopenEscapeRoomResponseGate({
  redis,
  blockId,
  token,
}: {
  redis: Redis
  blockId: number
  token: string | null
}) {
  if (!token) return
  await redis.eval(REOPEN_RESPONSE_GATE, 1, gateKey(blockId), token)
}

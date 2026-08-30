import { createHash, createHmac, randomBytes } from 'node:crypto'
import type {
  LiveQuizResponseInput,
  PeerInstructionInstanceMeta,
  PeerInstructionRevisionEvent,
  PeerInstructionScope,
} from '@klicker-uzh/types'
import type { Redis } from 'ioredis'

export const PEER_INSTRUCTION_TTL_SECONDS = 24 * 60 * 60
const PENDING_INITIAL_TTL_SECONDS = 10 * 60

type StoredRevisionMessage = {
  identity: string
  instanceId: number
  response: LiveQuizResponseInput
  responseTimestamp: number
  status: 'accepted' | 'succeeded' | 'failed'
  errorCode?: string
}

export type PeerInstructionRevisionRegistration =
  | 'accepted'
  | 'duplicate'
  | 'sealed'
  | 'missing-attempt'
  | 'invalid-instance'
  | 'invalid-token'
  | 'attempt-failed'

export type PeerInstructionAttemptStatus = {
  ingress: 'open' | 'sealed'
  accepted: number
  terminal: number
  failed: number
}

const RECORD_INITIAL_SCRIPT = `
local deadline = redis.call('HGET', KEYS[1], 'expiresAt')
if not deadline then
  local now = redis.call('TIME')
  deadline = tonumber(now[1]) + tonumber(ARGV[5])
  redis.call('HSET', KEYS[1], 'expiresAt', deadline)
end

local inserted = redis.call('HSETNX', KEYS[4], ARGV[1], ARGV[2])
redis.call('HSETNX', KEYS[3], ARGV[3], ARGV[4])
if ARGV[6] ~= '' then
  redis.call('SADD', KEYS[5], ARGV[6])
end

redis.call('SADD', KEYS[2], KEYS[1], KEYS[2], KEYS[3], KEYS[4], KEYS[5])
redis.call('EXPIREAT', KEYS[1], deadline)
redis.call('EXPIREAT', KEYS[2], deadline)
redis.call('EXPIREAT', KEYS[3], deadline)
redis.call('EXPIREAT', KEYS[4], deadline)
redis.call('EXPIREAT', KEYS[5], deadline)
return inserted
`

const REGISTER_ANONYMOUS_SCRIPT = `
local deadline = redis.call('HGET', KEYS[1], 'expiresAt')
if not deadline then
  local now = redis.call('TIME')
  deadline = tonumber(now[1]) + tonumber(ARGV[2])
  redis.call('HSET', KEYS[1], 'expiresAt', deadline)
end
redis.call('SADD', KEYS[3], ARGV[1])
redis.call('SADD', KEYS[2], KEYS[1], KEYS[2], KEYS[3])
redis.call('EXPIREAT', KEYS[1], deadline)
redis.call('EXPIREAT', KEYS[2], deadline)
redis.call('EXPIREAT', KEYS[3], deadline)
return 1
`

const OPEN_ATTEMPT_SCRIPT = `
if redis.call('EXISTS', KEYS[3]) == 1 then
  return 0
end
if ARGV[1] == '2' then
  if redis.call('EXISTS', KEYS[5]) == 0 then
    return -1
  end
  if redis.call('HGET', KEYS[5], 'ingress') == 'open' then
    return -1
  end
end

local deadline = redis.call('HGET', KEYS[1], 'expiresAt')
if not deadline then
  local now = redis.call('TIME')
  deadline = tonumber(now[1]) + tonumber(ARGV[2])
  redis.call('HSET', KEYS[1], 'expiresAt', deadline)
end

redis.call('HSET', KEYS[3],
  'ingress', 'open',
  'accepted', 0,
  'terminal', 0,
  'failed', 0
)
for i = 3, #ARGV do
  redis.call('SADD', KEYS[4], ARGV[i])
end
redis.call('SADD', KEYS[2], KEYS[1], KEYS[2], KEYS[3], KEYS[4])
redis.call('EXPIREAT', KEYS[1], deadline)
redis.call('EXPIREAT', KEYS[2], deadline)
redis.call('EXPIREAT', KEYS[3], deadline)
redis.call('EXPIREAT', KEYS[4], deadline)
return 1
`

const REGISTER_REVISION_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return 4
end
if redis.call('HGET', KEYS[1], 'ingress') ~= 'open' then
  return 3
end
if redis.call('SISMEMBER', KEYS[2], ARGV[2]) == 0 then
  return 5
end
if ARGV[6] == '1' and redis.call('SISMEMBER', KEYS[7], ARGV[3]) == 0 then
  return 6
end
if redis.call('HEXISTS', KEYS[3], ARGV[1]) == 1 then
  return 2
end
local existingMessageId = redis.call('HGET', KEYS[4], ARGV[3])
if existingMessageId then
  local existingEncoded = redis.call('HGET', KEYS[3], existingMessageId)
  if existingEncoded then
    local existing = cjson.decode(existingEncoded)
    if existing.status == 'failed' then
      return 7
    end
  end
  return 2
end

redis.call('HSET', KEYS[4], ARGV[3], ARGV[1])
redis.call('HSET', KEYS[3], ARGV[1], ARGV[4])
redis.call('HINCRBY', KEYS[1], 'accepted', 1)
local deadline = redis.call('HGET', KEYS[5], 'expiresAt')
redis.call('SADD', KEYS[6], KEYS[3], KEYS[4])
redis.call('EXPIREAT', KEYS[3], deadline)
redis.call('EXPIREAT', KEYS[4], deadline)
return 1
`

const SEAL_ATTEMPT_SCRIPT = `
if redis.call('EXISTS', KEYS[1]) == 0 then
  return nil
end
redis.call('HSET', KEYS[1], 'ingress', 'sealed')
return redis.call('HMGET', KEYS[1], 'accepted', 'terminal', 'failed')
`

const COMPLETE_REVISION_SCRIPT = `
local encoded = redis.call('HGET', KEYS[1], ARGV[1])
if not encoded then
  return -1
end
local message = cjson.decode(encoded)
if message.status ~= 'accepted' then
  return 0
end

message.status = ARGV[2]
if ARGV[4] ~= '' then
  message.errorCode = ARGV[4]
end
redis.call('HSET', KEYS[1], ARGV[1], cjson.encode(message))
if ARGV[2] == 'succeeded' then
  redis.call('HSET', KEYS[3], message.identity, ARGV[3])
else
  redis.call('HINCRBY', KEYS[2], 'failed', 1)
end
redis.call('HINCRBY', KEYS[2], 'terminal', 1)

local deadline = redis.call('HGET', KEYS[4], 'expiresAt')
redis.call('SADD', KEYS[5], KEYS[3])
redis.call('EXPIREAT', KEYS[3], deadline)
return 1
`

function assertScope(scope: PeerInstructionScope) {
  if (!/^[A-Za-z0-9-]+$/.test(scope.liveQuizId)) {
    throw new Error('Invalid Peer Instruction live quiz id')
  }
  if (!Number.isInteger(scope.blockId) || scope.blockId < 1) {
    throw new Error('Invalid Peer Instruction block id')
  }
  if (
    !Number.isInteger(scope.originalExecution) ||
    scope.originalExecution < 0
  ) {
    throw new Error('Invalid Peer Instruction execution')
  }
  if (scope.attempt !== 1 && scope.attempt !== 2) {
    throw new Error('Invalid Peer Instruction attempt')
  }
}

function rootKey(scope: PeerInstructionScope) {
  assertScope(scope)
  return `pi:${scope.liveQuizId}:b:${scope.blockId}:e:${scope.originalExecution}`
}

function rootKeys(scope: PeerInstructionScope) {
  const root = rootKey(scope)
  return {
    root,
    meta: `${root}:meta`,
    registry: `${root}:keys`,
    instances: `${root}:instances`,
    anonymous: `${root}:anonymous`,
  }
}

function attemptKeys(scope: PeerInstructionScope) {
  const root = rootKeys(scope)
  const attempt = `${root.root}:a:${scope.attempt}`
  return {
    ...root,
    attempt,
    attemptMeta: `${attempt}:meta`,
    attemptInstances: `${attempt}:instances`,
    messages: `${attempt}:messages`,
  }
}

function claimsKey(scope: PeerInstructionScope, instanceId: number) {
  return `${attemptKeys(scope).attempt}:claims:${instanceId}`
}

function initialKey(scope: PeerInstructionScope, instanceId: number) {
  return `${rootKeys(scope).root}:initial:${instanceId}`
}

function revisedKey(scope: PeerInstructionScope, instanceId: number) {
  return `${attemptKeys(scope).attempt}:revised:${instanceId}`
}

function hashAnonymousToken(token: string) {
  return `anonymous:${createHash('sha256').update(token).digest('base64url')}`
}

export function createPeerInstructionParticipantIdentity({
  scope,
  participantId,
  participantRole,
  secret,
}: {
  scope: PeerInstructionScope
  participantId: string
  participantRole: 'PARTICIPANT' | 'TEMPORARY_PARTICIPANT'
  secret: string
}) {
  assertScope(scope)
  return `participant:${createHmac('sha256', secret)
    .update(
      [
        'peer-instruction-v1',
        scope.liveQuizId,
        scope.blockId,
        scope.originalExecution,
        participantRole,
        participantId,
      ].join(':')
    )
    .digest('base64url')}`
}

export async function issuePeerInstructionAnonymousToken(
  redis: Redis,
  scope: PeerInstructionScope
) {
  const token = randomBytes(32).toString('base64url')
  const identity = hashAnonymousToken(token)
  const keys = rootKeys(scope)
  await redis.eval(
    REGISTER_ANONYMOUS_SCRIPT,
    3,
    keys.meta,
    keys.registry,
    keys.anonymous,
    identity,
    PEER_INSTRUCTION_TTL_SECONDS
  )
  return token
}

export function getPeerInstructionAnonymousIdentity(token: string) {
  if (!/^[A-Za-z0-9_-]{32,}$/.test(token)) {
    throw new Error('Invalid Peer Instruction pairing token')
  }
  return hashAnonymousToken(token)
}

function pendingInitialKey(liveQuizId: string, messageId: string) {
  if (!/^[A-Za-z0-9-]+$/.test(liveQuizId)) {
    throw new Error('Invalid Peer Instruction live quiz id')
  }
  if (!/^[A-Za-z0-9-]+$/.test(messageId)) {
    throw new Error('Invalid Peer Instruction message id')
  }
  return `pi:${liveQuizId}:pending-initial:${messageId}`
}

export async function issuePendingPeerInstructionAnonymousToken({
  redis,
  liveQuizId,
  messageId,
}: {
  redis: Redis
  liveQuizId: string
  messageId: string
}) {
  const token = randomBytes(32).toString('base64url')
  const identity = hashAnonymousToken(token)
  const result = await redis.set(
    pendingInitialKey(liveQuizId, messageId),
    identity,
    'EX',
    PENDING_INITIAL_TTL_SECONDS,
    'NX'
  )
  if (result !== 'OK') {
    throw new Error('Could not register anonymous Peer Instruction token')
  }
  return token
}

export async function readPendingPeerInstructionAnonymousIdentity({
  redis,
  liveQuizId,
  messageId,
}: {
  redis: Redis
  liveQuizId: string
  messageId: string
}) {
  return redis.get(pendingInitialKey(liveQuizId, messageId))
}

export async function clearPendingPeerInstructionAnonymousIdentity({
  redis,
  liveQuizId,
  messageId,
}: {
  redis: Redis
  liveQuizId: string
  messageId: string
}) {
  await redis.unlink(pendingInitialKey(liveQuizId, messageId))
}

export async function recordPeerInstructionInitialResponse({
  redis,
  scope,
  instanceId,
  identity,
  response,
  instanceMeta,
  anonymousIdentity,
}: {
  redis: Redis
  scope: PeerInstructionScope
  instanceId: number
  identity: string
  response: LiveQuizResponseInput
  instanceMeta: PeerInstructionInstanceMeta
  anonymousIdentity?: string
}) {
  const keys = rootKeys(scope)
  const result = await redis.eval(
    RECORD_INITIAL_SCRIPT,
    5,
    keys.meta,
    keys.registry,
    keys.instances,
    initialKey(scope, instanceId),
    keys.anonymous,
    identity,
    JSON.stringify(response),
    String(instanceId),
    JSON.stringify(instanceMeta),
    PEER_INSTRUCTION_TTL_SECONDS,
    anonymousIdentity ?? ''
  )
  return Number(result) === 1
}

export async function openPeerInstructionRevisionAttempt({
  redis,
  scope,
  instanceIds,
}: {
  redis: Redis
  scope: PeerInstructionScope
  instanceIds: number[]
}) {
  if (
    instanceIds.length === 0 ||
    instanceIds.some((id) => !Number.isInteger(id))
  ) {
    throw new Error('Peer Instruction requires question instances')
  }
  const keys = attemptKeys(scope)
  const previousMeta = `${keys.root}:a:1:meta`
  const result = await redis.eval(
    OPEN_ATTEMPT_SCRIPT,
    5,
    keys.meta,
    keys.registry,
    keys.attemptMeta,
    keys.attemptInstances,
    previousMeta,
    scope.attempt,
    PEER_INSTRUCTION_TTL_SECONDS,
    ...instanceIds.map(String)
  )
  if (Number(result) === -1) {
    throw new Error('Peer Instruction replacement is not available')
  }
  return Number(result) === 1
}

export async function registerPeerInstructionRevisionMessage({
  redis,
  event,
  instanceId,
  identity,
  response,
  responseTimestamp,
}: {
  redis: Redis
  event: PeerInstructionRevisionEvent
  instanceId: number
  identity: string
  response: LiveQuizResponseInput
  responseTimestamp: number
}): Promise<PeerInstructionRevisionRegistration> {
  const keys = attemptKeys(event)
  const message: StoredRevisionMessage = {
    identity,
    instanceId,
    response,
    responseTimestamp,
    status: 'accepted',
  }
  const result = Number(
    await redis.eval(
      REGISTER_REVISION_SCRIPT,
      7,
      keys.attemptMeta,
      keys.attemptInstances,
      keys.messages,
      claimsKey(event, instanceId),
      keys.meta,
      keys.registry,
      keys.anonymous,
      event.messageId,
      instanceId,
      identity,
      JSON.stringify(message),
      PEER_INSTRUCTION_TTL_SECONDS,
      identity.startsWith('anonymous:') ? '1' : '0'
    )
  )
  return (
    (
      {
        1: 'accepted',
        2: 'duplicate',
        3: 'sealed',
        4: 'missing-attempt',
        5: 'invalid-instance',
        6: 'invalid-token',
        7: 'attempt-failed',
      } as const
    )[result] ?? 'missing-attempt'
  )
}

export async function readPeerInstructionRevisionMessage({
  redis,
  event,
}: {
  redis: Redis
  event: PeerInstructionRevisionEvent
}) {
  const encoded = await redis.hget(attemptKeys(event).messages, event.messageId)
  return encoded ? (JSON.parse(encoded) as StoredRevisionMessage) : null
}

export async function readPeerInstructionInstanceMeta({
  redis,
  scope,
  instanceId,
}: {
  redis: Redis
  scope: PeerInstructionScope
  instanceId: number
}) {
  const encoded = await redis.hget(
    rootKeys(scope).instances,
    String(instanceId)
  )
  return encoded ? (JSON.parse(encoded) as PeerInstructionInstanceMeta) : null
}

export async function completePeerInstructionRevisionMessage({
  redis,
  event,
  response,
  errorCode,
}: {
  redis: Redis
  event: PeerInstructionRevisionEvent
  response?: LiveQuizResponseInput
  errorCode?: string
}) {
  const keys = attemptKeys(event)
  const stored = await readPeerInstructionRevisionMessage({ redis, event })
  if (!stored) return false
  const result = await redis.eval(
    COMPLETE_REVISION_SCRIPT,
    5,
    keys.messages,
    keys.attemptMeta,
    revisedKey(event, stored.instanceId),
    keys.meta,
    keys.registry,
    event.messageId,
    response ? 'succeeded' : 'failed',
    response ? JSON.stringify(response) : '',
    errorCode ?? ''
  )
  return Number(result) === 1
}

export async function sealPeerInstructionRevisionAttempt({
  redis,
  scope,
}: {
  redis: Redis
  scope: PeerInstructionScope
}): Promise<PeerInstructionAttemptStatus | null> {
  const key = attemptKeys(scope).attemptMeta
  const status = (await redis.eval(SEAL_ATTEMPT_SCRIPT, 1, key)) as
    | string[]
    | null
  if (!status) return null
  return {
    ingress: 'sealed',
    accepted: Number(status[0] ?? 0),
    terminal: Number(status[1] ?? 0),
    failed: Number(status[2] ?? 0),
  }
}

export async function readPeerInstructionAttemptStatus({
  redis,
  scope,
}: {
  redis: Redis
  scope: PeerInstructionScope
}): Promise<PeerInstructionAttemptStatus | null> {
  const status = await redis.hgetall(attemptKeys(scope).attemptMeta)
  if (Object.keys(status).length === 0) return null
  return {
    ingress: status.ingress === 'sealed' ? 'sealed' : 'open',
    accepted: Number(status.accepted ?? 0),
    terminal: Number(status.terminal ?? 0),
    failed: Number(status.failed ?? 0),
  }
}

export async function readPeerInstructionResponseMaps({
  redis,
  scope,
  instanceId,
}: {
  redis: Redis
  scope: PeerInstructionScope
  instanceId: number
}) {
  const [initial, revised] = await Promise.all([
    redis.hgetall(initialKey(scope, instanceId)),
    redis.hgetall(revisedKey(scope, instanceId)),
  ])
  return { initial, revised }
}

export async function clearPeerInstructionTransientState({
  redis,
  scope,
}: {
  redis: Redis
  scope: PeerInstructionScope
}) {
  const keys = rootKeys(scope)
  const registered = await redis.smembers(keys.registry)
  if (registered.length === 0) {
    await redis.unlink(keys.registry, keys.meta)
    return 0
  }
  return redis.unlink(...new Set([...registered, keys.registry, keys.meta]))
}

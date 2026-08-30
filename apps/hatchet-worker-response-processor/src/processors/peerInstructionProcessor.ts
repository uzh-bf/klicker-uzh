import type {
  Context,
  DurableContext,
  JsonObject,
} from '@hatchet-dev/typescript-sdk/index.js'
import type {
  LiveQuizResponseInput,
  PeerInstructionRevisionEvent,
} from '@klicker-uzh/types'
import {
  completePeerInstructionRevisionMessage,
  readPeerInstructionInstanceMeta,
  readPeerInstructionRevisionMessage,
} from '@klicker-uzh/util'
import type { Redis } from 'ioredis'
import { getRedis } from '../redis.js'
import {
  normalizeStudentResponse,
  validateStudentResponse,
} from './responseValidation.js'

export async function processPeerInstructionRevisionMessage(
  event: PeerInstructionRevisionEvent,
  ctx:
    | Context<JsonObject, Record<string, never>>
    | DurableContext<JsonObject, Record<string, never>>,
  redis: Redis = getRedis()
) {
  ctx.logger.info('Processing Peer Instruction revision', {
    messageId: event.messageId,
    liveQuizId: event.liveQuizId,
    blockId: event.blockId,
    originalExecution: event.originalExecution,
    attempt: event.attempt,
  })

  const stored = await readPeerInstructionRevisionMessage({ redis, event })
  if (stored?.status !== 'accepted') {
    return { status: 200 }
  }

  const instanceMeta = await readPeerInstructionInstanceMeta({
    redis,
    scope: event,
    instanceId: stored.instanceId,
  })
  if (!instanceMeta) {
    await completePeerInstructionRevisionMessage({
      redis,
      event,
      errorCode: 'missing-instance',
    })
    return { status: 400 }
  }

  const validation = validateStudentResponse({
    type: instanceMeta.type,
    response: stored.response,
    restrictions: instanceMeta.restrictions,
  })
  if (!validation.valid) {
    ctx.logger.info('Rejected invalid Peer Instruction revision', {
      messageId: event.messageId,
      instanceId: stored.instanceId,
    })
    await completePeerInstructionRevisionMessage({
      redis,
      event,
      errorCode: 'invalid-response',
    })
    return { status: 400 }
  }

  await completePeerInstructionRevisionMessage({
    redis,
    event,
    response: normalizeStudentResponse(instanceMeta.type, stored.response),
  })
  return { status: 200 }
}

export async function failPeerInstructionRevisionMessage(
  event: PeerInstructionRevisionEvent,
  redis: Redis = getRedis()
) {
  return completePeerInstructionRevisionMessage({
    redis,
    event,
    errorCode: 'processor-failed',
  })
}

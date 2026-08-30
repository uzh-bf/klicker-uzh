import { readFile } from 'node:fs/promises'
import type { PeerInstructionRevisionEvent } from '@klicker-uzh/types'
import {
  createPeerInstructionParticipantIdentity,
  openPeerInstructionRevisionAttempt,
  readPeerInstructionAttemptStatus,
  readPeerInstructionResponseMaps,
  recordPeerInstructionInitialResponse,
  registerPeerInstructionRevisionMessage,
} from '@klicker-uzh/util'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { processPeerInstructionRevisionMessage } from '../src/processors/peerInstructionProcessor.js'

const redisPort = Number(process.env.PEER_INSTRUCTION_TEST_REDIS_PORT)
const describeRedis = Number.isInteger(redisPort) ? describe : describe.skip

describeRedis('Peer Instruction revision processor', () => {
  const redis = new Redis({ host: '127.0.0.1', port: redisPort })
  const scope = {
    liveQuizId: 'quiz-1',
    blockId: 10,
    originalExecution: 2,
    attempt: 1 as const,
  }
  const identity = createPeerInstructionParticipantIdentity({
    scope,
    participantId: 'participant-1',
    participantRole: 'PARTICIPANT',
    secret: 'secret',
  })
  const ctx = {
    logger: { info: vi.fn(), error: vi.fn() },
  } as unknown as Parameters<typeof processPeerInstructionRevisionMessage>[1]

  beforeEach(async () => {
    await redis.flushdb()
    vi.clearAllMocks()
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity,
      response: { value: 'initial' },
      instanceMeta: { type: 'FREE_TEXT', restrictions: { maxLength: 20 } },
    })
    await openPeerInstructionRevisionAttempt({
      redis,
      scope,
      instanceIds: [101],
    })
  })

  afterAll(async () => {
    await redis.quit()
  })

  it('stores one normalized revision without touching scoring namespaces', async () => {
    const event: PeerInstructionRevisionEvent = {
      ...scope,
      messageId: 'message-1',
    }
    await registerPeerInstructionRevisionMessage({
      redis,
      event,
      instanceId: 101,
      identity,
      response: { value: '  revised  ' },
      responseTimestamp: 1000,
    })

    await processPeerInstructionRevisionMessage(event, ctx, redis)
    await processPeerInstructionRevisionMessage(event, ctx, redis)

    expect(await readPeerInstructionAttemptStatus({ redis, scope })).toEqual({
      ingress: 'open',
      accepted: 1,
      terminal: 1,
      failed: 0,
    })
    expect(
      await readPeerInstructionResponseMaps({
        redis,
        scope,
        instanceId: 101,
      })
    ).toEqual({
      initial: { [identity]: JSON.stringify({ value: 'initial' }) },
      revised: { [identity]: JSON.stringify({ value: 'revised' }) },
    })
    expect(await redis.keys('lq:*')).toEqual([])
  })

  it('marks invalid work terminal without storing a revised answer', async () => {
    const event: PeerInstructionRevisionEvent = {
      ...scope,
      messageId: 'message-1',
    }
    await registerPeerInstructionRevisionMessage({
      redis,
      event,
      instanceId: 101,
      identity,
      response: { value: 'this response is longer than twenty characters' },
      responseTimestamp: 1000,
    })

    expect(
      await processPeerInstructionRevisionMessage(event, ctx, redis)
    ).toEqual({ status: 400 })
    expect(await readPeerInstructionAttemptStatus({ redis, scope })).toEqual({
      ingress: 'open',
      accepted: 1,
      terminal: 1,
      failed: 1,
    })
  })

  it('has no scoring, persistence, or assessment dependency', async () => {
    const source = await readFile(
      new URL('../src/processors/peerInstructionProcessor.ts', import.meta.url),
      'utf8'
    )
    expect(source).not.toContain('@klicker-uzh/grading')
    expect(source).not.toContain('updateLeaderboards')
    expect(source).not.toContain('@klicker-uzh/prisma')
    expect(source).not.toContain('assessmentRedis')
  })
})

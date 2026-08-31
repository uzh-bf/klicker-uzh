import type { PeerInstructionRevisionEvent } from '@klicker-uzh/types'
import {
  issuePeerInstructionAnonymousToken,
  openPeerInstructionRevisionAttempt,
  readPeerInstructionAttemptStatus,
  signJWT,
} from '@klicker-uzh/util'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { submitPeerInstructionRevision } from '../src/peerInstruction.js'

const redisPort = Number(process.env.PEER_INSTRUCTION_TEST_REDIS_PORT)
const describeRedis = Number.isInteger(redisPort) ? describe : describe.skip

describeRedis('Peer Instruction response API', () => {
  const redis = new Redis({ host: '127.0.0.1', port: redisPort })
  const scope = {
    liveQuizId: 'quiz-1',
    blockId: 10,
    originalExecution: 2,
    attempt: 1 as const,
  }
  const payload = {
    ...scope,
    instanceId: 101,
    response: { value: 'revised' },
  }

  beforeEach(async () => {
    await redis.flushdb()
    await openPeerInstructionRevisionAttempt({
      redis,
      scope,
      instanceIds: [101],
    })
  })

  afterAll(async () => {
    await redis.quit()
  })

  it('publishes only an opaque event pointer and deduplicates concurrency', async () => {
    const token = await signJWT(
      { sub: 'participant-1', role: 'PARTICIPANT' },
      'secret'
    )
    const published: PeerInstructionRevisionEvent[] = []
    const pushEvent = vi.fn(async (_name, event) => {
      published.push(event)
    })

    const results = await Promise.all([
      submitPeerInstructionRevision({
        payload,
        cookie: `participant_token=${token}`,
        redis,
        appSecret: 'secret',
        pushEvent,
      }),
      submitPeerInstructionRevision({
        payload,
        cookie: `participant_token=${token}`,
        redis,
        appSecret: 'secret',
        pushEvent,
      }),
    ])
    expect(results.map((result) => result.status).sort()).toEqual([200, 208])
    expect(published).toHaveLength(1)
    expect(Object.keys(published[0]!).sort()).toEqual([
      'attempt',
      'blockId',
      'liveQuizId',
      'messageId',
      'originalExecution',
    ])
    expect(JSON.stringify(published[0])).not.toContain('participant-1')
    expect(JSON.stringify(published[0])).not.toContain('revised')
  })

  it('accepts only server-registered anonymous pairing tokens', async () => {
    const invalid = await submitPeerInstructionRevision({
      payload: {
        ...payload,
        pairingToken: 'client-selected-token-value-123456',
      },
      redis,
      appSecret: 'secret',
      pushEvent: vi.fn(async () => undefined),
    })
    expect(invalid.status).toBe(401)

    const pairingToken = await issuePeerInstructionAnonymousToken(redis, scope)
    const valid = await submitPeerInstructionRevision({
      payload: { ...payload, pairingToken },
      redis,
      appSecret: 'secret',
      pushEvent: vi.fn(async () => undefined),
    })
    expect(valid.status).toBe(200)
  })

  it('releases the claim after publication failure so the response can be retried', async () => {
    const token = await signJWT(
      { sub: 'participant-1', role: 'PARTICIPANT' },
      'secret'
    )
    const failed = await submitPeerInstructionRevision({
      payload,
      cookie: `participant_token=${token}`,
      redis,
      appSecret: 'secret',
      pushEvent: vi.fn(async () => {
        throw new Error('queue unavailable')
      }),
    })
    expect(failed.status).toBe(503)
    expect(await readPeerInstructionAttemptStatus({ redis, scope })).toEqual({
      ingress: 'open',
      accepted: 0,
      terminal: 0,
      failed: 0,
    })

    const retry = await submitPeerInstructionRevision({
      payload,
      cookie: `participant_token=${token}`,
      redis,
      appSecret: 'secret',
      pushEvent: vi.fn(async () => undefined),
    })
    expect(retry).toMatchObject({
      status: 200,
      body: { status: 'ok' },
    })
    expect(await readPeerInstructionAttemptStatus({ redis, scope })).toEqual({
      ingress: 'open',
      accepted: 1,
      terminal: 0,
      failed: 0,
    })
  })
})

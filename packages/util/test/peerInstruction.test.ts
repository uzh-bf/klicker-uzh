import type { PeerInstructionRevisionEvent } from '@klicker-uzh/types'
import { Redis } from 'ioredis'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  clearPeerInstructionTransientState,
  completePeerInstructionRevisionMessage,
  createPeerInstructionParticipantIdentity,
  getPeerInstructionAnonymousIdentity,
  issuePeerInstructionAnonymousToken,
  openPeerInstructionRevisionAttempt,
  readPeerInstructionAttemptStatus,
  readPeerInstructionResponseMaps,
  recordPeerInstructionInitialResponse,
  registerPeerInstructionRevisionMessage,
  sealPeerInstructionRevisionAttempt,
} from '../src/peerInstruction.js'

const redisPort = Number(process.env.PEER_INSTRUCTION_TEST_REDIS_PORT)
const describeRedis = Number.isInteger(redisPort) ? describe : describe.skip

describeRedis('Peer Instruction transient state', () => {
  const redis = new Redis({ host: '127.0.0.1', port: redisPort })
  const scope = {
    liveQuizId: 'quiz-1',
    blockId: 10,
    originalExecution: 2,
    attempt: 1 as const,
  }

  beforeEach(async () => {
    await redis.flushdb()
  })

  afterAll(async () => {
    await redis.quit()
  })

  it('scopes identities and preserves the non-renewing hard deadline', async () => {
    const participantIdentity = createPeerInstructionParticipantIdentity({
      scope,
      participantId: 'participant-1',
      participantRole: 'PARTICIPANT',
      secret: 'secret',
    })
    expect(participantIdentity).not.toContain('participant-1')
    expect(
      createPeerInstructionParticipantIdentity({
        scope: { ...scope, originalExecution: 3 },
        participantId: 'participant-1',
        participantRole: 'PARTICIPANT',
        secret: 'secret',
      })
    ).not.toBe(participantIdentity)

    const token = await issuePeerInstructionAnonymousToken(redis, scope)
    const anonymousIdentity = getPeerInstructionAnonymousIdentity(token)
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity: anonymousIdentity,
      anonymousIdentity,
      response: { value: 'first' },
      instanceMeta: { type: 'FREE_TEXT' },
    })
    const deadline = await redis.hget('pi:quiz-1:b:10:e:2:meta', 'expiresAt')
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity: participantIdentity,
      response: { value: 'second' },
      instanceMeta: { type: 'FREE_TEXT' },
    })
    expect(await redis.hget('pi:quiz-1:b:10:e:2:meta', 'expiresAt')).toBe(
      deadline
    )
  })

  it('accepts one concurrent revision per identity and drains exactly once', async () => {
    const identity = createPeerInstructionParticipantIdentity({
      scope,
      participantId: 'participant-1',
      participantRole: 'PARTICIPANT',
      secret: 'secret',
    })
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity,
      response: { choices: [{ ix: 0, selected: true }] },
      instanceMeta: { type: 'SC' },
    })
    await openPeerInstructionRevisionAttempt({
      redis,
      scope,
      instanceIds: [101],
    })

    const events: PeerInstructionRevisionEvent[] = [
      { ...scope, messageId: 'message-1' },
      { ...scope, messageId: 'message-2' },
    ]
    const registrations = await Promise.all(
      events.map((event) =>
        registerPeerInstructionRevisionMessage({
          redis,
          event,
          instanceId: 101,
          identity,
          response: { choices: [{ ix: 1, selected: true }] },
          responseTimestamp: 1000,
        })
      )
    )
    expect(registrations.sort()).toEqual(['accepted', 'duplicate'])

    const acceptedEvent = events[registrations.indexOf('accepted')]!
    expect(
      await completePeerInstructionRevisionMessage({
        redis,
        event: acceptedEvent,
        response: { choices: [{ ix: 1, selected: true }] },
      })
    ).toBe(true)
    expect(
      await completePeerInstructionRevisionMessage({
        redis,
        event: acceptedEvent,
        response: { choices: [{ ix: 1, selected: true }] },
      })
    ).toBe(false)
    expect(await sealPeerInstructionRevisionAttempt({ redis, scope })).toEqual({
      ingress: 'sealed',
      accepted: 1,
      terminal: 1,
      failed: 0,
    })
    expect(
      await registerPeerInstructionRevisionMessage({
        redis,
        event: { ...scope, messageId: 'message-3' },
        instanceId: 101,
        identity: 'participant:other',
        response: { choices: [{ ix: 1, selected: true }] },
        responseTimestamp: 1001,
      })
    ).toBe('sealed')
  })

  it('opens one replacement without changing the initial response map', async () => {
    const identity = 'participant:one'
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity,
      response: { value: 'initial' },
      instanceMeta: { type: 'FREE_TEXT' },
    })
    await openPeerInstructionRevisionAttempt({
      redis,
      scope,
      instanceIds: [101],
    })
    await sealPeerInstructionRevisionAttempt({ redis, scope })

    const replacementScope = { ...scope, attempt: 2 as const }
    expect(
      await openPeerInstructionRevisionAttempt({
        redis,
        scope: replacementScope,
        instanceIds: [101],
      })
    ).toBe(true)
    expect(
      await openPeerInstructionRevisionAttempt({
        redis,
        scope: replacementScope,
        instanceIds: [101],
      })
    ).toBe(false)
    expect(
      await readPeerInstructionResponseMaps({
        redis,
        scope: replacementScope,
        instanceId: 101,
      })
    ).toEqual({
      initial: { [identity]: JSON.stringify({ value: 'initial' }) },
      revised: {},
    })
  })

  it('removes every registered key on hard cleanup', async () => {
    await recordPeerInstructionInitialResponse({
      redis,
      scope,
      instanceId: 101,
      identity: 'participant:one',
      response: { value: 'initial' },
      instanceMeta: { type: 'FREE_TEXT' },
    })
    await openPeerInstructionRevisionAttempt({
      redis,
      scope,
      instanceIds: [101],
    })
    expect(
      await readPeerInstructionAttemptStatus({ redis, scope })
    ).not.toBeNull()

    await clearPeerInstructionTransientState({ redis, scope })
    const remaining = await redis.keys('pi:quiz-1:b:10:e:2:*')
    expect(remaining).toEqual([])
  })
})

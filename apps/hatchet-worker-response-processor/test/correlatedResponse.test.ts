import {
  LiveQuizRespondentType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedVoteKey,
  encryptCorrelatedResponseEvent,
  type CorrelatedResponseEventMessage,
} from '@klicker-uzh/util'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import {
  applyCorrelatedRedisMutations,
  buildCorrelatedResponseCreateData,
  CorrelatedResponseIdentityError,
  CorrelatedResponseProcessingBusyError,
  getCorrelatedProcessedKey,
  isPersistedResponseRetry,
  prepareCorrelatedMessageProcessing,
  prepareCorrelatedResponseProcessing,
  releaseCorrelatedProcessingLock,
  resolveAggregateResponseInstanceInfo,
  resolveCorrelatedResponseDelivery,
  resolveCorrelatedResponseInstanceInfo,
  resolveCorrelatedResponseOwner,
  settleCorrelatedResponseOutbox,
  validateCorrelatedRedisHashKeys,
} from '../src/processors/correlatedResponse.js'
import { RedisHashMutationBuffer } from '../src/processors/responseEffects.js'

type RespondentRow = {
  id: string
  liveQuizId: string
  type: LiveQuizRespondentType
  verificationSecretHash: string | null
}

class MemoryProcessingRedis {
  private readonly hashes = new Map<string, Map<string, string>>()
  private readonly strings = new Map<string, string>()
  private readonly forcedTypes = new Map<string, string>()

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null
  }

  async get(key: string) {
    return this.strings.get(key) ?? null
  }

  async set(
    key: string,
    value: string,
    _expiryMode: 'PX',
    _time: number,
    _setMode: 'NX'
  ) {
    if (this.strings.has(key)) return null
    this.strings.set(key, value)
    return 'OK' as const
  }

  async eval(
    _script: string,
    _numberOfKeys: number,
    key: string,
    expectedValue: string
  ) {
    if (this.strings.get(key) !== expectedValue) return 0
    return this.strings.delete(key) ? 1 : 0
  }

  async type(key: string) {
    return (
      this.forcedTypes.get(key) ??
      (this.hashes.has(key)
        ? 'hash'
        : this.strings.has(key)
          ? 'string'
          : 'none')
    )
  }

  setHashValue(key: string, field: string, value: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>()
    hash.set(field, value)
    this.hashes.set(key, hash)
  }

  forceType(key: string, type: string) {
    this.forcedTypes.set(key, type)
  }
}

function createDatabase({
  participantIds = [],
  respondentRows = [],
}: {
  participantIds?: string[]
  respondentRows?: RespondentRow[]
} = {}) {
  const respondents = new Map(respondentRows.map((row) => [row.id, row]))

  return {
    database: {
      participant: {
        findUnique: async ({ where }: any) =>
          participantIds.includes(where.id) ? { id: where.id } : null,
      },
      liveQuizRespondent: {
        findUnique: async ({ where }: any) => respondents.get(where.id) ?? null,
      },
    } as any,
  }
}

describe('resolveCorrelatedResponseOwner', () => {
  it('accepts an admitted participant identity that still exists', async () => {
    const liveQuizId = randomUUID()
    const participantId = randomUUID()
    const { database } = createDatabase({
      participantIds: [participantId],
    })

    const owner = await resolveCorrelatedResponseOwner({
      acceptedIdentity: {
        kind: 'participant',
        id: participantId,
        identityKey: `participant:${participantId}`,
      },
      liveQuizId,
      database,
    })

    assert.deepEqual(owner, {
      kind: 'participant',
      id: participantId,
      identityKey: `participant:${participantId}`,
    })
  })

  it('accepts an admitted temporary identity after leaderboard logout', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId,
          type: LiveQuizRespondentType.TEMPORARY_PSEUDONYM,
          verificationSecretHash: null,
        },
      ],
    })

    const owner = await resolveCorrelatedResponseOwner({
      acceptedIdentity: {
        kind: 'temporary',
        id: respondentId,
        identityKey: `respondent:${respondentId}`,
      },
      liveQuizId,
      database,
    })

    assert.equal(owner.kind, 'temporary')
    assert.equal(owner.id, respondentId)
  })

  it('rejects a temporary identity that was never admitted', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: {
          kind: 'temporary',
          id: respondentId,
          identityKey: `respondent:${respondentId}`,
        },
        liveQuizId,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('accepts an anonymous identity admitted while its token was valid', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId,
          type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
          verificationSecretHash: 'acceptance-time-token-hash',
        },
      ],
    })

    const owner = await resolveCorrelatedResponseOwner({
      acceptedIdentity: {
        kind: 'anonymous',
        id: respondentId,
        identityKey: `respondent:${respondentId}`,
      },
      liveQuizId,
      database,
    })

    assert.equal(owner.kind, 'anonymous')
    assert.equal(owner.id, respondentId)
  })

  it('rejects an admitted respondent scoped to another quiz', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId: randomUUID(),
          type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
          verificationSecretHash: 'hash',
        },
      ],
    })

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
          identityKey: `respondent:${respondentId}`,
        },
        liveQuizId,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('rejects an acceptance identity with a mismatched key', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
          identityKey: `respondent:${randomUUID()}`,
        },
        liveQuizId,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })
})

describe('correlated response persistence helpers', () => {
  it('uses the accepted metadata snapshot even after an instance restart', () => {
    const acceptedInstanceInfo = {
      type: 'SC',
      blockExecution: '3',
      sessionBlockId: randomUUID(),
    }

    assert.deepEqual(
      resolveCorrelatedResponseInstanceInfo(acceptedInstanceInfo),
      acceptedInstanceInfo
    )
    assert.equal(resolveAggregateResponseInstanceInfo({}), undefined)
  })

  it('settles the pending outbox entry idempotently', async () => {
    const updateCalls: any[] = []

    await settleCorrelatedResponseOutbox({
      database: {
        liveQuizPendingResponse: {
          updateMany: async (args: any) => {
            updateCalls.push(args)
            return { count: 1 }
          },
        },
      } as any,
      messageId: 'message-1',
    })

    assert.equal(updateCalls.length, 1)
    assert.deepEqual(updateCalls[0], {
      where: { id: 'message-1', settledAt: null },
      data: {
        eventPayload: null,
        nextDeliveryAt: null,
        settledAt: updateCalls[0].data.settledAt,
      },
    })
    assert.ok(updateCalls[0].data.settledAt instanceof Date)
  })

  it('loads correlated deliveries only from a matching outbox row', async () => {
    const messageId = randomUUID()
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const identityKey = `respondent:${respondentId}` as const
    const message: CorrelatedResponseEventMessage = {
      messageId,
      sessionId: liveQuizId,
      instanceId: '42',
      response: { value: 'accepted' },
      responseTimestamp: 123,
      acceptedIdentity: {
        kind: 'anonymous',
        id: respondentId,
        identityKey,
      },
      correlatedClaim: {
        key: buildCorrelatedVoteKey({
          liveQuizId,
          instanceId: '42',
          blockExecution: '3',
          identityKey,
        }),
        identityKey,
      },
      instanceInfo: {
        type: 'FREE_TEXT',
        blockExecution: '3',
        sessionBlockId: randomUUID(),
      },
    }
    const eventPayload = encryptCorrelatedResponseEvent({
      message,
      secret: 'test-secret',
    })

    assert.equal(
      await resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: { findUnique: async () => null },
        } as any,
        messageId,
        secret: 'test-secret',
      }),
      null
    )
    assert.deepEqual(
      await resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({ eventPayload, settledAt: null }),
          },
        } as any,
        messageId,
        secret: 'test-secret',
      }),
      message
    )
    await assert.rejects(
      resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({ eventPayload, settledAt: null }),
          },
        } as any,
        messageId: randomUUID(),
        secret: 'test-secret',
      }),
      /outbox message id mismatch/
    )
    assert.equal(
      await resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({
              eventPayload: null,
              settledAt: new Date(),
            }),
          },
        } as any,
        messageId,
        secret: 'test-secret',
      }),
      null
    )
  })

  it('builds a participant response without respondent identifiers', () => {
    const participantId = randomUUID()
    const submittedAt = Date.now()

    const data = buildCorrelatedResponseCreateData({
      owner: {
        kind: 'participant',
        id: participantId,
        identityKey: `participant:${participantId}`,
      },
      instanceId: 42,
      blockExecution: 3,
      response: { choices: [{ ix: 0, selected: true }] },
      submittedAt,
      correctnessPercentage: 0.5,
      basePoints: 10,
      correctnessPoints: 5,
      bonusPoints: 2,
    })

    assert.equal(data.correctness, ResponseCorrectness.PARTIAL)
    assert.deepEqual(data.participant, { connect: { id: participantId } })
    assert.equal('respondent' in data, false)
    assert.equal(data.submittedAt.getTime(), submittedAt)
  })

  it('builds an anonymous response without participant identifiers', () => {
    const respondentId = randomUUID()
    const data = buildCorrelatedResponseCreateData({
      owner: {
        kind: 'anonymous',
        id: respondentId,
        identityKey: `respondent:${respondentId}`,
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: Date.now(),
      correctnessPercentage: null,
      basePoints: 0,
      correctnessPoints: 0,
      bonusPoints: 0,
    })

    assert.deepEqual(data.respondent, { connect: { id: respondentId } })
    assert.equal('participant' in data, false)
  })

  it('recognizes only the owning event as a persisted retry', () => {
    const timestamp = Date.now()
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp,
        claimOwnerMessageId: 'message-1',
        messageId: 'message-1',
      }),
      true
    )
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp + 1,
        claimOwnerMessageId: 'message-1',
        messageId: 'message-1',
      }),
      false
    )
  })

  it('scopes the processed marker to one execution', () => {
    assert.equal(
      getCorrelatedProcessedKey({
        liveQuizId: 'quiz',
        instanceId: '7',
        blockExecution: 2,
      }),
      'lq:quiz:i:7:correlatedProcessed:2'
    )
  })

  it('serializes overlapping processing of the same response', async () => {
    const redis = new MemoryProcessingRedis()
    const database = {
      liveQuizResponse: { findUnique: async () => null },
    } as any
    const params = {
      redis,
      database,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous' as const,
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 123,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    }

    const first = await prepareCorrelatedResponseProcessing(params)
    assert.equal(first.status, 'process')
    await assert.rejects(
      prepareCorrelatedResponseProcessing(params),
      CorrelatedResponseProcessingBusyError
    )

    if (first.status === 'process') {
      assert.equal(
        await releaseCorrelatedProcessingLock({
          redis,
          lockKey: first.lockKey,
          messageId: params.messageId,
        }),
        true
      )
    }
  })

  it('resumes aggregation after the response row was persisted', async () => {
    const timestamp = Date.now()
    const result = await prepareCorrelatedResponseProcessing({
      redis: new MemoryProcessingRedis(),
      database: {
        liveQuizResponse: {
          findUnique: async () => ({ submittedAt: new Date(timestamp) }),
        },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'participant',
        id: 'participant-id',
        identityKey: 'participant:participant-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: timestamp,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    })

    assert.equal(result.status, 'process')
    if (result.status === 'process') {
      assert.equal(result.responsePersisted, true)
    }
  })

  it('rejects a different event when a response row already exists', async () => {
    const result = await prepareCorrelatedResponseProcessing({
      redis: new MemoryProcessingRedis(),
      database: {
        liveQuizResponse: {
          findUnique: async () => ({ submittedAt: new Date(123) }),
        },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 456,
      claimOwnerMessageId: 'message-2',
      messageId: 'message-2',
    })

    assert.deepEqual(result, { status: 'duplicate' })
  })

  it('returns a completed response without acquiring a processing lock', async () => {
    const redis = new MemoryProcessingRedis()
    redis.setHashValue('processed-key', 'respondent:respondent-id', 'message-1')

    const result = await prepareCorrelatedResponseProcessing({
      redis,
      database: {
        liveQuizResponse: { findUnique: async () => null },
      } as any,
      processedKey: 'processed-key',
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      responseTimestamp: 123,
      claimOwnerMessageId: 'message-1',
      messageId: 'message-1',
    })

    assert.deepEqual(result, { status: 'processed' })
  })

  it('rejects non-hash aggregate keys before writes are executed', async () => {
    const redis = new MemoryProcessingRedis()
    redis.forceType('invalid-key', 'string')

    await assert.rejects(
      validateCorrelatedRedisHashKeys({
        redis,
        keys: ['valid-key', 'invalid-key'],
      }),
      /Expected Redis hash/
    )
  })

  it('processes an admitted identity without revalidating its browser token', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const messageId = randomUUID()
    const identityKey = `respondent:${respondentId}` as const
    const claimKey = buildCorrelatedVoteKey({
      liveQuizId,
      instanceId: '42',
      blockExecution: '3',
      identityKey,
    })
    const redis = new MemoryProcessingRedis()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId,
          type: LiveQuizRespondentType.ANONYMOUS_CORRELATED,
          verificationSecretHash: 'acceptance-time-token-hash',
        },
      ],
    })
    ;(database as any).liveQuizResponse = {
      findUnique: async () => null,
    }

    const result = await prepareCorrelatedMessageProcessing({
      redis,
      database,
      message: {
        messageId,
        sessionId: liveQuizId,
        instanceId: '42',
        responseTimestamp: 123,
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
          identityKey,
        },
        correlatedClaim: { key: claimKey, identityKey },
      },
      blockExecution: '3',
      sessionBlockId: randomUUID(),
    })

    assert.equal(result.status, 'process')
    if (result.status === 'process') {
      assert.equal(result.state.owner.id, respondentId)
      assert.equal(result.state.blockExecution, 3)
    }
  })

  it('buffers typed Redis mutations for one atomic apply operation', async () => {
    const buffer = new RedisHashMutationBuffer()
    buffer.hincrby('results', 'participants', 1)
    buffer.hset('responses', 'respondent', 'answer')
    buffer.hsetnx('info', 'firstResponseReceivedAt', 123)

    let args: Array<number | string> = []
    const result = await applyCorrelatedRedisMutations({
      redis: {
        eval: async (
          _script: string,
          _numberOfKeys: number,
          ...received: Array<number | string>
        ) => {
          args = received
          return 1
        },
      },
      mutations: buffer.mutations,
      processedKey: 'processed',
      identityKey: 'respondent:abc',
      messageId: 'message-1',
    })

    assert.equal(result, 'applied')
    assert.deepEqual(JSON.parse(String(args[1])), buffer.mutations)
    assert.deepEqual(args.slice(2), ['respondent:abc', 'message-1'])
  })
})

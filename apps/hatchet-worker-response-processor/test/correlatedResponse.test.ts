import {
  LiveQuizRespondentType,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
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
  CorrelatedResponseMutationLimitError,
  getCorrelatedProcessedKey,
  isPersistedResponseRetry,
  persistAcceptedCorrelatedResponse,
  prepareCorrelatedMessageProcessing,
  resolveCorrelatedResponseDelivery,
  resolveCorrelatedResponseOwner,
  settleCorrelatedResponseOutbox,
} from '../src/processors/correlatedResponse.js'

type RespondentRow = {
  id: string
  liveQuizId: string
  type: LiveQuizRespondentType
  verificationSecretHash: string | null
}

class MemoryProcessingRedis {
  private readonly hashes = new Map<string, Map<string, string>>()

  async hget(key: string, field: string) {
    return this.hashes.get(key)?.get(field) ?? null
  }

  setHashValue(key: string, field: string, value: string) {
    const hash = this.hashes.get(key) ?? new Map<string, string>()
    hash.set(field, value)
    this.hashes.set(key, hash)
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
        },
        liveQuizId,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })
})

describe('correlated response persistence helpers', () => {
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
            findUnique: async () => ({
              eventPayload,
              responseKey: buildCorrelatedResponseKey({
                liveQuizId,
                instanceId: '42',
                blockExecution: '3',
                identityKey,
              }),
              settledAt: null,
            }),
          },
        } as any,
        messageId,
        secret: 'test-secret',
      }),
      {
        message,
        responseKey: buildCorrelatedResponseKey({
          liveQuizId,
          instanceId: '42',
          blockExecution: '3',
          identityKey,
        }),
      }
    )
    await assert.rejects(
      resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({
              eventPayload,
              responseKey: 'response-key',
              settledAt: null,
            }),
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
              responseKey: 'response-key',
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

  it('recognizes a persisted retry by its accepted timestamp', () => {
    const timestamp = Date.now()
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp,
      }),
      true
    )
    assert.equal(
      isPersistedResponseRetry({
        existingSubmittedAt: new Date(timestamp),
        responseTimestamp: timestamp + 1,
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

  it('persists an accepted response after normal quiz end without late Redis effects', async () => {
    let created = false
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                blockExecution: 3,
                blockStatus: 'EXECUTED',
                isAssessmentEnabled: false,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'ENDED',
              },
            ],
            liveQuizResponse: {
              findUnique: async () => null,
              create: async () => {
                created = true
              },
            },
          }),
        liveQuizResponse: {
          findUnique: async () => null,
        },
      } as any,
      liveQuizId: randomUUID(),
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: 456,
      correctnessPercentage: 1,
      basePoints: 1,
      correctnessPoints: 2,
      bonusPoints: 3,
    })

    assert.equal(created, true)
    assert.deepEqual(result, {
      status: 'created',
      applyRedisEffects: false,
    })
  })

  it('does not persist after the correlated quiz was aborted', async () => {
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                blockExecution: 3,
                blockStatus: 'SCHEDULED',
                isAssessmentEnabled: false,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'DRAFT',
              },
            ],
            liveQuizResponse: {
              findUnique: async () => assert.fail('must not inspect responses'),
              create: async () => assert.fail('must not create a response'),
            },
          }),
        liveQuizResponse: {
          findUnique: async () => null,
        },
      } as any,
      liveQuizId: randomUUID(),
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: 456,
      correctnessPercentage: 1,
      basePoints: 1,
      correctnessPoints: 2,
      bonusPoints: 3,
    })

    assert.equal(result, 'inactive')
  })

  it('does not persist an event from an earlier block execution', async () => {
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                blockExecution: 4,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'PUBLISHED',
              },
            ],
            liveQuizResponse: {
              findUnique: async () => assert.fail('must not inspect responses'),
              create: async () => assert.fail('must not create a response'),
            },
          }),
        liveQuizResponse: {
          findUnique: async () => null,
        },
      } as any,
      liveQuizId: randomUUID(),
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: 456,
      correctnessPercentage: 1,
      basePoints: 1,
      correctnessPoints: 2,
      bonusPoints: 3,
    })

    assert.equal(result, 'inactive')
  })

  it('recovers a same-event uniqueness collision after the transaction rolls back', async () => {
    const timestamp = Date.now()
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async () => {
          throw { code: 'P2002' }
        },
        liveQuizResponse: {
          findUnique: async () => ({ submittedAt: new Date(timestamp) }),
        },
      } as any,
      liveQuizId: randomUUID(),
      owner: {
        kind: 'participant',
        id: 'participant-id',
        identityKey: 'participant:participant-id',
      },
      instanceId: 42,
      blockExecution: 3,
      response: { value: 'answer' },
      submittedAt: timestamp,
      correctnessPercentage: 1,
      basePoints: 1,
      correctnessPoints: 2,
      bonusPoints: 3,
    })

    assert.deepEqual(result, {
      status: 'persisted',
      applyRedisEffects: false,
    })
  })

  it('processes an admitted identity without revalidating its browser token', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const messageId = randomUUID()
    const identityKey = `respondent:${respondentId}` as const
    const responseKey = buildCorrelatedResponseKey({
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
        },
      },
      blockExecution: '3',
      sessionBlockId: randomUUID(),
      responseKey,
    })

    assert.equal(result.status, 'process')
    if (result.status === 'process') {
      assert.equal(result.state.owner.id, respondentId)
      assert.equal(result.state.blockExecution, 3)
    }
  })

  it('applies a typed Redis effect plan atomically', async () => {
    const mutations = [
      {
        command: 'hincrby' as const,
        key: 'results',
        field: 'participants',
        value: '1',
      },
      {
        command: 'hset' as const,
        key: 'responses',
        field: 'respondent',
        value: 'answer',
      },
      {
        command: 'hsetnx' as const,
        key: 'info',
        field: 'firstResponseReceivedAt',
        value: '123',
      },
    ]
    let args: Array<number | string> = []
    const result = await applyCorrelatedRedisMutations({
      redis: {
        eval: async (
          script: string,
          numberOfKeys: number,
          ...received: Array<number | string>
        ) => {
          assert.match(script, /currentBlockExecution/)
          assert.equal(numberOfKeys, 2)
          args = received
          return 1
        },
      },
      mutations,
      processedKey: 'processed',
      instanceInfoKey: 'instance-info',
      blockExecution: 3,
      identityKey: 'respondent:abc',
      messageId: 'message-1',
    })

    assert.equal(result, 'applied')
    assert.deepEqual(args.slice(0, 2), ['processed', 'instance-info'])
    assert.deepEqual(JSON.parse(String(args[2])), mutations)
    assert.deepEqual(args.slice(3), ['respondent:abc', 'message-1', '3'])
  })

  it('rejects an excessive Redis mutation plan before calling Redis', async () => {
    let called = false
    await assert.rejects(
      applyCorrelatedRedisMutations({
        redis: {
          eval: async () => {
            called = true
            return 1
          },
        },
        mutations: Array.from({ length: 10_001 }, () => ({
          command: 'hincrby' as const,
          key: 'results',
          field: 'participants',
          value: '1',
        })),
        processedKey: 'processed',
        instanceInfoKey: 'instance-info',
        blockExecution: 3,
        identityKey: 'respondent:abc',
        messageId: 'message-1',
      }),
      CorrelatedResponseMutationLimitError
    )
    assert.equal(called, false)
  })
})

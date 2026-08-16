import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { prisma } from '@klicker-uzh/prisma'
import {
  ElementBlockStatus,
  ElementInstanceType,
  ElementType,
  LiveQuizResponseCollectionMode,
  PublicationStatus,
  ResponseCorrectness,
} from '@klicker-uzh/prisma/client'
import {
  buildCorrelatedResponseKey,
  type CorrelatedResponseEventMessage,
  encryptCorrelatedResponseEvent,
} from '@klicker-uzh/util'
import {
  applyCorrelatedRedisMutations,
  applyCorrelatedRedisMutationsWithFence,
  buildCorrelatedResponseCreateData,
  CorrelatedResponseIdentityError,
  CorrelatedResponseMutationLimitError,
  getCorrelatedProcessedKey,
  persistAcceptedCorrelatedResponse,
  prepareCorrelatedMessageProcessing,
  resolveCorrelatedResponseDelivery,
  resolveCorrelatedResponseOwner,
  settleCorrelatedResponseOutbox,
} from '../src/processors/correlatedResponse.js'

type RespondentRow = {
  id: string
  liveQuizId: string
  publicationGeneration: number
  finalizedAt: Date | null
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
  respondentRows = [],
}: {
  respondentRows?: RespondentRow[]
} = {}) {
  return {
    database: {
      liveQuizRespondent: {
        findUnique: async ({ where }: any) => {
          const scope = where.id_liveQuizId_publicationGeneration
          return respondentRows.find(
            (row) =>
              row.id === scope.id &&
              row.liveQuizId === scope.liveQuizId &&
              row.publicationGeneration === scope.publicationGeneration
          )
        },
      },
    } as any,
  }
}

describe('resolveCorrelatedResponseOwner', () => {
  it('rejects a participant identity from the correlated worker contract', async () => {
    const liveQuizId = randomUUID()
    const participantId = randomUUID()
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: { kind: 'participant', id: participantId },
        liveQuizId,
        publicationGeneration: 3,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('rejects a temporary leaderboard identity from the correlated worker contract', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase()

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: { kind: 'temporary', id: respondentId },
        liveQuizId,
        publicationGeneration: 3,
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
          publicationGeneration: 3,
          finalizedAt: null,
        },
      ],
    })

    const owner = await resolveCorrelatedResponseOwner({
      acceptedIdentity: {
        kind: 'anonymous',
        id: respondentId,
      },
      liveQuizId,
      publicationGeneration: 3,
      database,
    })

    assert.equal(owner.kind, 'anonymous')
    assert.equal(owner.id, respondentId)
  })

  it('rejects a respondent after generation finalization', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId,
          publicationGeneration: 3,
          finalizedAt: new Date(),
        },
      ],
    })

    await assert.rejects(
      resolveCorrelatedResponseOwner({
        acceptedIdentity: { kind: 'anonymous', id: respondentId },
        liveQuizId,
        publicationGeneration: 3,
        database,
      }),
      CorrelatedResponseIdentityError
    )
  })

  it('rejects an admitted respondent scoped to another quiz', async () => {
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const { database } = createDatabase({
      respondentRows: [
        {
          id: respondentId,
          liveQuizId: randomUUID(),
          publicationGeneration: 3,
          finalizedAt: null,
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
        publicationGeneration: 3,
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
      publicationGeneration: 3,
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
              publicationGeneration: 3,
              responseKey: buildCorrelatedResponseKey({
                liveQuizId,
                publicationGeneration: 3,
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
          publicationGeneration: 3,
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
              publicationGeneration: 2,
              responseKey: 'response-key',
              settledAt: null,
            }),
          },
        } as any,
        messageId,
        secret: 'test-secret',
      }),
      /outbox generation mismatch/
    )
    await assert.rejects(
      resolveCorrelatedResponseDelivery({
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({
              eventPayload,
              publicationGeneration: 3,
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
              publicationGeneration: 3,
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

  it('builds a respondent response without participant identifiers', () => {
    const respondentId = randomUUID()
    const submittedAt = Date.now()

    const data = buildCorrelatedResponseCreateData({
      owner: {
        kind: 'anonymous',
        id: respondentId,
        identityKey: `respondent:${respondentId}`,
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
    assert.deepEqual(data.respondent, { connect: { id: respondentId } })
    assert.equal('participant' in data, false)
    assert.equal(data.submittedAt.getTime(), 0)
    assert.equal(data.timeSpent, -1)
  })

  it('builds the same respondent shape for anonymous identity', () => {
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

  it('scopes the processed marker to one execution', () => {
    assert.equal(
      getCorrelatedProcessedKey({
        liveQuizId: 'quiz',
        publicationGeneration: 3,
        instanceId: '7',
        blockExecution: 2,
      }),
      'lq:quiz:g:3:i:7:correlatedProcessed:2'
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
                activeBlockId: null,
                blockId: 42,
                blockExecution: 3,
                blockStatus: 'EXECUTED',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
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
      publicationGeneration: 3,
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
                activeBlockId: null,
                blockId: 42,
                blockExecution: 3,
                blockStatus: 'SCHEDULED',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
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
      publicationGeneration: 3,
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

  it('does not apply Redis effects after the quiz activates another block', async () => {
    let created = false
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                activeBlockId: 99,
                blockId: 42,
                blockExecution: 3,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'PUBLISHED',
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
      publicationGeneration: 3,
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

  it('does not persist an event from an earlier block execution', async () => {
    const result = await persistAcceptedCorrelatedResponse({
      database: {
        $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
          callback({
            $queryRaw: async () => [
              {
                activeBlockId: 42,
                blockId: 42,
                blockExecution: 4,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
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
      publicationGeneration: 3,
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
          findFirst: async () => ({ id: 'response-id' }),
        },
      } as any,
      liveQuizId: randomUUID(),
      owner: {
        kind: 'anonymous',
        id: 'respondent-id',
        identityKey: 'respondent:respondent-id',
      },
      instanceId: 42,
      publicationGeneration: 3,
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
      publicationGeneration: 3,
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
          publicationGeneration: 3,
          finalizedAt: null,
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
        publicationGeneration: 3,
        responseTimestamp: 123,
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
        },
      },
      blockExecution: '3',
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

  it('holds the active-block fence until Redis mutations finish', async () => {
    let transactionReturned = false
    let redisCalled = false
    const result = await applyCorrelatedRedisMutationsWithFence({
      database: {
        $transaction: async (
          callback: (transaction: any) => Promise<unknown>
        ) => {
          const value = await callback({
            $queryRaw: async () => [
              {
                activeBlockId: 42,
                blockId: 42,
                blockExecution: 3,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'PUBLISHED',
              },
            ],
          })
          transactionReturned = true
          return value
        },
      } as any,
      redis: {
        eval: async () => {
          redisCalled = true
          assert.equal(transactionReturned, false)
          return 1
        },
      },
      liveQuizId: randomUUID(),
      instanceId: 42,
      publicationGeneration: 3,
      blockExecution: 3,
      mutations: [],
      processedKey: 'processed',
      instanceInfoKey: 'instance-info',
      identityKey: 'respondent:abc',
      messageId: 'message-1',
    })

    assert.equal(redisCalled, true)
    assert.equal(transactionReturned, true)
    assert.equal(result, 'applied')
  })

  it('holds a PostgreSQL transition behind the Redis mutation fence', {
    skip: !process.env.DATABASE_URL,
  }, async () => {
    const database = prisma
    const contender = prisma
    const ownerId = randomUUID()
    const liveQuizId = randomUUID()
    let elementId: number | undefined
    let blockId: number | undefined
    let instanceId: number | undefined
    let releaseRedis!: () => void
    let redisStarted!: () => void
    const redisReleased = new Promise<void>((resolve) => {
      releaseRedis = resolve
    })
    const redisHasStarted = new Promise<void>((resolve) => {
      redisStarted = resolve
    })

    try {
      await database.user.create({
        data: {
          id: ownerId,
          email: `${ownerId}@example.com`,
          shortname: ownerId,
        },
      })
      await database.liveQuiz.create({
        data: {
          id: liveQuizId,
          name: `correlated-fence-${ownerId}`,
          displayName: `correlated-fence-${ownerId}`,
          ownerId,
          status: PublicationStatus.PUBLISHED,
          responseCollectionMode:
            LiveQuizResponseCollectionMode.CORRELATED_EXPORT,
          exportSalt: 'test-export-salt',
        },
      })
      const element = await database.element.create({
        data: {
          name: `correlated-fence-element-${ownerId}`,
          content: '',
          ownerId,
          type: ElementType.FREE_TEXT,
          options: {},
        },
      })
      elementId = element.id
      const block = await database.elementBlock.create({
        data: {
          order: 1,
          execution: 3,
          status: ElementBlockStatus.ACTIVE,
          liveQuizId,
        },
      })
      blockId = block.id
      const instance = await database.elementInstance.create({
        data: {
          type: ElementInstanceType.LIVE_QUIZ,
          elementType: ElementType.FREE_TEXT,
          order: 1,
          options: {},
          elementData: {},
          results: {},
          anonymousResults: {},
          elementId,
          elementBlockId: blockId,
          ownerId,
        },
      })
      instanceId = instance.id
      await database.liveQuiz.update({
        where: { id: liveQuizId },
        data: { activeBlockId: blockId },
      })

      const fenced = applyCorrelatedRedisMutationsWithFence({
        database,
        redis: {
          eval: async () => {
            redisStarted()
            await redisReleased
            return 1
          },
        },
        liveQuizId,
        instanceId,
        publicationGeneration: 0,
        blockExecution: 3,
        mutations: [],
        processedKey: `test:fence:${liveQuizId}:processed`,
        instanceInfoKey: `test:fence:${liveQuizId}:info`,
        identityKey: 'respondent:database-fence',
        messageId: 'database-fence-message',
      })

      await redisHasStarted
      const transition = contender.$transaction(async (transaction) => {
        await transaction.$executeRaw`SET LOCAL lock_timeout = '250ms'`
        await transaction.$executeRaw`
          UPDATE "public"."LiveQuiz"
          SET "activeBlockId" = NULL
          WHERE "id" = ${liveQuizId}::uuid
        `
      })
      try {
        await assert.rejects(transition)
      } finally {
        releaseRedis()
      }

      assert.equal(await fenced, 'applied')
      assert.deepEqual(
        await database.liveQuiz.findUnique({
          where: { id: liveQuizId },
          select: { activeBlockId: true },
        }),
        { activeBlockId: blockId }
      )
    } finally {
      releaseRedis()
      if (instanceId !== undefined) {
        await database.elementInstance.delete({ where: { id: instanceId } })
      }
      if (blockId !== undefined) {
        await database.elementBlock.delete({ where: { id: blockId } })
      }
      if (elementId !== undefined) {
        await database.element.delete({ where: { id: elementId } })
      }
      await database.liveQuiz.delete({ where: { id: liveQuizId } })
      await database.user.delete({ where: { id: ownerId } })
    }
  })

  it('skips Redis mutations when the active block changed before the fence', async () => {
    let redisCalled = false
    const result = await applyCorrelatedRedisMutationsWithFence({
      database: {
        $transaction: async (
          callback: (transaction: any) => Promise<unknown>
        ) =>
          callback({
            $queryRaw: async () => [
              {
                activeBlockId: 99,
                blockId: 42,
                blockExecution: 3,
                blockStatus: 'ACTIVE',
                isAssessmentEnabled: false,
                publicationGeneration: 3,
                responseCollectionMode: 'CORRELATED_EXPORT',
                status: 'PUBLISHED',
              },
            ],
          }),
      } as any,
      redis: {
        eval: async () => {
          redisCalled = true
          return 1
        },
      },
      liveQuizId: randomUUID(),
      instanceId: 42,
      publicationGeneration: 3,
      blockExecution: 3,
      mutations: [],
      processedKey: 'processed',
      instanceInfoKey: 'instance-info',
      identityKey: 'respondent:abc',
      messageId: 'message-1',
    })

    assert.equal(redisCalled, false)
    assert.equal(result, 'inactive')
  })
})

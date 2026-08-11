import {
  buildCorrelatedResponseKey,
  encryptCorrelatedResponseEvent,
} from '@klicker-uzh/util'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { describe, it } from 'node:test'
import { processAggregateResponseMessageWithDependencies } from '../src/processors/aggregateProcessor.js'
import { processCorrelatedResponseMessageWithDependencies } from '../src/processors/correlatedProcessor.js'

function createContext() {
  return {
    logger: {
      error() {},
      info() {},
    },
    cancel() {},
  } as any
}

describe('response processor orchestration', () => {
  it('terminates an aggregate delivery when instance metadata is absent', async () => {
    let pipelineExecuted = false
    const pipeline = {
      discard() {},
      async exec() {
        pipelineExecuted = true
        return []
      },
    }

    const result = await processAggregateResponseMessageWithDependencies(
      {
        messageId: randomUUID(),
        sessionId: randomUUID(),
        instanceId: '42',
        response: { value: 'response' },
        responseTimestamp: 123,
      } as any,
      createContext(),
      {
        database: {} as any,
        redis: {
          pipeline: () => pipeline,
          hgetall: async () => ({}),
        } as any,
      }
    )

    assert.deepEqual(result, { status: 400 })
    assert.equal(pipelineExecuted, false)
  })

  it('settles a terminal correlated delivery', async () => {
    const messageId = randomUUID()
    const respondentId = randomUUID()
    const settledMessageIds: string[] = []
    const eventPayload = encryptCorrelatedResponseEvent({
      message: {
        messageId,
        sessionId: randomUUID(),
        instanceId: 'invalid',
        response: { value: 'response' },
        responseTimestamp: 123,
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
        },
        instanceInfo: {
          type: 'FREE_TEXT',
          blockExecution: '1',
          sessionBlockId: '7',
        },
      },
      secret: 'test-secret',
    })

    const result = await processCorrelatedResponseMessageWithDependencies(
      { messageId },
      createContext(),
      {
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({
              eventPayload,
              responseKey: 'claim',
              settledAt: null,
            }),
            updateMany: async ({ where }: any) => {
              settledMessageIds.push(where.id)
              return { count: 1 }
            },
          },
        } as any,
        redis: {} as any,
        secret: 'test-secret',
      }
    )

    assert.deepEqual(result, { status: 400 })
    assert.deepEqual(settledMessageIds, [messageId])
  })

  it('leaves a correlated delivery unsettled for an operational retry', async () => {
    const messageId = randomUUID()
    const respondentId = randomUUID()
    let settlementCount = 0
    const eventPayload = encryptCorrelatedResponseEvent({
      message: {
        messageId,
        sessionId: randomUUID(),
        instanceId: '42',
        response: { value: 'response' },
        responseTimestamp: 123,
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
        },
        instanceInfo: {
          type: 'FREE_TEXT',
          blockExecution: '1',
          sessionBlockId: randomUUID(),
        },
      },
      secret: 'test-secret',
    })

    await assert.rejects(
      processCorrelatedResponseMessageWithDependencies(
        { messageId },
        createContext(),
        {
          database: {
            liveQuizPendingResponse: {
              findUnique: async () => ({
                eventPayload,
                responseKey: 'claim',
                settledAt: null,
              }),
              updateMany: async () => {
                settlementCount += 1
                return { count: 1 }
              },
            },
            liveQuizRespondent: {
              findUnique: async () => {
                throw new Error('Database unavailable')
              },
            },
          } as any,
          redis: {} as any,
          secret: 'test-secret',
        }
      ),
      /Database unavailable/
    )

    assert.equal(settlementCount, 0)
  })

  it('settles an excessive correlated mutation plan without calling Redis', async () => {
    const messageId = randomUUID()
    const liveQuizId = randomUUID()
    const respondentId = randomUUID()
    const selection = Array.from({ length: 10_000 }, (_, index) => index + 1)
    const identityKey = `respondent:${respondentId}` as const
    const eventPayload = encryptCorrelatedResponseEvent({
      message: {
        messageId,
        sessionId: liveQuizId,
        instanceId: '42',
        response: { selection },
        responseTimestamp: 123,
        acceptedIdentity: {
          kind: 'anonymous',
          id: respondentId,
        },
        instanceInfo: {
          type: 'SELECTION',
          blockExecution: '1',
          sessionBlockId: '7',
          numberOfInputs: String(selection.length),
          selectionAnswerIds: JSON.stringify(selection),
          basePoints: 'false',
          defaultPoints: '10',
          defaultCorrectPoints: '5',
          maxBonusPoints: '45',
          timeToZeroBonus: '20',
          pointsMultiplier: '1',
        },
      },
      secret: 'test-secret',
    })
    let settlementCount = 0
    let redisCalled = false

    const result = await processCorrelatedResponseMessageWithDependencies(
      { messageId },
      createContext(),
      {
        database: {
          liveQuizPendingResponse: {
            findUnique: async () => ({
              eventPayload,
              responseKey: buildCorrelatedResponseKey({
                liveQuizId,
                instanceId: '42',
                blockExecution: '1',
                identityKey,
              }),
              settledAt: null,
            }),
            updateMany: async () => {
              settlementCount += 1
              return { count: 1 }
            },
          },
          liveQuizRespondent: {
            findUnique: async () => ({
              id: respondentId,
              liveQuizId,
              type: 'ANONYMOUS_CORRELATED',
            }),
          },
          liveQuizResponse: {
            findUnique: async () => null,
          },
          $transaction: async (callback: (prisma: any) => Promise<unknown>) =>
            callback({
              $queryRaw: async () => [
                {
                  blockExecution: 1,
                  blockStatus: 'ACTIVE',
                  isAssessmentEnabled: false,
                  responseCollectionMode: 'CORRELATED_EXPORT',
                  status: 'PUBLISHED',
                },
              ],
              liveQuizResponse: {
                findUnique: async () => null,
                create: async () => ({}),
              },
            }),
        } as any,
        redis: {
          hget: async () => null,
          eval: async () => {
            redisCalled = true
            return 1
          },
        } as any,
        secret: 'test-secret',
      }
    )

    assert.deepEqual(result, { status: 400 })
    assert.equal(settlementCount, 1)
    assert.equal(redisCalled, false)
  })
})

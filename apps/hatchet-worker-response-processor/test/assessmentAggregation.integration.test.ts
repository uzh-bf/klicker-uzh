import type { Context, JsonObject } from '@hatchet-dev/typescript-sdk'
import { ElementType } from '@klicker-uzh/prisma/client'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { aggregateAssessmentResponses } from '../src/processors/assessmentAggregation.js'
import { getAssessmentRedis } from '../src/redis.js'

const LIVE_QUIZ_ID = '20000000-0000-4000-8000-000000000001'
const PARTICIPANT_ID = '20000000-0000-4000-8000-000000000002'
const SUBMISSION_ID = '20000000-0000-4000-8000-000000000003'
const BLOCK_ID = '42'
const INSTANCE_ID = '84'

const runRedisTests = Boolean(process.env.REDIS_ASSESSMENT_HOST)

describe.runIf(runRedisTests)('assessment response aggregation', () => {
  const redis = getAssessmentRedis()
  const liveQuizKey = `lq:${LIVE_QUIZ_ID}`
  const instanceKey = `${liveQuizKey}:i:${INSTANCE_ID}`
  const keys = [
    `${instanceKey}:votes`,
    `${instanceKey}:results`,
    `${instanceKey}:responseHashes`,
    `${liveQuizKey}:b:${BLOCK_ID}:lb`,
    `${liveQuizKey}:lb`,
    `${liveQuizKey}:xp`,
  ]
  const message = {
    correlationId: SUBMISSION_ID,
    participantId: PARTICIPANT_ID,
    liveQuizId: LIVE_QUIZ_ID,
    blockId: BLOCK_ID,
    instanceId: INSTANCE_ID,
    elementType: ElementType.SC,
    isGamificationEnabled: true,
    pointsAwarded: 10,
    xpAwarded: 5,
    response: { choices: [{ ix: 0, selected: true }] },
  }
  const context = {
    logger: { info: vi.fn(), error: vi.fn() },
  } as unknown as Context<JsonObject, {}>

  beforeEach(async () => {
    await redis.del(...keys)
    await redis.hset(`${instanceKey}:votes`, SUBMISSION_ID, 'accepted')
    vi.clearAllMocks()
  })

  afterAll(async () => {
    await redis.del(...keys)
    redis.disconnect()
  })

  it('aggregates duplicate Hatchet events exactly once', async () => {
    await aggregateAssessmentResponses(message, context)
    await aggregateAssessmentResponses(message, context)

    expect(await redis.hget(`${instanceKey}:votes`, SUBMISSION_ID)).toBe(
      'aggregated'
    )
    expect(await redis.hget(`${instanceKey}:results`, '0')).toBe('1')
    expect(await redis.hget(`${instanceKey}:results`, 'participants')).toBe('1')
    expect(await redis.hget(`${liveQuizKey}:lb`, PARTICIPANT_ID)).toBe('10')
    expect(await redis.hget(`${liveQuizKey}:xp`, PARTICIPANT_ID)).toBe('5')
  })

  it('does not double count when the Redis commit acknowledgement is lost', async () => {
    const redisWithLostAcknowledgement = {
      eval: vi.fn(
        async (script: string, numberOfKeys: number, ...args: string[]) => {
          await redis.eval(script, numberOfKeys, ...args)
          throw new Error('synthetic lost Redis acknowledgement')
        }
      ),
    }

    await expect(
      aggregateAssessmentResponses(message, context, {
        redis: redisWithLostAcknowledgement,
      })
    ).rejects.toThrow('ASSESSMENT_RESPONSE_AGGREGATION_FAILED')

    await aggregateAssessmentResponses(message, context, { redis })

    expect(await redis.hget(`${instanceKey}:results`, '0')).toBe('1')
    expect(await redis.hget(`${instanceKey}:results`, 'participants')).toBe('1')
    expect(await redis.hget(`${liveQuizKey}:lb`, PARTICIPANT_ID)).toBe('10')
    expect(await redis.hget(`${liveQuizKey}:xp`, PARTICIPANT_ID)).toBe('5')
  })

  it('applies response-hash writes in the same atomic operation', async () => {
    await aggregateAssessmentResponses(
      {
        ...message,
        elementType: ElementType.NUMERICAL,
        response: { value: '42' },
      },
      context
    )

    const responseHashes = await redis.hgetall(`${instanceKey}:responseHashes`)
    expect(Object.values(responseHashes)).toEqual(['42'])
    expect(await redis.hget(`${instanceKey}:results`, 'participants')).toBe('1')
    expect(
      await redis.hget(
        `${instanceKey}:results`,
        Object.keys(responseHashes)[0]!
      )
    ).toBe('1')
  })
})

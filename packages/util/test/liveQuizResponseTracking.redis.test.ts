import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '../src/liveQuizResponseTracking.js'

const redisIntegration = process.env.LIVE_QUIZ_REDIS_INTEGRATION === 'true'

const redisDescribe = redisIntegration ? describe : describe.skip

redisDescribe('live quiz response tracking Redis contract', () => {
  let redis: Redis

  beforeAll(async () => {
    redis = new Redis({
      host: process.env.REDIS_HOST ?? 'localhost',
      port: Number(process.env.REDIS_PORT ?? 6379),
    })
    await redis.ping()
  })

  afterAll(async () => {
    await redis.quit()
  })

  it('applies processing once and preserves the retention boundary', async () => {
    const prefix = `live-quiz-response-tracking-test:${process.pid}:${Date.now()}`
    const processedKey = `${prefix}:processed`
    const instanceInfoKey = `${prefix}:info`
    const resultsKey = `${prefix}:results`
    const commands = JSON.stringify([
      ['HINCRBY', resultsKey, 'participants', '1'],
    ])

    try {
      await redis.hset(instanceInfoKey, 'id', 'synthetic')

      const replies = await Promise.all(
        Array.from({ length: 8 }, () =>
          redis.eval(
            LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
            2,
            processedKey,
            instanceInfoKey,
            'message-1',
            String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
            commands
          )
        )
      )
      const statuses = replies.map((reply) => JSON.parse(String(reply)).status)

      expect(statuses.filter((status) => status === 'processed')).toHaveLength(
        1
      )
      expect(
        statuses.filter((status) => status === 'already_processed')
      ).toHaveLength(7)
      expect(await redis.hget(resultsKey, 'participants')).toBe('1')
      expect(await redis.ttl(processedKey)).toBe(-1)

      const boundedInfoKey = `${prefix}:bounded-info`
      const boundedProcessedKey = `${prefix}:bounded-processed`
      await redis.hset(boundedInfoKey, 'id', 'synthetic')
      await redis.expire(boundedInfoKey, 30)
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        2,
        boundedProcessedKey,
        boundedInfoKey,
        'message-2',
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        JSON.stringify([])
      )
      const boundedTtl = await redis.ttl(boundedProcessedKey)
      expect(boundedTtl).toBeGreaterThan(0)
      expect(boundedTtl).toBeLessThanOrEqual(30)

      const missingProcessedKey = `${prefix}:missing-processed`
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        2,
        missingProcessedKey,
        `${prefix}:missing-info`,
        'message-3',
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        JSON.stringify([])
      )
      const missingTtl = await redis.ttl(missingProcessedKey)
      expect(missingTtl).toBeGreaterThan(0)
      expect(missingTtl).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
      )

      const receivedKey = `${prefix}:received`
      await redis.eval(
        LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT,
        2,
        receivedKey,
        `${prefix}:missing-info-2`,
        'message-4',
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      )
      const receivedTtl = await redis.ttl(receivedKey)
      expect(receivedTtl).toBeGreaterThan(0)
      expect(receivedTtl).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
      )

      const errorProcessedKey = `${prefix}:error-processed`
      const errorResultsKey = `${prefix}:error-results`
      await redis.set(errorResultsKey, 'wrong-type')
      const errorReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        2,
        errorProcessedKey,
        `${prefix}:error-info`,
        'message-5',
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        JSON.stringify([['HINCRBY', errorResultsKey, 'participants', '1']])
      )
      const errorResult = JSON.parse(String(errorReply))
      expect(errorResult.status).toBe('processed')
      expect(errorResult.commandErrors).toHaveLength(1)
      expect(await redis.sismember(errorProcessedKey, 'message-5')).toBe(1)
    } finally {
      await redis.del(
        processedKey,
        instanceInfoKey,
        resultsKey,
        `${prefix}:bounded-info`,
        `${prefix}:bounded-processed`,
        `${prefix}:missing-processed`,
        `${prefix}:received`,
        `${prefix}:error-processed`,
        `${prefix}:error-results`
      )
    }
  })
})

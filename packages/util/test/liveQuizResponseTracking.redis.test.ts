import { Redis } from 'ioredis'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
  LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
  LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS,
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

  it('keeps counters exact, claims bounded, and excludes partial failures', async () => {
    const prefix = `live-quiz-response-tracking-test:${process.pid}:${Date.now()}`
    const replayClaimKey = `${prefix}:processed`
    const processedCountKey = `${prefix}:processed-count`
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
            3,
            replayClaimKey,
            processedCountKey,
            instanceInfoKey,
            'message-1',
            String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
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
      expect(await redis.get(processedCountKey)).toBe('1')
      expect(await redis.ttl(replayClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(replayClaimKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS
      )
      expect(await redis.ttl(processedCountKey)).toBe(-1)

      const nearExpiryInfoKey = `${prefix}:near-expiry-info`
      const nearExpiryClaimKey = `${prefix}:near-expiry-processed`
      const nearExpiryCountKey = `${prefix}:near-expiry-processed-count`
      await redis.hset(nearExpiryInfoKey, 'id', 'synthetic')
      await redis.pexpire(nearExpiryInfoKey, 1500)
      let nearExpiryTtl = await redis.ttl(nearExpiryInfoKey)
      for (let attempt = 0; attempt < 200 && nearExpiryTtl !== 0; attempt++) {
        if (nearExpiryTtl === -2) {
          await redis.hset(nearExpiryInfoKey, 'id', 'synthetic')
          await redis.pexpire(nearExpiryInfoKey, 1500)
        }
        await new Promise((resolve) => setTimeout(resolve, 25))
        nearExpiryTtl = await redis.ttl(nearExpiryInfoKey)
      }
      expect(nearExpiryTtl).toBe(0)
      const nearExpiryReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        3,
        nearExpiryClaimKey,
        nearExpiryCountKey,
        nearExpiryInfoKey,
        'message-near-expiry',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(JSON.parse(String(nearExpiryReply)).status).toBe('processed')
      expect(await redis.ttl(nearExpiryClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(nearExpiryCountKey)).toBeGreaterThan(0)

      const boundedInfoKey = `${prefix}:bounded-info`
      const boundedClaimKey = `${prefix}:bounded-processed`
      const boundedCountKey = `${prefix}:bounded-processed-count`
      await redis.hset(boundedInfoKey, 'id', 'synthetic')
      await redis.expire(boundedInfoKey, 30)
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        3,
        boundedClaimKey,
        boundedCountKey,
        boundedInfoKey,
        'message-2',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(await redis.get(boundedCountKey)).toBe('1')
      expect(await redis.ttl(boundedClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedClaimKey)).toBeLessThanOrEqual(30)
      expect(await redis.ttl(boundedCountKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedCountKey)).toBeLessThanOrEqual(30)

      const missingClaimKey = `${prefix}:missing-processed`
      const missingCountKey = `${prefix}:missing-processed-count`
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        3,
        missingClaimKey,
        missingCountKey,
        `${prefix}:missing-info`,
        'message-3',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(await redis.get(missingCountKey)).toBe('1')
      expect(await redis.ttl(missingClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(missingClaimKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS
      )
      expect(await redis.ttl(missingCountKey)).toBeGreaterThan(0)
      expect(await redis.ttl(missingCountKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
      )

      const receivedCountKey = `${prefix}:received-count`
      await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        2,
        receivedCountKey,
        `${prefix}:missing-info-2`,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      )
      expect(await redis.get(receivedCountKey)).toBe('1')
      expect(await redis.ttl(receivedCountKey)).toBeGreaterThan(0)
      expect(await redis.ttl(receivedCountKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
      )

      const errorClaimKey = `${prefix}:error-processed`
      const errorCountKey = `${prefix}:error-processed-count`
      const errorResultsKey = `${prefix}:error-results`
      await redis.set(errorResultsKey, 'wrong-type')
      const errorReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        3,
        errorClaimKey,
        errorCountKey,
        `${prefix}:error-info`,
        'message-4',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([['HINCRBY', errorResultsKey, 'participants', '1']])
      )
      const errorResult = JSON.parse(String(errorReply))
      expect(errorResult.status).toBe('aggregation_failed')
      expect(errorResult.counted).toBe(false)
      expect(errorResult.commandErrors).toHaveLength(1)
      expect(await redis.get(errorCountKey)).toBe('0')
      expect(await redis.sismember(errorClaimKey, 'message-4')).toBe(1)

      const partialClaimKey = `${prefix}:partial-processed`
      const partialCountKey = `${prefix}:partial-processed-count`
      const partialErrorKey = `${prefix}:partial-error-results`
      const partialSuccessKey = `${prefix}:partial-success-results`
      await redis.set(partialErrorKey, 'wrong-type')
      const partialReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        3,
        partialClaimKey,
        partialCountKey,
        `${prefix}:partial-info`,
        'message-5',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([
          ['HINCRBY', partialErrorKey, 'participants', '1'],
          ['HINCRBY', partialSuccessKey, 'participants', '1'],
        ])
      )
      const partialResult = JSON.parse(String(partialReply))
      expect(partialResult.commandErrors).toHaveLength(1)
      expect(partialResult.counted).toBe(false)
      expect(await redis.get(partialCountKey)).toBe('0')
      expect(await redis.hget(partialSuccessKey, 'participants')).toBe('1')
    } finally {
      await redis.del(
        replayClaimKey,
        processedCountKey,
        instanceInfoKey,
        resultsKey,
        `${prefix}:bounded-info`,
        `${prefix}:near-expiry-info`,
        `${prefix}:near-expiry-processed`,
        `${prefix}:near-expiry-processed-count`,
        `${prefix}:bounded-processed`,
        `${prefix}:bounded-processed-count`,
        `${prefix}:missing-processed`,
        `${prefix}:missing-processed-count`,
        `${prefix}:received-count`,
        `${prefix}:error-processed`,
        `${prefix}:error-processed-count`,
        `${prefix}:error-results`,
        `${prefix}:partial-processed`,
        `${prefix}:partial-processed-count`,
        `${prefix}:partial-error-results`,
        `${prefix}:partial-success-results`
      )
    }
  })
})

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
    const replayClaimKey = `${prefix}:processed:claims`
    const legacyProcessedKey = `${prefix}:processed`
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
            4,
            replayClaimKey,
            processedCountKey,
            instanceInfoKey,
            legacyProcessedKey,
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

      const horizonClaimKey = `${prefix}:horizon-processed:claims`
      const horizonLegacyProcessedKey = `${prefix}:horizon-processed`
      const horizonCountKey = `${prefix}:horizon-processed-count`
      const horizonResultsKey = `${prefix}:horizon-results`
      const horizonCommands = JSON.stringify([
        ['HINCRBY', horizonResultsKey, 'participants', '1'],
      ])
      const processWithShortReplayHorizon = (messageId: string) =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          4,
          horizonClaimKey,
          horizonCountKey,
          `${prefix}:horizon-info`,
          horizonLegacyProcessedKey,
          messageId,
          '3',
          horizonCommands
        )

      expect(
        JSON.parse(String(await processWithShortReplayHorizon('message-old')))
          .status
      ).toBe('processed')
      await new Promise((resolve) => setTimeout(resolve, 2100))
      expect(
        JSON.parse(String(await processWithShortReplayHorizon('message-new')))
          .status
      ).toBe('processed')
      await new Promise((resolve) => setTimeout(resolve, 1100))
      expect(
        JSON.parse(String(await processWithShortReplayHorizon('message-new')))
          .status
      ).toBe('already_processed')
      expect(await redis.hget(horizonResultsKey, 'participants')).toBe('2')
      expect(await redis.get(horizonCountKey)).toBe('2')

      const nearExpiryInfoKey = `${prefix}:near-expiry-info`
      const nearExpiryClaimKey = `${prefix}:near-expiry-processed:claims`
      const nearExpiryLegacyProcessedKey = `${prefix}:near-expiry-processed`
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
        4,
        nearExpiryClaimKey,
        nearExpiryCountKey,
        nearExpiryInfoKey,
        nearExpiryLegacyProcessedKey,
        'message-near-expiry',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(JSON.parse(String(nearExpiryReply)).status).toBe('processed')
      expect(await redis.ttl(nearExpiryClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(nearExpiryCountKey)).toBeGreaterThan(0)

      const boundedInfoKey = `${prefix}:bounded-info`
      const boundedClaimKey = `${prefix}:bounded-processed:claims`
      const boundedLegacyProcessedKey = `${prefix}:bounded-processed`
      const boundedCountKey = `${prefix}:bounded-processed-count`
      await redis.hset(boundedInfoKey, 'id', 'synthetic')
      await redis.expire(boundedInfoKey, 30)
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        4,
        boundedClaimKey,
        boundedCountKey,
        boundedInfoKey,
        boundedLegacyProcessedKey,
        'message-2',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(await redis.get(boundedCountKey)).toBe('1')
      expect(await redis.ttl(boundedClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedClaimKey)).toBeLessThanOrEqual(30)
      expect(await redis.ttl(boundedCountKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedCountKey)).toBeLessThanOrEqual(30)

      const shrinkingInfoKey = `${prefix}:shrinking-info`
      const shrinkingClaimKey = `${prefix}:shrinking-processed:claims`
      const shrinkingLegacyProcessedKey = `${prefix}:shrinking-processed`
      const shrinkingCountKey = `${prefix}:shrinking-processed-count`
      await redis.hset(shrinkingInfoKey, 'id', 'synthetic')
      await redis.pexpire(shrinkingInfoKey, 5000)
      const processWithShrinkingInfo = (messageId: string) =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          4,
          shrinkingClaimKey,
          shrinkingCountKey,
          shrinkingInfoKey,
          shrinkingLegacyProcessedKey,
          messageId,
          '8',
          JSON.stringify([])
        )

      expect(
        JSON.parse(String(await processWithShrinkingInfo('message-old'))).status
      ).toBe('processed')
      await new Promise((resolve) => setTimeout(resolve, 1100))
      expect(
        JSON.parse(String(await processWithShrinkingInfo('message-new'))).status
      ).toBe('processed')
      await new Promise((resolve) => setTimeout(resolve, 2100))
      expect(
        JSON.parse(String(await processWithShrinkingInfo('message-old'))).status
      ).toBe('already_processed')
      expect(await redis.get(shrinkingCountKey)).toBe('2')

      const missingClaimKey = `${prefix}:missing-processed:claims`
      const missingLegacyProcessedKey = `${prefix}:missing-processed`
      const missingCountKey = `${prefix}:missing-processed-count`
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        4,
        missingClaimKey,
        missingCountKey,
        `${prefix}:missing-info`,
        missingLegacyProcessedKey,
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
      const inactiveReceivedReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        2,
        receivedCountKey,
        `${prefix}:missing-info-2`,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      )
      expect(JSON.parse(String(inactiveReceivedReply))).toEqual({
        status: 'inactive',
      })
      expect(await redis.get(receivedCountKey)).toBeNull()

      const activeInfoKey = `${prefix}:active-info`
      const activeReceivedCountKey = `${prefix}:active-received-count`
      await redis.hset(activeInfoKey, 'id', 'synthetic')
      const activeReceivedReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        2,
        activeReceivedCountKey,
        activeInfoKey,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      )
      expect(JSON.parse(String(activeReceivedReply)).status).toBe('tracked')
      expect(await redis.get(activeReceivedCountKey)).toBe('1')
      expect(await redis.ttl(activeReceivedCountKey)).toBe(-1)

      const malformedReceivedCountKey = `${prefix}:malformed-received-count`
      await redis.rpush(malformedReceivedCountKey, 'wrong-type')
      const malformedReceivedReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        2,
        malformedReceivedCountKey,
        activeInfoKey,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS)
      )
      expect(JSON.parse(String(malformedReceivedReply))).toMatchObject({
        status: 'tracking_failed',
      })

      const errorClaimKey = `${prefix}:error-processed:claims`
      const errorLegacyProcessedKey = `${prefix}:error-processed-legacy`
      const errorCountKey = `${prefix}:error-processed-count`
      const errorResultsKey = `${prefix}:error-results`
      await redis.set(errorResultsKey, 'wrong-type')
      const errorReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        4,
        errorClaimKey,
        errorCountKey,
        `${prefix}:error-info`,
        errorLegacyProcessedKey,
        'message-4',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([['HINCRBY', errorResultsKey, 'participants', '1']])
      )
      const errorResult = JSON.parse(String(errorReply))
      expect(errorResult.status).toBe('aggregation_failed')
      expect(errorResult.counted).toBe(false)
      expect(errorResult.commandErrors).toHaveLength(1)
      expect(await redis.get(errorCountKey)).toBeNull()
      expect(await redis.zscore(errorClaimKey, 'message-4')).toBeNull()

      const partialClaimKey = `${prefix}:partial-processed:claims`
      const partialLegacyProcessedKey = `${prefix}:partial-processed`
      const partialCountKey = `${prefix}:partial-processed-count`
      const partialErrorKey = `${prefix}:partial-error-results`
      const partialSuccessKey = `${prefix}:partial-success-results`
      await redis.set(partialErrorKey, 'wrong-type')
      const partialReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        4,
        partialClaimKey,
        partialCountKey,
        `${prefix}:partial-info`,
        partialLegacyProcessedKey,
        'message-5',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([
          ['HINCRBY', partialErrorKey, 'participants', '1'],
          ['HINCRBY', partialSuccessKey, 'participants', '1'],
        ])
      )
      const partialResult = JSON.parse(String(partialReply))
      expect(partialResult.status).toBe('aggregation_failed')
      expect(partialResult.commandErrors).toHaveLength(1)
      expect(partialResult.counted).toBe(false)
      expect(await redis.get(partialCountKey)).toBeNull()
      expect(await redis.hget(partialSuccessKey, 'participants')).toBeNull()
      expect(await redis.zscore(partialClaimKey, 'message-5')).toBeNull()

      const mixedClaimKey = `${prefix}:mixed-processed:claims`
      const mixedLegacyProcessedKey = `${prefix}:mixed-processed`
      const mixedCountKey = `${prefix}:mixed-processed-count`
      const mixedSuccessKey = `${prefix}:mixed-success-results`
      const mixedOverflowKey = `${prefix}:mixed-overflow-results`
      await redis.hset(mixedOverflowKey, 'participants', '9223372036854775807')
      const mixedCommands = JSON.stringify([
        ['HINCRBY', mixedSuccessKey, 'participants', '1'],
        ['HINCRBY', mixedOverflowKey, 'participants', '1'],
      ])
      const processMixedFailure = () =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          4,
          mixedClaimKey,
          mixedCountKey,
          `${prefix}:mixed-info`,
          mixedLegacyProcessedKey,
          'message-7',
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          mixedCommands
        )

      const mixedFirstResult = JSON.parse(String(await processMixedFailure()))
      expect(mixedFirstResult.status).toBe('reconciliation_required')
      expect(mixedFirstResult.commandErrors).toHaveLength(1)
      expect(await redis.hget(mixedSuccessKey, 'participants')).toBe('1')
      expect(await redis.zscore(mixedClaimKey, 'message-7')).not.toBeNull()

      const mixedRetryResult = JSON.parse(String(await processMixedFailure()))
      expect(mixedRetryResult.status).toBe('already_processed')
      expect(await redis.hget(mixedSuccessKey, 'participants')).toBe('1')
      expect(await redis.hget(mixedOverflowKey, 'participants')).toBe(
        '9223372036854775807'
      )

      const invalidClaimKey = `${prefix}:invalid-claim:claims`
      const invalidLegacyProcessedKey = `${prefix}:invalid-claim`
      const invalidClaimCountKey = `${prefix}:invalid-claim-count`
      await redis.set(invalidClaimKey, 'wrong-type')
      const invalidClaimReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        4,
        invalidClaimKey,
        invalidClaimCountKey,
        `${prefix}:invalid-claim-info`,
        invalidLegacyProcessedKey,
        'message-6',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      const invalidClaimResult = JSON.parse(String(invalidClaimReply))
      expect(invalidClaimResult.status).toBe('aggregation_failed')
      expect(invalidClaimResult.commandErrors).toHaveLength(1)
      expect(await redis.get(invalidClaimCountKey)).toBeNull()
    } finally {
      await redis.del(
        replayClaimKey,
        legacyProcessedKey,
        processedCountKey,
        instanceInfoKey,
        resultsKey,
        `${prefix}:horizon-processed:claims`,
        `${prefix}:horizon-processed`,
        `${prefix}:horizon-processed-count`,
        `${prefix}:horizon-results`,
        `${prefix}:horizon-info`,
        `${prefix}:bounded-info`,
        `${prefix}:near-expiry-info`,
        `${prefix}:near-expiry-processed:claims`,
        `${prefix}:near-expiry-processed`,
        `${prefix}:near-expiry-processed-count`,
        `${prefix}:bounded-processed:claims`,
        `${prefix}:bounded-processed`,
        `${prefix}:bounded-processed-count`,
        `${prefix}:shrinking-info`,
        `${prefix}:shrinking-processed:claims`,
        `${prefix}:shrinking-processed`,
        `${prefix}:shrinking-processed-count`,
        `${prefix}:missing-processed:claims`,
        `${prefix}:missing-processed`,
        `${prefix}:missing-processed-count`,
        `${prefix}:received-count`,
        `${prefix}:malformed-received-count`,
        `${prefix}:active-info`,
        `${prefix}:active-received-count`,
        `${prefix}:error-processed:claims`,
        `${prefix}:error-processed-legacy`,
        `${prefix}:error-processed-count`,
        `${prefix}:error-results`,
        `${prefix}:partial-processed:claims`,
        `${prefix}:partial-processed`,
        `${prefix}:partial-processed-count`,
        `${prefix}:partial-error-results`,
        `${prefix}:partial-success-results`,
        `${prefix}:mixed-processed:claims`,
        `${prefix}:mixed-processed`,
        `${prefix}:mixed-processed-count`,
        `${prefix}:mixed-success-results`,
        `${prefix}:mixed-overflow-results`,
        `${prefix}:invalid-claim:claims`,
        `${prefix}:invalid-claim`,
        `${prefix}:invalid-claim-count`,
        `${prefix}:invalid-claim-info`
      )
    }
  })
})

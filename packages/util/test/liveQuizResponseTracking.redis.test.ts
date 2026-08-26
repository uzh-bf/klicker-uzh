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
    const liveQuizKey = `lq:live-quiz-response-tracking-test-${process.pid}-${Date.now()}`
    const prefix = `${liveQuizKey}:i:test-instance`
    const replayClaimKey = `${prefix}:processed:claims`
    const legacyProcessedKey = `${prefix}:processed`
    const processedCountKey = `${prefix}:processed-count`
    const instanceInfoKey = `${prefix}:info`
    const reconciliationKey = `${prefix}:reconciliation`
    const receivedClaimKey = `${prefix}:responses:received`
    const resultsKey = `${prefix}:results`
    const fallbackUser = `live-quiz-fallback-${process.pid}`
    const fallbackPassword = `fallback-${process.pid}`
    let fallbackRedis: Redis | undefined
    const commands = JSON.stringify([
      ['HINCRBY', resultsKey, 'participants', '1'],
      ['HINCRBY', `${liveQuizKey}:b:block-1:lb`, 'participant-1', '5'],
      ['HINCRBY', `${liveQuizKey}:lb`, 'participant-1', '5'],
      ['HINCRBY', `${liveQuizKey}:xp`, 'participant-1', '2'],
      ['HINCRBY', `${liveQuizKey}:b:block-1:lbTemporary`, 'temporary-1', '5'],
      ['HINCRBY', `${liveQuizKey}:lbTemporary`, 'temporary-1', '5'],
    ])

    try {
      await redis.hset(instanceInfoKey, 'id', 'synthetic')
      await redis.sadd(receivedClaimKey, 'message-1')

      const replies = await Promise.all(
        Array.from({ length: 8 }, () =>
          redis.eval(
            LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
            6,
            replayClaimKey,
            processedCountKey,
            instanceInfoKey,
            legacyProcessedKey,
            reconciliationKey,
            receivedClaimKey,
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
      expect(
        await redis.hget(`${liveQuizKey}:b:block-1:lb`, 'participant-1')
      ).toBe('5')
      expect(await redis.hget(`${liveQuizKey}:lb`, 'participant-1')).toBe('5')
      expect(await redis.hget(`${liveQuizKey}:xp`, 'participant-1')).toBe('2')
      expect(
        await redis.hget(`${liveQuizKey}:b:block-1:lbTemporary`, 'temporary-1')
      ).toBe('5')
      expect(
        await redis.hget(`${liveQuizKey}:lbTemporary`, 'temporary-1')
      ).toBe('5')
      expect(await redis.get(processedCountKey)).toBe('1')
      expect(await redis.ttl(replayClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(replayClaimKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS
      )
      expect(await redis.ttl(processedCountKey)).toBe(-1)

      const horizonClaimKey = `${prefix}:horizon-processed:claims`
      const horizonLegacyProcessedKey = `${prefix}:horizon-processed`
      const horizonCountKey = `${prefix}:horizon-processed-count`
      const horizonReconciliationKey = `${prefix}:horizon:reconciliation`
      const horizonReceivedClaimKey = `${prefix}:horizon:received`
      const horizonResultsKey = `${prefix}:horizon:results`
      const horizonCommands = JSON.stringify([
        ['HINCRBY', horizonResultsKey, 'participants', '1'],
      ])
      const processWithShortReplayHorizon = async (messageId: string) => {
        await redis.sadd(horizonReceivedClaimKey, messageId)
        return await redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          horizonClaimKey,
          horizonCountKey,
          `${prefix}:horizon:info`,
          horizonLegacyProcessedKey,
          horizonReconciliationKey,
          horizonReceivedClaimKey,
          messageId,
          '3',
          horizonCommands
        )
      }

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

      const nearExpiryInfoKey = `${prefix}:near-expiry:info`
      const nearExpiryClaimKey = `${prefix}:near-expiry-processed:claims`
      const nearExpiryLegacyProcessedKey = `${prefix}:near-expiry-processed`
      const nearExpiryCountKey = `${prefix}:near-expiry-processed-count`
      const nearExpiryReconciliationKey = `${prefix}:near-expiry:reconciliation`
      const nearExpiryReceivedClaimKey = `${prefix}:near-expiry:received`
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
      await redis.sadd(nearExpiryReceivedClaimKey, 'message-near-expiry')
      const nearExpiryReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        nearExpiryClaimKey,
        nearExpiryCountKey,
        nearExpiryInfoKey,
        nearExpiryLegacyProcessedKey,
        nearExpiryReconciliationKey,
        nearExpiryReceivedClaimKey,
        'message-near-expiry',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(JSON.parse(String(nearExpiryReply)).status).toBe('processed')
      expect(await redis.ttl(nearExpiryClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(nearExpiryCountKey)).toBeGreaterThan(0)

      const boundedInfoKey = `${prefix}:bounded:info`
      const boundedClaimKey = `${prefix}:bounded-processed:claims`
      const boundedLegacyProcessedKey = `${prefix}:bounded-processed`
      const boundedCountKey = `${prefix}:bounded-processed-count`
      const boundedReconciliationKey = `${prefix}:bounded:reconciliation`
      const boundedReceivedClaimKey = `${prefix}:bounded:received`
      await redis.hset(boundedInfoKey, 'id', 'synthetic')
      await redis.expire(boundedInfoKey, 30)
      await redis.sadd(boundedReceivedClaimKey, 'message-2')
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        boundedClaimKey,
        boundedCountKey,
        boundedInfoKey,
        boundedLegacyProcessedKey,
        boundedReconciliationKey,
        boundedReceivedClaimKey,
        'message-2',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      expect(await redis.get(boundedCountKey)).toBe('1')
      expect(await redis.ttl(boundedClaimKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedClaimKey)).toBeGreaterThan(30)
      expect(await redis.ttl(boundedClaimKey)).toBeLessThanOrEqual(
        LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS
      )
      expect(await redis.ttl(boundedCountKey)).toBeGreaterThan(0)
      expect(await redis.ttl(boundedCountKey)).toBeLessThanOrEqual(30)

      const shrinkingInfoKey = `${prefix}:shrinking:info`
      const shrinkingClaimKey = `${prefix}:shrinking-processed:claims`
      const shrinkingLegacyProcessedKey = `${prefix}:shrinking-processed`
      const shrinkingCountKey = `${prefix}:shrinking-processed-count`
      const shrinkingReconciliationKey = `${prefix}:shrinking:reconciliation`
      const shrinkingReceivedClaimKey = `${prefix}:shrinking:received`
      const shrinkingResultsKey = `${prefix}:shrinking:results`
      const shrinkingCommands = JSON.stringify([
        ['HINCRBY', shrinkingResultsKey, 'participants', '1'],
      ])
      await redis.hset(shrinkingInfoKey, 'id', 'synthetic')
      await redis.pexpire(shrinkingInfoKey, 2000)
      await redis.sadd(shrinkingReceivedClaimKey, 'message-old')
      const processWithShrinkingInfo = () =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          shrinkingClaimKey,
          shrinkingCountKey,
          shrinkingInfoKey,
          shrinkingLegacyProcessedKey,
          shrinkingReconciliationKey,
          shrinkingReceivedClaimKey,
          'message-old',
          '8',
          shrinkingCommands
        )

      expect(JSON.parse(String(await processWithShrinkingInfo())).status).toBe(
        'processed'
      )
      await redis.expire(shrinkingResultsKey, 30)
      await redis.expire(shrinkingCountKey, 30)
      await new Promise((resolve) => setTimeout(resolve, 2300))
      expect(await redis.ttl(shrinkingInfoKey)).toBe(-2)
      expect(JSON.parse(String(await processWithShrinkingInfo())).status).toBe(
        'already_processed'
      )
      expect(await redis.hget(shrinkingResultsKey, 'participants')).toBe('1')
      expect(await redis.get(shrinkingCountKey)).toBe('1')

      const missingClaimKey = `${prefix}:missing-processed:claims`
      const missingLegacyProcessedKey = `${prefix}:missing-processed`
      const missingCountKey = `${prefix}:missing-processed-count`
      const missingReconciliationKey = `${prefix}:missing:reconciliation`
      const missingReceivedClaimKey = `${prefix}:missing:received`
      await redis.sadd(missingReceivedClaimKey, 'message-3')
      await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        missingClaimKey,
        missingCountKey,
        `${prefix}:missing:info`,
        missingLegacyProcessedKey,
        missingReconciliationKey,
        missingReceivedClaimKey,
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
        3,
        receivedCountKey,
        `${prefix}:missing-2:info`,
        `${prefix}:missing-2:received`,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        'message-inactive'
      )
      expect(JSON.parse(String(inactiveReceivedReply))).toEqual({
        status: 'inactive',
      })
      expect(await redis.get(receivedCountKey)).toBeNull()

      const activeInfoKey = `${prefix}:active:info`
      const activeReceivedCountKey = `${prefix}:active-received-count`
      const activeReceivedClaimKey = `${prefix}:active:received`
      await redis.hset(activeInfoKey, 'id', 'synthetic')
      const activeReceivedReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        3,
        activeReceivedCountKey,
        activeInfoKey,
        activeReceivedClaimKey,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        'message-active'
      )
      expect(JSON.parse(String(activeReceivedReply)).status).toBe('tracked')
      expect(await redis.get(activeReceivedCountKey)).toBe('1')
      expect(await redis.ttl(activeReceivedCountKey)).toBe(-1)
      await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        3,
        activeReceivedCountKey,
        activeInfoKey,
        activeReceivedClaimKey,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        'message-active'
      )
      expect(await redis.get(activeReceivedCountKey)).toBe('1')

      const malformedReceivedCountKey = `${prefix}:malformed-received-count`
      await redis.rpush(malformedReceivedCountKey, 'wrong-type')
      const malformedReceivedReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_RECEIVED_SCRIPT,
        3,
        malformedReceivedCountKey,
        activeInfoKey,
        `${prefix}:malformed:received`,
        String(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS),
        'message-malformed'
      )
      expect(JSON.parse(String(malformedReceivedReply))).toMatchObject({
        status: 'tracking_failed',
      })

      const firstResponseClaimKey = `${prefix}:first-response:claims`
      const firstResponseInfoKey = `${prefix}:first-response:info`
      const firstResponseReceivedKey = `${prefix}:first-response:received`
      const firstResponseReconciliationKey = `${prefix}:first-response:reconciliation`
      const applyFirstResponseTimestamp = async (
        messageId: string,
        timestamp: string
      ) => {
        await redis.sadd(firstResponseReceivedKey, messageId)
        return await redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          firstResponseClaimKey,
          `${prefix}:first-response-count`,
          firstResponseInfoKey,
          `${prefix}:first-response-legacy`,
          firstResponseReconciliationKey,
          firstResponseReceivedKey,
          messageId,
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          JSON.stringify([
            [
              'HSETNX',
              firstResponseInfoKey,
              'firstResponseReceivedAt',
              timestamp,
            ],
          ])
        )
      }
      expect(
        JSON.parse(
          String(await applyFirstResponseTimestamp('message-first', '1000'))
        ).status
      ).toBe('processed')
      expect(
        JSON.parse(
          String(await applyFirstResponseTimestamp('message-second', '2000'))
        ).status
      ).toBe('processed')
      expect(
        await redis.hget(firstResponseInfoKey, 'firstResponseReceivedAt')
      ).toBe('1000')

      const errorClaimKey = `${prefix}:error-processed:claims`
      const errorLegacyProcessedKey = `${prefix}:error-processed-legacy`
      const errorCountKey = `${prefix}:error-processed-count`
      const errorResultsKey = `${prefix}:error:results`
      await redis.set(errorResultsKey, 'wrong-type')
      const errorReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        errorClaimKey,
        errorCountKey,
        `${prefix}:error:info`,
        errorLegacyProcessedKey,
        `${prefix}:error:reconciliation`,
        `${prefix}:error:received`,
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
      const partialErrorKey = `${prefix}:partial:error-results`
      const partialSuccessKey = `${prefix}:partial:success-results`
      await redis.set(partialErrorKey, 'wrong-type')
      const partialReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        partialClaimKey,
        partialCountKey,
        `${prefix}:partial:info`,
        partialLegacyProcessedKey,
        `${prefix}:partial:reconciliation`,
        `${prefix}:partial:received`,
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
      const mixedReconciliationKey = `${prefix}:mixed:reconciliation`
      const mixedReceivedClaimKey = `${prefix}:mixed:received`
      const mixedSuccessKey = `${prefix}:mixed:success-results`
      const mixedOverflowKey = `${prefix}:mixed:overflow-results`
      await redis.hset(mixedOverflowKey, 'participants', '9223372036854775807')
      const mixedCommands = JSON.stringify([
        ['HINCRBY', mixedSuccessKey, 'participants', '1'],
        ['HINCRBY', mixedOverflowKey, 'participants', '1'],
      ])
      const processMixedFailure = () =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          mixedClaimKey,
          mixedCountKey,
          `${prefix}:mixed:info`,
          mixedLegacyProcessedKey,
          mixedReconciliationKey,
          mixedReceivedClaimKey,
          'message-7',
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          mixedCommands
        )

      const mixedFirstResult = JSON.parse(String(await processMixedFailure()))
      expect(mixedFirstResult.status).toBe('reconciliation_required')
      expect(mixedFirstResult.commandErrors).toHaveLength(1)
      expect(await redis.hget(mixedSuccessKey, 'participants')).toBe('1')
      expect(
        JSON.parse((await redis.hget(mixedReconciliationKey, 'message-7'))!)
          .appliedCommandCount
      ).toBe(1)

      await redis.del(mixedClaimKey)
      const mixedRetryResult = JSON.parse(String(await processMixedFailure()))
      expect(mixedRetryResult.status).toBe('reconciliation_required')
      expect(await redis.hget(mixedSuccessKey, 'participants')).toBe('1')
      expect(await redis.hget(mixedOverflowKey, 'participants')).toBe(
        '9223372036854775807'
      )

      const fallbackClaimKey = `${prefix}:fallback:claims`
      const fallbackInfoKey = `${prefix}:fallback:info`
      const fallbackReconciliationKey = `${prefix}:fallback:reconciliation`
      const fallbackSuccessKey = `${prefix}:fallback:success-results`
      const fallbackOverflowKey = `${prefix}:fallback:overflow-results`
      await redis.hset(fallbackInfoKey, 'id', 'synthetic')
      await redis.hset(
        fallbackOverflowKey,
        'participants',
        '9223372036854775807'
      )
      await redis.call(
        'ACL',
        'SETUSER',
        fallbackUser,
        'reset',
        'on',
        `>${fallbackPassword}`,
        'allkeys',
        '+@all',
        '-hset'
      )
      fallbackRedis = new Redis({
        host: process.env.REDIS_HOST ?? 'localhost',
        password: fallbackPassword,
        port: Number(process.env.REDIS_PORT ?? 6379),
        username: fallbackUser,
      })
      await fallbackRedis.ping()
      const processFallbackFailure = () =>
        fallbackRedis!.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          fallbackClaimKey,
          `${prefix}:fallback-count`,
          fallbackInfoKey,
          `${prefix}:fallback-legacy`,
          fallbackReconciliationKey,
          `${prefix}:fallback-received`,
          'message-fallback',
          '1',
          JSON.stringify([
            ['HINCRBY', fallbackSuccessKey, 'participants', '1'],
            ['HINCRBY', fallbackOverflowKey, 'participants', '1'],
          ])
        )

      expect(JSON.parse(String(await processFallbackFailure())).status).toBe(
        'reconciliation_required'
      )
      expect(await redis.ttl(fallbackClaimKey)).toBe(-1)
      expect(
        Number(await redis.zscore(fallbackClaimKey, 'message-fallback'))
      ).toBeLessThan(0)
      await new Promise((resolve) => setTimeout(resolve, 1100))
      expect(JSON.parse(String(await processFallbackFailure())).status).toBe(
        'reconciliation_required'
      )
      expect(await redis.hget(fallbackSuccessKey, 'participants')).toBe('1')

      const trackingFailureClaimKey = `${prefix}:tracking-failure:claims`
      const trackingFailureCountKey = `${prefix}:tracking-failure-count`
      const trackingFailureResultsKey = `${prefix}:tracking-failure:results`
      const trackingFailureReconciliationKey = `${prefix}:tracking-failure:reconciliation`
      const trackingFailureReceivedClaimKey = `${prefix}:tracking-failure:received`
      await redis.hset(trackingFailureCountKey, 'wrong', 'type')
      await redis.sadd(
        trackingFailureReceivedClaimKey,
        'message-tracking-failure'
      )
      const processTrackingFailure = () =>
        redis.eval(
          LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
          6,
          trackingFailureClaimKey,
          trackingFailureCountKey,
          `${prefix}:tracking-failure:info`,
          `${prefix}:tracking-failure-legacy`,
          trackingFailureReconciliationKey,
          trackingFailureReceivedClaimKey,
          'message-tracking-failure',
          String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
          JSON.stringify([
            ['HINCRBY', trackingFailureResultsKey, 'participants', '1'],
          ])
        )

      const trackingFailureResult = JSON.parse(
        String(await processTrackingFailure())
      )
      expect(trackingFailureResult.status).toBe('reconciliation_required')
      expect(trackingFailureResult.trackingErrors).toHaveLength(1)
      expect(
        await redis.hget(
          trackingFailureReconciliationKey,
          'message-tracking-failure'
        )
      ).not.toBeNull()
      expect(await redis.hget(trackingFailureResultsKey, 'participants')).toBe(
        '1'
      )

      expect(JSON.parse(String(await processTrackingFailure())).status).toBe(
        'reconciliation_required'
      )
      expect(await redis.hget(trackingFailureResultsKey, 'participants')).toBe(
        '1'
      )

      const invalidClaimKey = `${prefix}:invalid-claim:claims`
      const invalidLegacyProcessedKey = `${prefix}:invalid-claim`
      const invalidClaimCountKey = `${prefix}:invalid-claim-count`
      await redis.set(invalidClaimKey, 'wrong-type')
      const invalidClaimReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        invalidClaimKey,
        invalidClaimCountKey,
        `${prefix}:invalid-claim:info`,
        invalidLegacyProcessedKey,
        `${prefix}:invalid-claim:reconciliation`,
        `${prefix}:invalid-claim:received`,
        'message-6',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([])
      )
      const invalidClaimResult = JSON.parse(String(invalidClaimReply))
      expect(invalidClaimResult.status).toBe('aggregation_failed')
      expect(invalidClaimResult.commandErrors).toHaveLength(1)
      expect(await redis.get(invalidClaimCountKey)).toBeNull()

      const invalidPayloadClaimKey = `${prefix}:invalid-payload:claims`
      const invalidPayloadReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        invalidPayloadClaimKey,
        `${prefix}:invalid-payload-count`,
        `${prefix}:invalid-payload:info`,
        `${prefix}:invalid-payload-legacy`,
        `${prefix}:invalid-payload:reconciliation`,
        `${prefix}:invalid-payload:received`,
        'message-invalid-payload',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        '{not-json'
      )
      expect(JSON.parse(String(invalidPayloadReply))).toMatchObject({
        status: 'aggregation_failed',
        counted: false,
        commandErrors: ['invalid Redis commands JSON payload'],
      })
      expect(
        await redis.zscore(invalidPayloadClaimKey, 'message-invalid-payload')
      ).toBeNull()

      const invalidTtlClaimKey = `${prefix}:invalid-ttl:claims`
      const invalidTtlReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        invalidTtlClaimKey,
        `${prefix}:invalid-ttl-count`,
        `${prefix}:invalid-ttl:info`,
        `${prefix}:invalid-ttl-legacy`,
        `${prefix}:invalid-ttl:reconciliation`,
        `${prefix}:invalid-ttl:received`,
        'message-invalid-ttl',
        'not-a-number',
        JSON.stringify([])
      )
      expect(JSON.parse(String(invalidTtlReply))).toMatchObject({
        status: 'aggregation_failed',
        counted: false,
        commandErrors: ['invalid replay claim TTL'],
      })
      expect(
        await redis.zscore(invalidTtlClaimKey, 'message-invalid-ttl')
      ).toBeNull()

      const invalidNamespaceClaimKey = `${prefix}:invalid-namespace:claims`
      const invalidNamespaceTarget = `${liveQuizKey}:i:other-instance:results`
      const invalidNamespaceReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        invalidNamespaceClaimKey,
        `${prefix}:invalid-namespace-count`,
        `${prefix}:invalid-namespace:info`,
        `${prefix}:invalid-namespace-legacy`,
        `${prefix}:invalid-namespace:reconciliation`,
        `${prefix}:invalid-namespace:received`,
        'message-invalid-namespace',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([['HSET', invalidNamespaceTarget, 'participants', '1']])
      )
      expect(JSON.parse(String(invalidNamespaceReply)).status).toBe(
        'aggregation_failed'
      )
      expect(
        await redis.hget(invalidNamespaceTarget, 'participants')
      ).toBeNull()

      const invalidArityClaimKey = `${prefix}:invalid-arity:claims`
      const invalidArityTarget = `${prefix}:invalid-arity:results`
      const invalidArityReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        invalidArityClaimKey,
        `${prefix}:invalid-arity-count`,
        `${prefix}:invalid-arity:info`,
        `${prefix}:invalid-arity-legacy`,
        `${prefix}:invalid-arity:reconciliation`,
        `${prefix}:invalid-arity:received`,
        'message-invalid-arity',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify([
          ['HSET', invalidArityTarget, 'participants', '1', 'extra'],
        ])
      )
      expect(JSON.parse(String(invalidArityReply)).status).toBe(
        'aggregation_failed'
      )
      expect(await redis.hget(invalidArityTarget, 'participants')).toBeNull()

      const largeBatchClaimKey = `${prefix}:large-batch:claims`
      const largeBatchTarget = `${prefix}:large-batch:results`
      const largeBatchReceivedKey = `${prefix}:large-batch:received`
      await redis.sadd(largeBatchReceivedKey, 'message-large-batch')
      const largeBatchReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        largeBatchClaimKey,
        `${prefix}:large-batch-count`,
        `${prefix}:large-batch:info`,
        `${prefix}:large-batch-legacy`,
        `${prefix}:large-batch:reconciliation`,
        largeBatchReceivedKey,
        'message-large-batch',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify(
          Array.from({ length: 600 }, (_, index) => [
            'HSET',
            largeBatchTarget,
            `field-${index}`,
            'value',
          ])
        )
      )
      expect(JSON.parse(String(largeBatchReply)).status).toBe('processed')
      expect(await redis.hlen(largeBatchTarget)).toBe(600)

      const oversizedBatchTarget = `${prefix}:oversized-batch:results`
      const oversizedBatchReply = await redis.eval(
        LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
        6,
        `${prefix}:oversized-batch:claims`,
        `${prefix}:oversized-batch-count`,
        `${prefix}:oversized-batch:info`,
        `${prefix}:oversized-batch-legacy`,
        `${prefix}:oversized-batch:reconciliation`,
        `${prefix}:oversized-batch:received`,
        'message-oversized-batch',
        String(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS),
        JSON.stringify(
          Array.from({ length: 2049 }, (_, index) => [
            'HSET',
            oversizedBatchTarget,
            `field-${index}`,
            'value',
          ])
        )
      )
      expect(JSON.parse(String(oversizedBatchReply))).toMatchObject({
        status: 'aggregation_failed',
        commandErrors: ['Redis aggregation command budget exceeded'],
      })
      expect(await redis.exists(oversizedBatchTarget)).toBe(0)
    } finally {
      if (fallbackRedis) {
        await fallbackRedis.quit()
      }
      await redis.call('ACL', 'DELUSER', fallbackUser)
      await redis.del(
        replayClaimKey,
        legacyProcessedKey,
        processedCountKey,
        instanceInfoKey,
        resultsKey,
        `${prefix}:horizon-processed:claims`,
        `${prefix}:horizon-processed`,
        `${prefix}:horizon-processed-count`,
        `${prefix}:horizon:results`,
        `${prefix}:horizon:info`,
        `${prefix}:bounded:info`,
        `${prefix}:near-expiry:info`,
        `${prefix}:near-expiry-processed:claims`,
        `${prefix}:near-expiry-processed`,
        `${prefix}:near-expiry-processed-count`,
        `${prefix}:bounded-processed:claims`,
        `${prefix}:bounded-processed`,
        `${prefix}:bounded-processed-count`,
        `${prefix}:shrinking:info`,
        `${prefix}:shrinking-processed:claims`,
        `${prefix}:shrinking-processed`,
        `${prefix}:shrinking-processed-count`,
        `${prefix}:missing-processed:claims`,
        `${prefix}:missing-processed`,
        `${prefix}:missing-processed-count`,
        `${prefix}:received-count`,
        `${prefix}:malformed-received-count`,
        `${prefix}:active:info`,
        `${prefix}:active-received-count`,
        `${prefix}:error-processed:claims`,
        `${prefix}:error-processed-legacy`,
        `${prefix}:error-processed-count`,
        `${prefix}:error:results`,
        `${prefix}:partial-processed:claims`,
        `${prefix}:partial-processed`,
        `${prefix}:partial-processed-count`,
        `${prefix}:partial:error-results`,
        `${prefix}:partial:success-results`,
        `${prefix}:mixed-processed:claims`,
        `${prefix}:mixed-processed`,
        `${prefix}:mixed-processed-count`,
        `${prefix}:mixed:success-results`,
        `${prefix}:mixed:overflow-results`,
        `${prefix}:fallback:claims`,
        `${prefix}:fallback:info`,
        `${prefix}:fallback:reconciliation`,
        `${prefix}:fallback:success-results`,
        `${prefix}:fallback:overflow-results`,
        `${prefix}:fallback-count`,
        `${prefix}:fallback-legacy`,
        `${prefix}:fallback-received`,
        `${prefix}:tracking-failure:claims`,
        `${prefix}:tracking-failure-count`,
        `${prefix}:tracking-failure:results`,
        `${prefix}:tracking-failure:info`,
        `${prefix}:tracking-failure-legacy`,
        `${prefix}:invalid-claim:claims`,
        `${prefix}:invalid-claim`,
        `${prefix}:invalid-claim-count`,
        `${prefix}:invalid-claim:info`,
        `${prefix}:invalid-payload:claims`,
        `${prefix}:invalid-payload-count`,
        `${prefix}:invalid-payload:info`,
        `${prefix}:invalid-payload-legacy`,
        `${prefix}:invalid-ttl:claims`,
        `${prefix}:invalid-ttl-count`,
        `${prefix}:invalid-ttl:info`,
        `${prefix}:invalid-ttl-legacy`,
        `${prefix}:invalid-namespace:claims`,
        `${prefix}:invalid-namespace-count`,
        `${prefix}:invalid-namespace:info`,
        `${prefix}:invalid-namespace-legacy`,
        `${liveQuizKey}:i:other-instance:results`,
        `${liveQuizKey}:b:block-1:lb`,
        `${liveQuizKey}:lb`,
        `${liveQuizKey}:xp`,
        `${liveQuizKey}:b:block-1:lbTemporary`,
        `${liveQuizKey}:lbTemporary`,
        `${prefix}:invalid-arity:claims`,
        `${prefix}:invalid-arity-count`,
        `${prefix}:invalid-arity:info`,
        `${prefix}:invalid-arity-legacy`,
        `${prefix}:invalid-arity:results`,
        `${prefix}:large-batch:claims`,
        `${prefix}:large-batch-count`,
        `${prefix}:large-batch:info`,
        `${prefix}:large-batch-legacy`,
        `${prefix}:large-batch:reconciliation`,
        `${prefix}:large-batch:received`,
        `${prefix}:large-batch:results`,
        `${prefix}:oversized-batch:claims`,
        `${prefix}:oversized-batch-count`,
        `${prefix}:oversized-batch:info`,
        `${prefix}:oversized-batch-legacy`,
        `${prefix}:oversized-batch:reconciliation`,
        `${prefix}:oversized-batch:received`,
        `${prefix}:oversized-batch:results`
      )
    }
  })
})

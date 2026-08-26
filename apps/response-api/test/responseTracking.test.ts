import assert from 'node:assert/strict'
import test from 'node:test'
import {
  LIVE_QUIZ_RESPONSE_TRACKING_REDIS_OPTIONS,
  trackLiveQuizResponseIfActive,
} from '../src/responseTracking.ts'

test('configures tracking Redis commands to fail fast', () => {
  assert.deepEqual(LIVE_QUIZ_RESPONSE_TRACKING_REDIS_OPTIONS, {
    commandTimeout: 250,
    enableOfflineQueue: false,
    lazyConnect: true,
    maxRetriesPerRequest: 0,
  })
})

function createRedis({
  evalResult = '{"status":"tracked","ttl":86400}',
}: {
  evalResult?: string
}) {
  const calls = {
    eval: [] as unknown[],
  }

  return {
    calls,
    redisClient: {
      eval: async (...args: unknown[]) => {
        calls.eval.push(args)
        return evalResult
      },
    },
  }
}

test('skips received tracking when the instance is no longer active', async () => {
  const { calls, redisClient } = createRedis({
    evalResult: '{"status":"inactive"}',
  })

  const tracked = await trackLiveQuizResponseIfActive({
    redisClient,
    liveQuizId: 'quiz-1',
    instanceId: 7,
    claimId: 'message-1',
  })

  assert.equal(tracked, false)
  assert.equal(calls.eval.length, 1)
  assert.equal((calls.eval[0] as unknown[])[3], 'lq:quiz-1:i:7:info')
})

test('increments received tracking for an active instance', async () => {
  const { calls, redisClient } = createRedis({})

  const tracked = await trackLiveQuizResponseIfActive({
    redisClient,
    liveQuizId: 'quiz-2',
    instanceId: '9',
    claimId: 'message-2',
  })

  assert.equal(tracked, true)
  assert.equal(calls.eval.length, 1)
  assert.equal(
    (calls.eval[0] as unknown[])[2],
    'lq:quiz-2:i:9:responses:received:count'
  )
  assert.equal(
    (calls.eval[0] as unknown[])[4],
    'lq:quiz-2:i:9:responses:received'
  )
  assert.equal((calls.eval[0] as unknown[])[6], 'message-2')
})

test('surfaces invalid tracking responses to the ingress handler', async () => {
  const { redisClient } = createRedis({
    evalResult: 'not-a-ttl',
  })

  await assert.rejects(
    trackLiveQuizResponseIfActive({
      redisClient,
      liveQuizId: 'quiz-3',
      instanceId: 11,
      claimId: 'message-3',
    }),
    /Unexpected token|invalid result/
  )
})

test('surfaces defensive tracking failures to the ingress handler', async () => {
  const { redisClient } = createRedis({
    evalResult:
      '{"status":"tracking_failed","error":"WRONGTYPE Operation against a key"}',
  })

  await assert.rejects(
    trackLiveQuizResponseIfActive({
      redisClient,
      liveQuizId: 'quiz-4',
      instanceId: 12,
      claimId: 'message-4',
    }),
    /tracking failed: WRONGTYPE/
  )
})

test('times out a stalled tracking command so ingress can continue', async () => {
  const redisClient = {
    eval: async () => await new Promise<string>(() => undefined),
  }

  await assert.rejects(
    trackLiveQuizResponseIfActive({
      redisClient,
      liveQuizId: 'quiz-5',
      instanceId: 13,
      claimId: 'message-5',
    }),
    /tracking timed out after 250ms/
  )
})

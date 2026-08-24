import assert from 'node:assert/strict'
import test from 'node:test'
import { trackLiveQuizResponseIfActive } from '../src/responseTracking.ts'

function createRedis({
  existsResult,
  evalResult = '86400',
}: {
  existsResult: number
  evalResult?: string
}) {
  const calls = {
    eval: [] as unknown[],
    exists: [] as string[],
  }

  return {
    calls,
    redisClient: {
      exists: async (key: string) => {
        calls.exists.push(key)
        return existsResult
      },
      eval: async (...args: unknown[]) => {
        calls.eval.push(args)
        return evalResult
      },
    },
  }
}

test('skips received tracking when the instance is no longer active', async () => {
  const { calls, redisClient } = createRedis({ existsResult: 0 })

  const tracked = await trackLiveQuizResponseIfActive({
    redisClient,
    liveQuizId: 'quiz-1',
    instanceId: 7,
  })

  assert.equal(tracked, false)
  assert.deepEqual(calls.exists, ['lq:quiz-1:i:7:info'])
  assert.equal(calls.eval.length, 0)
})

test('increments received tracking for an active instance', async () => {
  const { calls, redisClient } = createRedis({ existsResult: 1 })

  const tracked = await trackLiveQuizResponseIfActive({
    redisClient,
    liveQuizId: 'quiz-2',
    instanceId: '9',
  })

  assert.equal(tracked, true)
  assert.deepEqual(calls.exists, ['lq:quiz-2:i:9:info'])
  assert.equal(calls.eval.length, 1)
  assert.equal(
    (calls.eval[0] as unknown[])[2],
    'lq:quiz-2:i:9:responses:received:count'
  )
})

test('surfaces invalid tracking responses to the ingress handler', async () => {
  const { redisClient } = createRedis({
    existsResult: 1,
    evalResult: 'not-a-ttl',
  })

  await assert.rejects(
    trackLiveQuizResponseIfActive({
      redisClient,
      liveQuizId: 'quiz-3',
      instanceId: 11,
    }),
    /invalid TTL/
  )
})

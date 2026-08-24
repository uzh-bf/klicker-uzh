import { describe, expect, it } from 'vitest'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizResponseTrackingKey,
  LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '../src/liveQuizResponseTracking.js'

describe('live quiz response tracking', () => {
  it('builds per-instance received and processed keys', () => {
    expect(
      getLiveQuizResponseTrackingKey({
        liveQuizId: 'quiz-id',
        instanceId: 42,
        status: 'received',
      })
    ).toBe('lq:quiz-id:i:42:responses:received')

    expect(
      getLiveQuizResponseTrackingKey({
        liveQuizId: 'quiz-id',
        instanceId: '43',
        status: 'processed',
      })
    ).toBe('lq:quiz-id:i:43:responses:processed')
  })

  it('builds the canonical instance info key', () => {
    expect(
      getLiveQuizInstanceInfoKey({ liveQuizId: 'quiz-id', instanceId: 42 })
    ).toBe('lq:quiz-id:i:42:info')
  })

  it('updates membership and retention in one Redis script', () => {
    expect(LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT).toContain("redis.call('SADD'")
    expect(LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT).toContain("redis.call('EXPIRE'")
    expect(LIVE_QUIZ_RESPONSE_TRACKING_SCRIPT).toContain(
      "redis.call('TTL', KEYS[2])"
    )
  })

  it('claims processing before applying commands in one atomic script', () => {
    expect(LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT).toContain(
      "redis.call('SISMEMBER'"
    )
    expect(LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT).toContain("redis.call('SADD'")
    expect(LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT).toContain('redis.pcall')
    expect(LIVE_QUIZ_RESPONSE_PROCESSING_SCRIPT).toContain('commandErrors')
  })

  it('keeps closed tracking sets for at most one day', () => {
    expect(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS).toBe(60 * 60 * 24)
  })
})

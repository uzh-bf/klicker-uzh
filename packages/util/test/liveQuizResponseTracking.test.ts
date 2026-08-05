import { describe, expect, it } from 'vitest'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizResponseTrackingKey,
  getLiveQuizResponseTrackingTtl,
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

  it('does not expire tracking sets while the instance is active', () => {
    expect(getLiveQuizResponseTrackingTtl(-1)).toBeNull()
  })

  it('mirrors the remaining retention of a closed instance', () => {
    expect(getLiveQuizResponseTrackingTtl(123)).toBe(123)
  })

  it('bounds tracking sets when the instance info is already missing', () => {
    expect(getLiveQuizResponseTrackingTtl(-2)).toBe(
      LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
    )
  })

  it('keeps closed tracking sets for at most one day', () => {
    expect(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS).toBe(60 * 60 * 24)
  })
})

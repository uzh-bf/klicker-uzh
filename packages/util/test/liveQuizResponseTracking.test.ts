import { describe, expect, it } from 'vitest'
import {
  getLiveQuizInstanceInfoKey,
  getLiveQuizLegacyResponseProcessedKey,
  getLiveQuizResponseCountKey,
  getLiveQuizResponseReplayClaimKey,
  LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS,
  LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS,
} from '../src/liveQuizResponseTracking.js'

describe('live quiz response tracking', () => {
  it('builds per-instance numeric count keys', () => {
    expect(
      getLiveQuizResponseCountKey({
        liveQuizId: 'quiz-id',
        instanceId: 42,
        status: 'received',
      })
    ).toBe('lq:quiz-id:i:42:responses:received:count')

    expect(
      getLiveQuizResponseCountKey({
        liveQuizId: 'quiz-id',
        instanceId: '43',
        status: 'processed',
      })
    ).toBe('lq:quiz-id:i:43:responses:processed:count')
  })

  it('separates the age-trimmed claim key from the legacy processed set', () => {
    expect(
      getLiveQuizResponseReplayClaimKey({
        liveQuizId: 'quiz-id',
        instanceId: 43,
      })
    ).toBe('lq:quiz-id:i:43:responses:processed:claims')

    expect(
      getLiveQuizLegacyResponseProcessedKey({
        liveQuizId: 'quiz-id',
        instanceId: 43,
      })
    ).toBe('lq:quiz-id:i:43:responses:processed')
  })

  it('builds the canonical instance info key', () => {
    expect(
      getLiveQuizInstanceInfoKey({ liveQuizId: 'quiz-id', instanceId: 42 })
    ).toBe('lq:quiz-id:i:42:info')
  })

  it('keeps retention and replay claims bounded to one day', () => {
    expect(LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS).toBe(60 * 60 * 24)
    expect(LIVE_QUIZ_RESPONSE_REPLAY_CLAIM_TTL_SECONDS).toBe(
      LIVE_QUIZ_RESPONSE_TRACKING_TTL_SECONDS
    )
  })
})

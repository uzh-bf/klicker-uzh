import { describe, expect, it } from 'vitest'
import { getLiveQuizResponseTrackingKey } from '../src/liveQuizResponseTracking.js'

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
})

import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import { describe, expect, it } from 'vitest'
import { buildLiveQuizResponsePayload } from './liveQuizResponse'

describe('buildLiveQuizResponsePayload', () => {
  it('serializes QR scans as value responses for response-api', () => {
    expect(
      buildLiveQuizResponsePayload({
        correlationKey: 'attempt-1',
        instanceId: 42,
        liveQuizId: 'quiz-1',
        type: ElementType.QrScan,
        answer: 'AbCdEf12_-34',
      })
    ).toEqual({
      correlationKey: 'attempt-1',
      instanceId: 42,
      liveQuizId: 'quiz-1',
      response: { value: 'AbCdEf12_-34' },
    })
  })
})

import {
  emitAdaptiveOperationalEvent,
  serializeAdaptiveOperationalEvent,
  type AdaptiveOperationalEvent,
} from '../src/services/adaptivePracticeQuizEvents.js'

describe('adaptive operational events', () => {
  it('serializes only the allow-listed aggregate fields', () => {
    const event = {
      name: 'adaptive_cohort_snapshot',
      outcome: 'GENERATED',
      practiceQuizId: 'quiz-1',
      releaseSize: 10,
      generationDurationMs: 42,
      participantId: 'participant-secret',
      attemptId: 'attempt-secret',
      rawResponse: 'answer-secret',
      theta: 1.25,
      elapsedSeconds: 17,
    } as unknown as AdaptiveOperationalEvent

    const serialized = JSON.stringify(serializeAdaptiveOperationalEvent(event))
    expect(serialized).toContain('quiz-1')
    expect(serialized).not.toContain('participant-secret')
    expect(serialized).not.toContain('attempt-secret')
    expect(serialized).not.toContain('answer-secret')
    expect(serialized).not.toContain('theta')
    expect(serialized).not.toContain('elapsedSeconds')
  })

  it('routes failures to error output without sensitive context', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    emitAdaptiveOperationalEvent({
      name: 'adaptive_transaction_retry',
      operation: 'COHORT_SNAPSHOT',
      outcome: 'EXHAUSTED',
      retryNumber: 3,
    })

    expect(error).toHaveBeenCalledOnce()
    expect(error.mock.calls[0]?.[0]).toContain('COHORT_SNAPSHOT')
    error.mockRestore()
  })
})

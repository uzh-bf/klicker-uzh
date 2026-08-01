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

  it('keeps IRT shadow events aggregate-only', () => {
    const event = {
      name: 'adaptive_irt_shadow_computed',
      publicationId: 'publication-1',
      scaleVersionId: 'scale-1',
      differenceBucket: 'V2_ONE_LEVEL_HIGHER',
      v1LevelOrder: 1,
      v2LeadingLevelOrder: 2,
      participantId: 'participant-secret',
      attemptId: 'attempt-secret',
      response: 'response-secret',
      solution: 'solution-secret',
      theta: 0.75,
      posterior: [0.1, 0.9],
    } as unknown as AdaptiveOperationalEvent

    const serialized = JSON.stringify(serializeAdaptiveOperationalEvent(event))
    expect(serialized).toContain('V2_ONE_LEVEL_HIGHER')
    expect(serialized).not.toMatch(
      /participant-secret|attempt-secret|response-secret|solution-secret|theta|posterior/
    )
  })

  it('keeps released cohort metrics aggregate-only', () => {
    const event = {
      name: 'adaptive_cohort_release_metrics',
      practiceQuizId: 'quiz-1',
      releaseSize: 10,
      classified: 5,
      abstained: 5,
      betweenLevels: 5,
      insufficientEvidence: 0,
      poolLimited: 0,
      researchOnly: 0,
      medianQuestionCount: 12,
      p95QuestionCount: 18,
      maxExposureRate: 0.4,
      participantId: 'participant-secret',
      response: 'response-secret',
      theta: 0.25,
    } as unknown as AdaptiveOperationalEvent

    const serialized = JSON.stringify(serializeAdaptiveOperationalEvent(event))
    expect(serialized).toContain('adaptive_cohort_release_metrics')
    expect(serialized).not.toMatch(/participant-secret|response-secret|theta/)
  })

  it('keeps estimator and export failures on fixed aggregate fields', () => {
    const estimator = JSON.stringify(
      serializeAdaptiveOperationalEvent({
        name: 'adaptive_estimator_failed',
        practiceQuizId: 'quiz-1',
        courseId: 'course-1',
        operation: 'ADVANCE',
        estimatorImplementationVersion: 'irt-v2-eap-grid-1',
        reason: 'COMPUTATION_REJECTED',
      })
    )
    const exportFailure = JSON.stringify(
      serializeAdaptiveOperationalEvent({
        name: 'adaptive_calibration_export',
        treeId: 'tree-1',
        scaleVersionId: 'scale-1',
        status: 'FAILED',
        queueAgeMs: 1200,
        failureCode: 'ADAPTIVE_EXPORT_PROCESSING_FAILED',
      })
    )

    expect(estimator).not.toMatch(/participant|response|theta|posterior/)
    expect(exportFailure).not.toMatch(/participant|response|dataset/)
  })
})

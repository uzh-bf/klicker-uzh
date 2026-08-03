import { schema } from '../src/index.js'

describe('adaptive practice quiz participant schema', () => {
  it('does not expose solutions, item parameters, or raw estimates', () => {
    expect(fieldNames('AdaptivePracticeQuizServedItem')).toEqual([
      'content',
      'elementId',
      'name',
      'options',
      'poolItemId',
      'type',
    ])
    expect(fieldNames('AdaptivePracticeQuizChoicesOptions')).toEqual([
      'choices',
      'displayMode',
    ])
    expect(fieldNames('AdaptivePracticeQuizChoice')).toEqual(['ix', 'value'])
    expect(fieldNames('AdaptivePracticeQuizNumericalOptions')).toEqual([
      'accuracy',
      'enablePercentInput',
      'placeholder',
      'restrictions',
      'unit',
    ])
    expect(
      objectFields(
        'AdaptivePracticeQuizNumericalOptions'
      ).accuracy?.type.toString()
    ).toBe('Int')
    expect(fieldNames('AdaptivePracticeQuizFreeTextOptions')).toEqual([
      'restrictions',
    ])

    const resultFields = fieldNames('AdaptivePracticeQuizResult')
    const resultNodeFields = fieldNames('AdaptivePracticeQuizResultNode')
    for (const forbidden of [
      'theta',
      'standardError',
      'posterior',
      'bandProbabilities',
      'difficulty',
      'discrimination',
      'guessing',
      'calibrationId',
      'scaleVersionId',
      'solution',
      'estimates',
      'responses',
    ]) {
      expect(resultFields).not.toContain(forbidden)
      expect(resultNodeFields).not.toContain(forbidden)
    }
    expect(resultFields).toEqual(
      expect.arrayContaining([
        'classification',
        'classificationProbability',
        'leadingLevelLabels',
        'position',
        'lowerPosition',
        'upperPosition',
      ])
    )
    expect(
      objectFields(
        'AdaptivePracticeQuizResult'
      ).levelInterpretation?.type.toString()
    ).toBe('AdaptiveLevelMappingRule!')
    expect(
      objectFields(
        'AdaptivePracticeQuizAttemptState'
      ).elapsedSeconds?.type.toString()
    ).toBe('Int')
    expect(fieldNames('AdaptivePracticeQuizSubmittedResponseFeedback')).toEqual(
      ['correct', 'feedback', 'score']
    )
    for (const forbidden of [
      'solution',
      'solutions',
      'correctChoiceIndices',
      'difficulty',
      'discrimination',
      'guessing',
      'calibrationId',
      'theta',
      'posterior',
    ]) {
      expect(
        fieldNames('AdaptivePracticeQuizSubmittedResponseFeedback')
      ).not.toContain(forbidden)
    }

    const options = schema.getType('AdaptivePracticeQuizElementOptions')
    expect(typeof (options as { getTypes?: unknown })?.getTypes).toBe(
      'function'
    )
    expect(
      (
        options as unknown as {
          getTypes: () => readonly { name: string }[]
        }
      )
        .getTypes()
        .map(({ name }) => name)
        .sort()
    ).toEqual([
      'AdaptivePracticeQuizChoicesOptions',
      'AdaptivePracticeQuizFreeTextOptions',
      'AdaptivePracticeQuizNumericalOptions',
    ])

    expect(
      schema.getMutationType()?.getFields().restartAdaptivePracticeQuizAttempt
    ).toBeDefined()
  })

  it('exposes anonymous cohort aggregates with typed suppression metadata', () => {
    const cohortFields = fieldNames('AdaptivePracticeQuizCohortResults')
    for (const identifyingField of [
      'attempts',
      'participants',
      'participantIds',
      'responses',
    ]) {
      expect(cohortFields).not.toContain(identifyingField)
    }

    expect(fieldNames('AdaptivePracticeQuizPrivacySuppression')).toEqual([
      'field',
      'reason',
    ])
    expect(schema.getType('AdaptivePracticeQuizPrivacyField')?.toString()).toBe(
      'AdaptivePracticeQuizPrivacyField'
    )
    expect(
      schema.getType('AdaptivePracticeQuizPrivacySuppressionReason')?.toString()
    ).toBe('AdaptivePracticeQuizPrivacySuppressionReason')

    const summary = objectFields('AdaptivePracticeQuizCohortAttemptSummary')
    for (const lifecycleField of [
      'total',
      'completed',
      'inProgress',
      'abandoned',
    ]) {
      expect(summary).not.toHaveProperty(lifecycleField)
    }
    for (const sensitiveField of [
      'classified',
      'betweenLevels',
      'insufficientEvidence',
      'poolLimited',
      'researchOnly',
      'capped',
      'poolExhausted',
      'stoppedInsufficientData',
      'insufficientData',
      'nearBoundary',
    ]) {
      expect(summary[sensitiveField]?.type.toString()).toBe('Int')
    }

    const distribution = objectFields('AdaptivePracticeQuizNodeDistribution')
    for (const classificationField of [
      'classifiedCount',
      'betweenLevelsCount',
      'insufficientEvidenceCount',
      'poolLimitedCount',
      'researchOnlyCount',
    ]) {
      expect(distribution[classificationField]?.type.toString()).toBe('Int')
    }
  })
})

function fieldNames(typeName: string) {
  return Object.keys(objectFields(typeName)).sort()
}

function objectFields(typeName: string) {
  const type = schema.getType(typeName)
  expect(typeof (type as { getFields?: unknown })?.getFields).toBe('function')
  return (
    type as {
      getFields: () => Record<string, { type: { toString: () => string } }>
    }
  ).getFields()
}

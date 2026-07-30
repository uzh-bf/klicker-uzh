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
    expect(resultFields).not.toContain('theta')
    expect(resultFields).not.toContain('standardError')
    expect(resultFields).not.toContain('estimates')
    expect(resultFields).not.toContain('responses')
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
      'capped',
      'poolExhausted',
      'stoppedInsufficientData',
      'insufficientData',
      'nearBoundary',
    ]) {
      expect(summary[sensitiveField]?.type.toString()).toBe('Int')
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

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
    expect(fieldNames('AdaptivePracticeQuizFreeTextOptions')).toEqual([
      'restrictions',
    ])

    const resultFields = fieldNames('AdaptivePracticeQuizResult')
    expect(resultFields).not.toContain('theta')
    expect(resultFields).not.toContain('standardError')
    expect(resultFields).not.toContain('estimates')
    expect(resultFields).not.toContain('responses')

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
})

function fieldNames(typeName: string) {
  const type = schema.getType(typeName)
  expect(typeof (type as { getFields?: unknown })?.getFields).toBe('function')
  return Object.keys(
    (type as { getFields: () => Record<string, unknown> }).getFields()
  ).sort()
}

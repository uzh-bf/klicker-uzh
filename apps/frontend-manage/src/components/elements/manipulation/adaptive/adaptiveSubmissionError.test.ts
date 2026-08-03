import { describe, expect, it } from 'vitest'
import { getAdaptiveSubmissionErrorKey } from './adaptiveSubmissionError'

function graphQLError(code: string) {
  return { graphQLErrors: [{ extensions: { code } }] }
}

describe('adaptive element submission errors', () => {
  it.each([
    ['COMPETENCE_TREE_STRUCTURE_LOCKED', 'locked'],
    ['COMPETENCE_TREE_ASSIGNMENT_COVERAGE_INVALID', 'coverage'],
    ['COMPETENCE_TREE_INVALID', 'invalid'],
    ['NOT_FOUND', 'unavailable'],
    ['FORBIDDEN', 'unavailable'],
  ] as const)('maps %s to %s feedback', (code, expected) => {
    expect(getAdaptiveSubmissionErrorKey(graphQLError(code))).toBe(expected)
  })

  it('falls back for unrelated and malformed failures', () => {
    expect(getAdaptiveSubmissionErrorKey(graphQLError('INTERNAL_ERROR'))).toBe(
      null
    )
    expect(getAdaptiveSubmissionErrorKey(new Error('offline'))).toBe(null)
  })
})

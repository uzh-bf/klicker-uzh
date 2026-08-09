import { describe, expect, test } from 'vitest'
import { getThreadSuggestions } from '../src/lib/config/suggestions'

describe('thread suggestions', () => {
  test('uses practice starters for Tutor and explanation starters for Explainer', () => {
    expect(getThreadSuggestions('tutor')).toEqual([
      { id: 'practiceTopic' },
      { id: 'workThroughProblem' },
    ])
    expect(getThreadSuggestions('explainer')).toEqual([
      { id: 'explainConcept' },
      { id: 'summarizeTopic' },
    ])
  })

  test('does not offer the broad whole-course study-plan starter', () => {
    const suggestionIds = [
      ...getThreadSuggestions('tutor'),
      ...getThreadSuggestions('explainer'),
    ].map(({ id }) => id)

    expect(suggestionIds).not.toContain('examPrep')
  })

  test('falls back to Tutor starters for unknown chatbot modes', () => {
    expect(getThreadSuggestions('custom-mode')).toEqual(
      getThreadSuggestions('tutor')
    )
  })
})

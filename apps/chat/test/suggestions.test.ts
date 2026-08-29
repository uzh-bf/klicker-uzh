import { describe, expect, test } from 'vitest'
import {
  parseModeOptions,
  resolveSelectedMode,
} from '../src/lib/config/modes'
import { getThreadSuggestions } from '../src/lib/config/suggestions'

describe('thread suggestions', () => {
  test('uses practice starters for Tutor and explanation starters for Explainer', () => {
    expect(getThreadSuggestions('tutor')).toEqual([
      { id: 'practiceTopic' },
      { id: 'workThroughProblem' },
    ])
    expect(getThreadSuggestions('explainer')).toEqual([
      { id: 'explainConcept' },
      { id: 'compareConcepts' },
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

  test('accepts only server-resolved mode description records', () => {
    expect(
      parseModeOptions({
        tutor: 'Tutor description',
        explainer: 'Explainer description',
      })
    ).toEqual({
      tutor: 'Tutor description',
      explainer: 'Explainer description',
    })
    expect(parseModeOptions({ tutor: { description: 'Tutor' } })).toBeNull()
    expect(parseModeOptions(null)).toBeNull()
  })

  test('resolves a selected mode by key even when its description is empty', () => {
    expect(
      resolveSelectedMode({ tutor: 'Tutor mode', custom: '' }, 'custom')
    ).toBe('custom')
    expect(resolveSelectedMode({}, 'tutor')).toBe('')
  })
})

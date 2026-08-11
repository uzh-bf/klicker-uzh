import { describe, expect, test } from 'vitest'
import {
  resolveModeDescriptions,
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

  test('resolves only mode descriptions for the initial welcome shell', () => {
    expect(
      resolveModeDescriptions({
        tutor: { prompt: 'private prompt', description: 'Tutor description' },
        explainer: {
          prompt: 'private prompt',
          description: 'Explainer description',
        },
        invalid: 'not a mode config',
      })
    ).toEqual({
      tutor: 'Tutor description',
      explainer: 'Explainer description',
      invalid: '',
    })
  })

  test('uses the tutor fallback when a chatbot has no mode descriptions', () => {
    expect(resolveModeDescriptions(null)).toEqual({
      tutor: 'Acts as a patient and knowledgeable tutor.',
    })
  })

  test('resolves a selected mode by key even when its description is empty', () => {
    expect(
      resolveSelectedMode({ tutor: 'Tutor mode', custom: '' }, 'custom')
    ).toBe('custom')
  })
})

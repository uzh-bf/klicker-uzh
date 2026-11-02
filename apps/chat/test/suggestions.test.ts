import { describe, expect, test } from 'vitest'
import { parseModeOptions, resolveSelectedMode } from '../src/lib/config/modes'
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
    expect(getThreadSuggestions('quizzer')).toEqual([
      { id: 'startPracticeQuiz' },
      { id: 'practiceWeakSpot' },
    ])
  })

  test('does not offer the broad whole-course study-plan starter', () => {
    const suggestionIds = [
      ...getThreadSuggestions('tutor'),
      ...getThreadSuggestions('explainer'),
      ...getThreadSuggestions('quizzer'),
    ].map(({ id }) => id)

    expect(suggestionIds).not.toContain('examPrep')
  })

  test('offers no starters for chatbot-defined modes', () => {
    expect(getThreadSuggestions('custom-mode')).toEqual([])
    expect(getThreadSuggestions('ethik-rollenspiel')).toEqual([])
  })

  test('accepts only server-resolved mode description records', () => {
    expect(
      parseModeOptions({
        tutor: { description: 'Tutor description' },
        explainer: { description: 'Explainer description' },
      })
    ).toEqual({
      tutor: { description: 'Tutor description' },
      explainer: { description: 'Explainer description' },
    })
    expect(parseModeOptions({ tutor: 'Tutor description' })).toEqual({
      tutor: { description: 'Tutor description' },
    })
    expect(parseModeOptions({ tutor: { name: 'Tutor' } })).toBeNull()
    expect(parseModeOptions({ '': 'Blank mode' })).toBeNull()
    expect(parseModeOptions({ '   ': 'Whitespace mode' })).toBeNull()
    expect(parseModeOptions(null)).toBeNull()
  })

  test('resolves a selected mode by key even when its description is empty', () => {
    expect(
      resolveSelectedMode(
        { tutor: { description: 'Tutor mode' }, custom: { description: '' } },
        'custom'
      )
    ).toBe('custom')
    expect(resolveSelectedMode({}, 'tutor')).toBe('')
  })

  test('keeps optional welcome text without trusting malformed presentation values', () => {
    const welcomeMessage = 'Synthetic introduction\nSecond line'
    expect(
      parseModeOptions({ custom: { description: '', welcomeMessage } })
    ).toEqual({ custom: { description: '', welcomeMessage } })
    expect(
      parseModeOptions({ custom: { description: '', welcomeMessage: {} } })
    ).toEqual({ custom: { description: '' } })
  })

  test('preserves valid authored starter order and ignores malformed optional entries', () => {
    const starterPrompts = ['Synthetic start', 'Synthetic explanation']
    expect(
      parseModeOptions({ custom: { description: '', starterPrompts } })
    ).toEqual({ custom: { description: '', starterPrompts } })
    expect(
      parseModeOptions({
        custom: {
          description: '',
          starterPrompts: [null, '', 'Synthetic start', {}],
        },
      })
    ).toEqual({
      custom: { description: '', starterPrompts: ['Synthetic start'] },
    })
    expect(
      parseModeOptions({ custom: { description: '', starterPrompts: {} } })
    ).toEqual({ custom: { description: '' } })
  })
})

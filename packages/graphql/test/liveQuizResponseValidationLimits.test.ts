import { DisplayMode, MAX_LIVE_QUIZ_CHOICES } from '@klicker-uzh/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import validateCaseStudyOptions from '../src/lib/validateCaseStudyOptions.js'
import validateMCOptions from '../src/lib/validateMCOptions.js'
import validateSelectionOptions from '../src/lib/validateSelectionOptions.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('live quiz response authoring limits', () => {
  it('caps choices at the worker validation budget', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const options = {
      choices: Array.from({ length: MAX_LIVE_QUIZ_CHOICES }, (_, ix) => ({
        ix,
        value: `Choice ${ix + 1}`,
      })),
      displayMode: DisplayMode.LIST,
      hasAnswerFeedbacks: false,
      hasSampleSolution: false,
    }

    expect(validateMCOptions(options)).toBe(true)
    expect(
      validateMCOptions({
        ...options,
        choices: [
          ...options.choices,
          {
            ix: MAX_LIVE_QUIZ_CHOICES,
            value: `Choice ${MAX_LIVE_QUIZ_CHOICES + 1}`,
          },
        ],
      })
    ).toBe(false)
  })

  it('caps selection inputs at the worker validation budget', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)

    expect(
      validateSelectionOptions({
        answerCollection: 1,
        hasSampleSolution: false,
        numberOfInputs: 100,
      })
    ).toBe(true)
    expect(
      validateSelectionOptions({
        answerCollection: 1,
        hasSampleSolution: false,
        numberOfInputs: 101,
      })
    ).toBe(false)
  })

  it('caps case-study response entries at the atomic Redis budget', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const options = {
      answerCollection: 1,
      cases: [
        {
          description: 'Description',
          id: 'case-1',
          order: 0,
          title: 'Case',
        },
      ],
      collectionItemIds: Array.from({ length: 1000 }, (_, index) => index + 1),
      criteria: [
        {
          id: 'criterion-1',
          max: 5,
          min: 1,
          name: 'Criterion',
          order: 0,
          step: 1,
        },
      ],
      hasSampleSolution: false,
    }

    expect(validateCaseStudyOptions(options)).toBe(true)
    expect(
      validateCaseStudyOptions({
        ...options,
        collectionItemIds: [...options.collectionItemIds, 1001],
      })
    ).toBe(false)
  })
})

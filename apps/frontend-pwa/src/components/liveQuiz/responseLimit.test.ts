import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { getEffectiveResponseLimit } from './responseLimit'

const freeText = (responseLimit?: number | null) => ({
  elementData: {
    __typename: 'FreeTextElementData',
    options: { responseLimit },
  },
})

describe('live quiz response limit', () => {
  it('applies the free-text limit in standard live quizzes', () => {
    assert.equal(
      getEffectiveResponseLimit({
        instance: freeText(3),
        isAssessmentEnabled: false,
      }),
      3
    )
  })

  it('accepts a single response in assessment live quizzes', () => {
    assert.equal(
      getEffectiveResponseLimit({
        instance: freeText(3),
        isAssessmentEnabled: true,
      }),
      1
    )
  })

  it('falls back to a single response without a valid limit', () => {
    for (const limit of [undefined, null, 0, 2.5]) {
      assert.equal(
        getEffectiveResponseLimit({
          instance: freeText(limit),
          isAssessmentEnabled: false,
        }),
        1
      )
    }
  })

  it('ignores the option on other element types', () => {
    assert.equal(
      getEffectiveResponseLimit({
        instance: {
          elementData: {
            __typename: 'NumericalElementData',
            options: { responseLimit: 3 },
          },
        },
        isAssessmentEnabled: false,
      }),
      1
    )
  })
})

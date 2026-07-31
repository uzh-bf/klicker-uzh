import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { normalizeLearningAnalyticsChoice } from './learningAnalyticsValidation'

describe('normalizeLearningAnalyticsChoice', () => {
  it('keeps an empty choice optional so participants can decide later', () => {
    assert.equal(normalizeLearningAnalyticsChoice(''), undefined)
  })

  it('preserves an explicit choice', () => {
    assert.equal(normalizeLearningAnalyticsChoice('INCLUDED'), 'INCLUDED')
    assert.equal(normalizeLearningAnalyticsChoice('EXCLUDED'), 'EXCLUDED')
  })
})

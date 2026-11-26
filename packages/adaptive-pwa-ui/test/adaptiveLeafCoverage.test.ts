import { describe, expect, it } from 'vitest'
import { getAdaptiveProfileNotTestedLabelKey } from '../src/components/practiceQuiz/adaptive/adaptiveLeafCoverage'

describe('not-tested profile label', () => {
  it('explains leaves outside the student level range', () => {
    expect(getAdaptiveProfileNotTestedLabelKey('OUT_OF_RANGE')).toBe(
      'pwa.practiceQuiz.adaptive.profile.notTestedOutOfRange'
    )
  })

  it('keeps the plain label for other or missing statuses', () => {
    for (const status of ['NOT_SAMPLED', 'COVERED', null, undefined])
      expect(getAdaptiveProfileNotTestedLabelKey(status)).toBe(
        'pwa.practiceQuiz.adaptive.profile.notTested'
      )
  })
})

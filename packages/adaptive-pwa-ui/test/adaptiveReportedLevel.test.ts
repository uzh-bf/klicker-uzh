import { describe, expect, it } from 'vitest'
import { getAdaptiveReportedLevelLabel } from '../src/components/practiceQuiz/adaptive/adaptiveReportedLevel'

// "Under A2" has no published elements; A2.1 is the lowest measurable band.
const levelBands = [
  { label: 'Under A2', order: 0, hasElements: false },
  { label: 'A2.1', order: 1, hasElements: true },
  { label: 'A2.2', order: 2, hasElements: true },
  { label: 'B1.1', order: 3, hasElements: true },
  { label: 'Above B1', order: 4, hasElements: false },
]

describe('reported level label', () => {
  it('names the lowest measurable band at or below the bottom edge', () => {
    for (const levelLabel of ['Under A2', 'A2.1'])
      expect(
        getAdaptiveReportedLevelLabel({
          levelLabel,
          levelBands,
          classified: true,
        })
      ).toEqual({
        key: 'pwa.practiceQuiz.adaptive.profile.levelBelowRange',
        values: { level: 'A2.1' },
      })
  })

  it('names the highest measurable band at or above the top edge', () => {
    expect(
      getAdaptiveReportedLevelLabel({
        levelLabel: 'Above B1',
        levelBands,
        classified: false,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.levelAboveRange',
      values: { level: 'B1.1' },
    })
  })

  it('adds the tolerance only to classified levels inside the range', () => {
    expect(
      getAdaptiveReportedLevelLabel({
        levelLabel: 'A2.2',
        levelBands,
        toleranceBands: 1,
        classified: true,
      })
    ).toEqual({
      key: 'pwa.practiceQuiz.adaptive.profile.levelWithTolerance',
      values: { level: 'A2.2', count: 1 },
    })
    expect(
      getAdaptiveReportedLevelLabel({
        levelLabel: 'A2.2',
        levelBands,
        toleranceBands: 1,
        classified: false,
      }).key
    ).toBe('pwa.practiceQuiz.adaptive.profile.levelExact')
  })

  it('keeps the exact label without tolerance or edge information', () => {
    const allCovered = levelBands.map(({ label, order }) => ({ label, order }))
    for (const levelLabel of ['Under A2', 'A2.2', 'Above B1'])
      expect(
        getAdaptiveReportedLevelLabel({
          levelLabel,
          levelBands: allCovered,
          toleranceBands: 0,
          classified: true,
        })
      ).toEqual({
        key: 'pwa.practiceQuiz.adaptive.profile.levelExact',
        values: { level: levelLabel },
      })
  })
})

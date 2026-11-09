import { describe, expect, it } from 'vitest'
import {
  resolveLegacyRoughEstimate,
  resolveV2RoughLevelLabel,
} from '../src/services/adaptivePracticeQuizRoughEstimate.js'

const levels = ['Under A2', 'A2.1', 'A2.2', 'B1.1', 'B1.2'].map(
  (label, order) => ({ label, order })
)
const base = {
  levels,
  range: { min: -3, max: 3 },
  mappingRule: 'NEAREST' as const,
  z: 1.28,
}

describe('adaptive rough estimate (display only)', () => {
  it('maps theta with the runtime level mapping and a clipped range', () => {
    // NEAREST over 5 levels: centers at -3, -1.5, 0, 1.5, 3.
    const rough = resolveLegacyRoughEstimate({
      ...base,
      estimate: { theta: 0.2, standardError: 1, responseCount: 2 },
    })
    expect(rough).toEqual({
      roughLevelLabel: 'A2.2',
      position: (0.2 + 3) / 6,
      lowerPosition: (0.2 - 1.28 + 3) / 6,
      upperPosition: (0.2 + 1.28 + 3) / 6,
    })
  })

  it('uses the mastery rule when the quiz does', () => {
    const rough = resolveLegacyRoughEstimate({
      ...base,
      mappingRule: 'MASTERY',
      estimate: { theta: 0.2, standardError: 0.1, responseCount: 1 },
    })
    // MASTERY over 5 levels: lower bounds at -3, -1.8, -0.6, 0.6, 1.8.
    expect(rough?.roughLevelLabel).toBe('A2.2')
  })

  it('clips the plausible range to the scale and clamps theta at the edges', () => {
    const high = resolveLegacyRoughEstimate({
      ...base,
      estimate: { theta: 3, standardError: 2, responseCount: 2 },
    })
    expect(high).toMatchObject({
      roughLevelLabel: 'B1.2',
      position: 1,
      upperPosition: 1,
    })
    expect(high!.lowerPosition).toBeCloseTo((3 - 2.56 + 3) / 6)
    const beyond = resolveLegacyRoughEstimate({
      ...base,
      estimate: { theta: -7, standardError: 0.5, responseCount: 1 },
    })
    // The range is centered on the clamped theta, so it stays on the scale.
    expect(beyond).toMatchObject({
      roughLevelLabel: 'Under A2',
      position: 0,
      lowerPosition: 0,
    })
    expect(beyond!.upperPosition).toBeCloseTo(0.64 / 6)
  })

  it('spans the whole scale when the standard error is missing or infinite', () => {
    for (const standardError of [
      null,
      Number.POSITIVE_INFINITY,
      Number.NaN,
      -1,
    ]) {
      expect(
        resolveLegacyRoughEstimate({
          ...base,
          estimate: { theta: 1.4, standardError, responseCount: 2 },
        })
      ).toEqual({
        roughLevelLabel: 'B1.1',
        position: (1.4 + 3) / 6,
        lowerPosition: 0,
        upperPosition: 1,
      })
    }
  })

  it('returns nothing without answers or a usable theta', () => {
    for (const estimate of [
      undefined,
      { theta: 0.5, standardError: 1, responseCount: 0 },
      { theta: null, standardError: 1, responseCount: 2 },
      { theta: Number.NaN, standardError: 1, responseCount: 2 },
      { theta: Number.POSITIVE_INFINITY, standardError: 1, responseCount: 2 },
    ]) {
      expect(resolveLegacyRoughEstimate({ ...base, estimate })).toBeNull()
    }
    expect(
      resolveLegacyRoughEstimate({
        ...base,
        levels: [],
        estimate: { theta: 0, standardError: 1, responseCount: 2 },
      })
    ).toBeNull()
  })

  it('uses the v2 posterior leading band, then the band of the mean', () => {
    const v2Levels = [
      { scaleLevelId: 10, label: 'A2', order: 0, lowerBound: null },
      { scaleLevelId: 11, label: 'B1', order: 1, lowerBound: -0.5 },
      { scaleLevelId: 12, label: 'B2', order: 2, lowerBound: 0.8 },
    ]
    expect(
      resolveV2RoughLevelLabel({
        theta: 1.5,
        bandProbabilities: { '10': 0.2, '11': 0.5, '12': 0.3 },
        levels: v2Levels,
      })
    ).toBe('B1')
    expect(
      resolveV2RoughLevelLabel({
        theta: 1.5,
        bandProbabilities: null,
        levels: v2Levels,
      })
    ).toBe('B2')
    expect(
      resolveV2RoughLevelLabel({
        theta: -2,
        bandProbabilities: ['not', 'a', 'map'],
        levels: v2Levels,
      })
    ).toBe('A2')
    expect(
      resolveV2RoughLevelLabel({
        theta: null,
        bandProbabilities: undefined,
        levels: v2Levels,
      })
    ).toBeNull()
  })
})

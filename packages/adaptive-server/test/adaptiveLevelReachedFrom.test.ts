import {
  levelMasteryOf,
  mapLevelsToTheta,
  mapThetaToLevel,
} from '@klicker-uzh/adaptive-contract'
import * as DB from '@klicker-uzh/prisma/client'
import { describe, expect, it } from 'vitest'
import { resolvePresetSettings } from '../src/services/adaptivePracticeQuizConfigSettings.js'
import { v1EngineSettings } from '../src/services/adaptivePracticeQuizEstimatorVersions.js'

// Four NEAREST levels on [-3, 3]: points -3, -1, 1, 3; bands at midpoints.
const levels = [0, 1, 2, 3].map((order) => ({
  id: order + 1,
  label: `L${order}`,
  order,
}))
const range = { min: -3, max: 3 }

describe('level reached from', () => {
  it('moves level starts up within each band and keeps the top reachable', () => {
    expect(
      mapLevelsToTheta(levels, range, 'NEAREST', 0.7).map(
        ({ lowerBound }) => lowerBound
      )
    ).toEqual([
      Number.NEGATIVE_INFINITY,
      expect.closeTo(-0.6),
      expect.closeTo(1.4),
      expect.closeTo(2.7),
    ])
    // the clamped maximum (3) still reaches the top level
    expect(
      mapLevelsToTheta(levels, range, 'NEAREST', 0.95).at(-1)!.lowerBound
    ).toBeLessThan(3)
    expect(mapLevelsToTheta(levels, range, 'NEAREST', 0)).toEqual(
      mapLevelsToTheta(levels, range, 'NEAREST')
    )
  })
})

describe('mastery mark settings', () => {
  const treeDefaults = {
    defaultDiscrimination: 1.2,
    defaultTotalQuestionCap: 50,
    defaultTimeLimitSeconds: null,
  }
  const resolve = (levelReachedFrom?: number) =>
    resolvePresetSettings(
      {
        competenceTreeId: 'tree',
        preset: DB.AdaptivePracticeQuizPreset.DIAGNOSTIC,
        levelReachedFrom,
      },
      treeDefaults
    )

  it('defaults to 70% for new configurations and accepts 0-95%', () => {
    expect(resolve().levelReachedFrom).toBe(0.7)
    expect(resolve(0).levelReachedFrom).toBe(0)
    expect(resolve(0.95).levelReachedFrom).toBe(0.95)
    for (const invalid of [-0.1, 0.96, Number.NaN])
      expect(() => resolve(invalid)).toThrow(
        expect.objectContaining({
          extensions: { code: 'ADAPTIVE_LEVEL_REACHED_FROM_INVALID' },
        })
      )
  })

  it('never sends the mastery mark to the engine', () => {
    const settings = {
      totalQuestionCap: 20,
      perLeafQuestionCap: null,
      minQuestionsPerLeaf: 2,
      classificationZ: 1,
      topInformationRatio: 0.8,
      levelMappingRule: 'NEAREST' as const,
      thetaRange: range,
    }
    expect(
      'levelReachedFrom' in
        v1EngineSettings({ ...settings, levelReachedFrom: 0 })
    ).toBe(false)
    expect(
      'levelReachedFrom' in
        v1EngineSettings({ ...settings, levelReachedFrom: 0.7 })
    ).toBe(false)
  })
})

describe('level mastery', () => {
  // Plain NEAREST bands: L1 -2..0, L2 0..2; L0 and L3 closed at -3 and 3.
  const mastery = (theta: number, masteryFrom = 0.7) =>
    levelMasteryOf({
      theta,
      levels,
      range,
      mappingRule: 'NEAREST',
      masteryFrom,
    })

  it('reports the plain band and whether 70% of it is reached', () => {
    expect(mastery(-1)).toEqual({ order: 1, share: 0.5, mastered: false })
    expect(mastery(-0.6)).toMatchObject({ order: 1, mastered: true })
    expect(mastery(-0.61)).toMatchObject({ order: 1, mastered: false })
    expect(mastery(1.5)).toMatchObject({ order: 2, mastered: true })
  })

  it('closes the outer bands at the ends of the range', () => {
    expect(mastery(-2.5)).toMatchObject({
      order: 0,
      share: 0.5,
      mastered: false,
    })
    expect(mastery(3)).toMatchObject({ order: 3, share: 1, mastered: true })
  })

  it('is off at 0', () => {
    expect(mastery(-0.5, 0).mastered).toBeNull()
  })
})

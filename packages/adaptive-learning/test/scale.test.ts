import { describe, expect, it } from 'vitest'
import {
  MAX_ADAPTIVE_POSTERIOR_GRID_POINTS,
  levelForTheta,
  validateAdaptiveScale,
  type AdaptiveScaleDefinition,
} from '../src/scale.js'

function createScale(): AdaptiveScaleDefinition {
  return {
    priorMean: 0,
    priorStandardDeviation: 1,
    gridMin: -6,
    gridMax: 6,
    gridStep: 0.1,
    classificationPolicyVersion: 1,
    levels: [
      {
        id: 1,
        label: 'Foundation',
        order: 0,
        lowerBound: Number.NEGATIVE_INFINITY,
        upperBound: -1.5,
        itemDifficultyPrior: -3,
      },
      {
        id: 2,
        label: 'Independent',
        order: 1,
        lowerBound: -1.5,
        upperBound: 1.5,
        itemDifficultyPrior: 0,
      },
      {
        id: 3,
        label: 'Advanced',
        order: 2,
        lowerBound: 1.5,
        upperBound: Number.POSITIVE_INFINITY,
        itemDifficultyPrior: 3,
      },
    ],
  }
}

describe('explicit adaptive scale', () => {
  it('maps exact lower cuts into the higher band', () => {
    const scale = createScale()

    expect(validateAdaptiveScale(scale)).toEqual([])
    expect(levelForTheta(-1.5, scale.levels)?.label).toBe('Independent')
    expect(levelForTheta(1.5, scale.levels)?.label).toBe('Advanced')
  })

  it('maps only finite theta values and does not rely on input array order', () => {
    const levels = [...createScale().levels].reverse()

    expect(levelForTheta(-10, levels)?.label).toBe('Foundation')
    expect(levelForTheta(10, levels)?.label).toBe('Advanced')
    expect(levelForTheta(Number.NEGATIVE_INFINITY, levels)).toBeNull()
    expect(levelForTheta(Number.POSITIVE_INFINITY, levels)).toBeNull()
    expect(levelForTheta(Number.NaN, levels)).toBeNull()
  })

  it('rejects gaps and overlaps between bands', () => {
    const gap = createScale()
    gap.levels[1]!.lowerBound = -1.4
    expect(validateAdaptiveScale(gap)).toContain(
      'Level bands must be contiguous.'
    )

    const overlap = createScale()
    overlap.levels[1]!.lowerBound = -1.6
    expect(validateAdaptiveScale(overlap)).toContain(
      'Level bands must be contiguous.'
    )
  })

  it('rejects missing or non-contiguous level order values', () => {
    const tooShort = createScale()
    tooShort.levels = tooShort.levels.slice(0, 1)
    expect(validateAdaptiveScale(tooShort)).toContain(
      'At least two levels are required.'
    )

    const unordered = createScale()
    unordered.levels[1]!.order = 2
    expect(validateAdaptiveScale(unordered)).toContain(
      'Level order must be contiguous.'
    )
  })

  it('rejects malformed priors, grids, and policy versions', () => {
    const invalid = createScale()
    invalid.priorMean = Number.NaN
    invalid.priorStandardDeviation = Number.POSITIVE_INFINITY
    invalid.gridMin = Number.NEGATIVE_INFINITY
    invalid.gridStep = 0
    invalid.classificationPolicyVersion = 0

    expect(validateAdaptiveScale(invalid)).toEqual(
      expect.arrayContaining([
        'Prior mean must be finite.',
        'Prior standard deviation must be positive.',
        'Posterior grid values must be finite.',
        'The posterior grid must be increasing.',
        'A supported classification policy version is required.',
      ])
    )
  })

  it('requires the prior to be resolvable by the posterior grid', () => {
    const invalid = createScale()
    invalid.priorStandardDeviation = invalid.gridStep / 2

    expect(validateAdaptiveScale(invalid)).toContain(
      'Prior standard deviation must be at least the posterior grid step.'
    )
  })

  it('requires a bounded canonical grid with both endpoints addressable', () => {
    const nonDivisible = createScale()
    nonDivisible.gridStep = 0.07
    expect(validateAdaptiveScale(nonDivisible)).toContain(
      'The posterior grid span must be divisible by its step.'
    )

    const tooDense = createScale()
    tooDense.gridStep = 0.001
    expect(validateAdaptiveScale(tooDense)).toContain(
      `The posterior grid must contain at most ${MAX_ADAPTIVE_POSTERIOR_GRID_POINTS} points.`
    )

    const asymmetric = createScale()
    asymmetric.gridMin = -5.9
    asymmetric.gridMax = 6.1
    expect(validateAdaptiveScale(asymmetric)).toEqual([])
  })

  it('keeps the prior, cuts, and item priors inside the posterior grid', () => {
    const invalid = createScale()
    invalid.gridMin = -2
    invalid.gridMax = 2
    invalid.priorMean = 3
    invalid.levels[0]!.upperBound = -2
    invalid.levels[1]!.lowerBound = -2
    invalid.levels[2]!.itemDifficultyPrior = 3

    expect(validateAdaptiveScale(invalid)).toEqual(
      expect.arrayContaining([
        'Prior mean must lie within the posterior grid.',
        'Internal level bounds must lie inside the posterior grid.',
        'Item difficulty priors must lie within the posterior grid.',
      ])
    )
  })

  it('enforces supported theta bounds without rejecting exact boundaries', () => {
    const bounded = createScale()
    bounded.gridMin = -10
    bounded.gridMax = 10
    bounded.levels[0]!.itemDifficultyPrior = -10
    bounded.levels[2]!.itemDifficultyPrior = 10
    expect(validateAdaptiveScale(bounded)).toEqual([])

    bounded.priorMean = 10.1
    bounded.gridMax = 10.1
    expect(validateAdaptiveScale(bounded)).toEqual(
      expect.arrayContaining([
        'Prior mean must be within supported theta bounds.',
        'The posterior grid must stay within supported theta bounds.',
      ])
    )
  })

  it('rejects invalid band endpoints and item-difficulty priors', () => {
    const invalid = createScale()
    invalid.levels[0]!.lowerBound = -6
    invalid.levels[1]!.upperBound = Number.NaN
    invalid.levels[2]!.itemDifficultyPrior = 10.1

    expect(validateAdaptiveScale(invalid)).toEqual(
      expect.arrayContaining([
        'The first level must start at negative infinity.',
        'Level bounds must define increasing intervals.',
        'Level bands must be contiguous.',
        'Item difficulty priors must be finite and within supported theta bounds.',
      ])
    )
  })

  it('requires stable unique IDs and non-empty labels', () => {
    const invalid = createScale()
    invalid.levels[0]!.id = 0
    invalid.levels[1]!.id = invalid.levels[2]!.id
    invalid.levels[2]!.label = '   '

    expect(validateAdaptiveScale(invalid)).toEqual(
      expect.arrayContaining([
        'Level IDs must be positive integers.',
        'Level IDs must be unique.',
        'Level labels must not be empty.',
      ])
    )
  })

  it('does not mutate level order while validating or mapping', () => {
    const scale = createScale()
    scale.levels.reverse()
    const before = structuredClone(scale)

    expect(validateAdaptiveScale(scale)).toEqual([])
    expect(levelForTheta(0, scale.levels)?.label).toBe('Independent')
    expect(scale).toEqual(before)
  })
})

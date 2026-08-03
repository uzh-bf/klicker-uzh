import { describe, expect, it } from 'vitest'
import { combineWeightedPosteriors } from '../src/composite.js'
import {
  buildAdaptivePosteriorGrid,
  summarizeAdaptivePosterior,
} from '../src/posterior.js'
import type { AdaptiveScaleDefinition } from '../src/scale.js'

const scale = createScale()

describe('weighted adaptive posterior composite', () => {
  it('combines independent roots without counting descendants again', () => {
    const left = normalPosterior(-2, 0.4)
    const right = normalPosterior(2, 0.4)
    const combined = combineWeightedPosteriors({
      scale,
      credibleMass: 0.9,
      entries: [
        { key: 'root-a', posterior: left, weight: 3 },
        { key: 'root-b', posterior: right, weight: 2 },
      ],
    })

    expect(combined.mean).toBeCloseTo(-0.4, 12)
    expect(sum(combined.probabilities)).toBeCloseTo(1, 12)
    const expectedVariance =
      (3 / 5) ** 2 * left.variance + (2 / 5) ** 2 * right.variance
    const varianceBound = (2 * scale.gridStep ** 2) / 4 + 1e-12
    expect(Math.abs(combined.variance - expectedVariance)).toBeLessThanOrEqual(
      varianceBound
    )
  })

  it('is invariant to root order and proportional weight scaling', () => {
    const entries = [
      { key: 'root-a', posterior: normalPosterior(-1, 0.6), weight: 3 },
      { key: 'root-b', posterior: normalPosterior(1.5, 0.8), weight: 2 },
    ]
    const baseline = combineWeightedPosteriors({
      entries,
      scale,
      credibleMass: 0.9,
    })
    const reordered = combineWeightedPosteriors({
      entries: [
        { ...entries[1]!, weight: 200 },
        { ...entries[0]!, weight: 300 },
      ],
      scale,
      credibleMass: 0.9,
    })

    expect(reordered.probabilities).toEqual(baseline.probabilities)
    expect(reordered.mean).toBe(baseline.mean)
    expect(reordered.variance).toBe(baseline.variance)
  })

  it('is invariant across every permutation of three roots', () => {
    const entries = [
      { key: 'root-a', posterior: normalPosterior(-2, 0.4), weight: 5 },
      { key: 'root-b', posterior: normalPosterior(0.5, 0.7), weight: 3 },
      { key: 'root-c', posterior: normalPosterior(2, 0.5), weight: 2 },
    ]
    const results = permutations(entries).map((permuted) =>
      combineWeightedPosteriors({
        entries: permuted,
        scale,
        credibleMass: 0.9,
      })
    )

    for (const result of results.slice(1)) {
      expect(result.probabilities).toEqual(results[0]!.probabilities)
      expect(result.mean).toBe(results[0]!.mean)
      expect(result.variance).toBe(results[0]!.variance)
    }
  })

  it('preserves a single root exactly and validates zero-weight entries', () => {
    const posterior = normalPosterior(0.7, 0.5)
    const combined = combineWeightedPosteriors({
      entries: [
        { key: 'ignored', posterior: normalPosterior(-4, 0.2), weight: 0 },
        { key: 'root', posterior, weight: 7 },
      ],
      scale,
      credibleMass: 0.9,
    })

    expect(combined.probabilities).toEqual(posterior.probabilities)
    expect(combined.mean).toBeCloseTo(posterior.mean, 12)
  })

  it('preserves means on one-sided and non-zero-aligned grids', () => {
    const oneSidedScale = createTwoBandScale({
      gridMin: 1,
      gridMax: 5,
      gridStep: 1,
      priorMean: 3,
      cut: 3,
    })
    const oneSidedPointMass = pointMassPosterior(oneSidedScale, 5)
    const oneSided = combineWeightedPosteriors({
      entries: [
        { key: 'root-a', posterior: oneSidedPointMass, weight: 1 },
        { key: 'root-b', posterior: oneSidedPointMass, weight: 1 },
      ],
      scale: oneSidedScale,
      credibleMass: 0.9,
    })
    expect(oneSided.mean).toBe(5)
    expect(oneSided.variance).toBe(0)

    const offsetScale = createTwoBandScale({
      gridMin: -0.95,
      gridMax: 1.05,
      gridStep: 0.1,
      priorMean: 0.05,
      cut: 0.05,
    })
    const offsetPointMass = pointMassPosterior(offsetScale, 0.05)
    const offset = combineWeightedPosteriors({
      entries: [
        { key: 'root-a', posterior: offsetPointMass, weight: 1 },
        { key: 'root-b', posterior: offsetPointMass, weight: 1 },
      ],
      scale: offsetScale,
      credibleMass: 0.9,
    })
    const varianceBound = (2 * offsetScale.gridStep ** 2) / 4 + 1e-12
    expect(offset.mean).toBeCloseTo(0.05, 12)
    expect(offset.variance).toBeLessThanOrEqual(varianceBound)
  })

  it.each([
    { name: 'empty', entries: [] },
    { name: 'all-zero weights', entries: [entry('a', 0)] },
    { name: 'negative weight', entries: [entry('a', -1)] },
    { name: 'non-finite weight', entries: [entry('a', Number.NaN)] },
    {
      name: 'duplicate key',
      entries: [entry('a', 1), entry('a', 2)],
    },
  ])('rejects invalid entry sets: $name', ({ entries }) => {
    expect(() =>
      combineWeightedPosteriors({ entries, scale, credibleMass: 0.9 })
    ).toThrowError(TypeError)
  })

  it('rejects malformed posterior grids and probabilities', () => {
    const wrongGrid = normalPosterior(0, 1)
    wrongGrid.points[0] = -5.9
    expect(() =>
      combineWeightedPosteriors({
        entries: [{ key: 'root', posterior: wrongGrid, weight: 1 }],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('Every posterior must use the canonical scale grid.')

    const negative = normalPosterior(0, 1)
    negative.probabilities[0] = -0.1
    expect(() =>
      combineWeightedPosteriors({
        entries: [{ key: 'root', posterior: negative, weight: 1 }],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('Posterior probabilities must be finite and non-negative.')

    const mismatched = normalPosterior(0, 1)
    mismatched.probabilities.pop()
    expect(() =>
      combineWeightedPosteriors({
        entries: [{ key: 'root', posterior: mismatched, weight: 1 }],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('Every posterior must use the canonical scale grid.')

    const zeroMass = normalPosterior(0, 1)
    zeroMass.probabilities.fill(0)
    expect(() =>
      combineWeightedPosteriors({
        entries: [{ key: 'root', posterior: zeroMass, weight: 1 }],
        scale,
        credibleMass: 0.9,
      })
    ).toThrowError('Posterior probability mass must be positive and finite.')
  })
})

function normalPosterior(mean: number, standardDeviation: number) {
  const points = buildAdaptivePosteriorGrid(scale)
  return summarizeAdaptivePosterior({
    points,
    probabilities: points.map((point) =>
      Math.exp(-0.5 * ((point - mean) / standardDeviation) ** 2)
    ),
    scale,
    credibleMass: 0.9,
  })
}

function pointMassPosterior(
  targetScale: AdaptiveScaleDefinition,
  point: number
) {
  const points = buildAdaptivePosteriorGrid(targetScale)
  return summarizeAdaptivePosterior({
    points,
    probabilities: points.map((candidate) =>
      Math.abs(candidate - point) < 1e-12 ? 1 : 0
    ),
    scale: targetScale,
    credibleMass: 0.9,
  })
}

function entry(key: string, weight: number) {
  return { key, posterior: normalPosterior(0, 1), weight }
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0)
}

function permutations<T>(values: T[]): T[][] {
  if (values.length <= 1) return [values]
  return values.flatMap((value, index) =>
    permutations(values.filter((_, candidate) => candidate !== index)).map(
      (rest) => [value, ...rest]
    )
  )
}

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

function createTwoBandScale({
  priorMean,
  gridMin,
  gridMax,
  gridStep,
  cut,
}: {
  priorMean: number
  gridMin: number
  gridMax: number
  gridStep: number
  cut: number
}): AdaptiveScaleDefinition {
  return {
    priorMean,
    priorStandardDeviation: 1,
    gridMin,
    gridMax,
    gridStep,
    classificationPolicyVersion: 1,
    levels: [
      {
        id: 1,
        label: 'Lower',
        order: 0,
        lowerBound: Number.NEGATIVE_INFINITY,
        upperBound: cut,
        itemDifficultyPrior: (gridMin + cut) / 2,
      },
      {
        id: 2,
        label: 'Upper',
        order: 1,
        lowerBound: cut,
        upperBound: Number.POSITIVE_INFINITY,
        itemDifficultyPrior: (cut + gridMax) / 2,
      },
    ],
  }
}

import {
  type AdaptivePosterior,
  buildAdaptivePosteriorGrid,
  summarizeAdaptivePosterior,
} from './posterior.js'
import type { AdaptiveScaleDefinition } from './scale.js'

const GRID_TOLERANCE_MULTIPLIER = 32

export function combineWeightedPosteriors({
  entries,
  scale,
  credibleMass,
}: {
  entries: Array<{
    key: string
    posterior: AdaptivePosterior
    weight: number
  }>
  scale: AdaptiveScaleDefinition
  credibleMass: number
}): AdaptivePosterior {
  if (entries.length === 0) {
    throw new TypeError('At least one posterior entry is required.')
  }

  const grid = buildAdaptivePosteriorGrid(scale)
  const seenKeys = new Set<string>()
  for (const entry of entries) {
    if (entry.key.trim().length === 0 || seenKeys.has(entry.key)) {
      throw new TypeError('Posterior entry keys must be non-empty and unique.')
    }
    seenKeys.add(entry.key)
    if (!Number.isFinite(entry.weight) || entry.weight < 0) {
      throw new TypeError('Posterior weights must be finite and non-negative.')
    }
    assertPosteriorOnGrid(entry.posterior, grid)
  }

  const positiveEntries = entries
    .filter((entry) => entry.weight > 0)
    .sort((left, right) =>
      left.key < right.key ? -1 : left.key > right.key ? 1 : 0
    )
  if (positiveEntries.length === 0) {
    throw new TypeError('At least one posterior weight must be positive.')
  }

  const maximumWeight = Math.max(...positiveEntries.map(({ weight }) => weight))
  const scaledTotal = positiveEntries.reduce(
    (sum, entry) => sum + entry.weight / maximumWeight,
    0
  )
  const normalizedEntries = positiveEntries.map((entry) => ({
    ...entry,
    normalizedWeight: entry.weight / maximumWeight / scaledTotal,
  }))

  let combined = normalizeDistribution(
    normalizedEntries[0]!.posterior.probabilities
  )
  let combinedWeight = normalizedEntries[0]!.normalizedWeight
  for (const entry of normalizedEntries.slice(1)) {
    const nextWeight = combinedWeight + entry.normalizedWeight
    combined = normalizeDistribution(
      convolveWeightedAverages(
        combined,
        entry.posterior.probabilities,
        combinedWeight / nextWeight,
        entry.normalizedWeight / nextWeight,
        grid
      )
    )
    combinedWeight = nextWeight
  }

  return summarizeAdaptivePosterior({
    points: grid,
    probabilities: combined,
    scale,
    credibleMass,
  })
}

function normalizeDistribution(probabilities: readonly number[]) {
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= 0) {
    throw new TypeError(
      'Composite probability mass must be positive and finite.'
    )
  }
  return probabilities.map((value) => value / total)
}

function assertPosteriorOnGrid(
  posterior: AdaptivePosterior,
  grid: readonly number[]
) {
  if (
    posterior.points.length !== grid.length ||
    posterior.probabilities.length !== grid.length
  ) {
    throw new TypeError('Every posterior must use the canonical scale grid.')
  }
  let total = 0
  for (let index = 0; index < grid.length; index++) {
    if (!approximatelyEqual(posterior.points[index]!, grid[index]!)) {
      throw new TypeError('Every posterior must use the canonical scale grid.')
    }
    const probability = posterior.probabilities[index]!
    if (!Number.isFinite(probability) || probability < 0) {
      throw new TypeError(
        'Posterior probabilities must be finite and non-negative.'
      )
    }
    total += probability
  }
  if (!Number.isFinite(total) || total <= 0) {
    throw new TypeError(
      'Posterior probability mass must be positive and finite.'
    )
  }
}

function convolveWeightedAverages(
  left: readonly number[],
  right: readonly number[],
  leftWeight: number,
  rightWeight: number,
  grid: readonly number[]
) {
  const result = Array<number>(grid.length).fill(0)
  const normalizedRight = normalizeDistribution(right)
  for (let leftIndex = 0; leftIndex < grid.length; leftIndex++) {
    if (left[leftIndex] === 0) continue
    for (let rightIndex = 0; rightIndex < grid.length; rightIndex++) {
      if (normalizedRight[rightIndex] === 0) continue
      depositMass(
        result,
        grid,
        leftWeight * grid[leftIndex]! + rightWeight * grid[rightIndex]!,
        left[leftIndex]! * normalizedRight[rightIndex]!
      )
    }
  }
  return result
}

function depositMass(
  target: number[],
  grid: readonly number[],
  value: number,
  mass: number
) {
  if (value <= grid[0]!) {
    target[0] = target[0]! + mass
    return
  }
  const lastIndex = grid.length - 1
  if (value >= grid[lastIndex]!) {
    target[lastIndex] = target[lastIndex]! + mass
    return
  }

  let lowerIndex = 0
  let upperIndex = lastIndex
  while (upperIndex - lowerIndex > 1) {
    const midpoint = Math.floor((lowerIndex + upperIndex) / 2)
    if (grid[midpoint]! <= value) lowerIndex = midpoint
    else upperIndex = midpoint
  }

  const lower = grid[lowerIndex]!
  const upper = grid[upperIndex]!
  if (approximatelyEqual(value, lower)) {
    target[lowerIndex] = target[lowerIndex]! + mass
    return
  }
  if (approximatelyEqual(value, upper)) {
    target[upperIndex] = target[upperIndex]! + mass
    return
  }
  const upperShare = (value - lower) / (upper - lower)
  target[lowerIndex] = target[lowerIndex]! + mass * (1 - upperShare)
  target[upperIndex] = target[upperIndex]! + mass * upperShare
}

function approximatelyEqual(left: number, right: number) {
  return (
    Math.abs(left - right) <=
    Number.EPSILON *
      Math.max(1, Math.abs(left), Math.abs(right)) *
      GRID_TOLERANCE_MULTIPLIER
  )
}

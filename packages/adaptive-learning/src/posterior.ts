import type { AdaptiveItemModel } from './calibration.js'
import {
  MAX_ABSOLUTE_THETA,
  MAX_DISCRIMINATION,
  SUPPORTED_ADAPTIVE_ITEM_TYPES,
  deriveGuessingParameter,
  type AdaptiveItemType,
} from './core.js'
import {
  levelForTheta,
  validateAdaptiveScale,
  type AdaptiveScaleDefinition,
} from './scale.js'

const NUMERIC_TOLERANCE = 1e-12

export type AdaptivePosterior = {
  points: number[]
  probabilities: number[]
  mean: number
  variance: number
  standardDeviation: number
  credibleLower: number
  credibleUpper: number
  bandProbabilities: Array<{
    levelId: number
    probability: number
  }>
}

export type AdaptiveScoredItem = {
  id: number | string
  itemType: AdaptiveItemType
  choiceCount: number | null
  model: AdaptiveItemModel
  calibrationId: string
  discrimination: number
  difficulty: number
  guessing: number
}

export type AdaptiveScoredResponse = {
  item: AdaptiveScoredItem
  correct: boolean
}

export function estimateEapPosterior({
  responses,
  scale,
  credibleMass,
}: {
  responses: AdaptiveScoredResponse[]
  scale: AdaptiveScaleDefinition
  credibleMass: number
}): AdaptivePosterior {
  assertScale(scale)
  assertProbability(credibleMass, 'Credible mass')
  assertUniqueScoredResponses(responses)

  const points = buildAdaptivePosteriorGrid(scale)
  const logMasses = points.map((theta) => {
    const standardized =
      (theta - scale.priorMean) / scale.priorStandardDeviation
    const logPrior = -0.5 * standardized * standardized
    const logLikelihood = responses.reduce(
      (sum, response) => sum + bernoulliLogLikelihood(theta, response),
      0
    )
    return logPrior + logLikelihood
  })
  const maximumLogMass = Math.max(...logMasses)
  if (!Number.isFinite(maximumLogMass)) {
    throw new TypeError('The posterior has no finite probability mass.')
  }
  const unnormalized = logMasses.map((value) =>
    Math.exp(value - maximumLogMass)
  )

  return summarizeAdaptivePosterior({
    points,
    probabilities: unnormalized,
    scale,
    credibleMass,
  })
}

export function buildAdaptivePosteriorGrid(
  scale: AdaptiveScaleDefinition
): number[] {
  assertScale(scale)
  const intervalCount = Math.round(
    (scale.gridMax - scale.gridMin) / scale.gridStep
  )

  return Array.from({ length: intervalCount + 1 }, (_, index) =>
    index === intervalCount
      ? scale.gridMax
      : scale.gridMin + index * scale.gridStep
  )
}

export function summarizeAdaptivePosterior({
  points,
  probabilities,
  scale,
  credibleMass,
}: {
  points: readonly number[]
  probabilities: readonly number[]
  scale: AdaptiveScaleDefinition
  credibleMass: number
}): AdaptivePosterior {
  assertScale(scale)
  assertProbability(credibleMass, 'Credible mass')
  assertDistribution(points, probabilities)

  const total = probabilities.reduce((sum, value) => sum + value, 0)
  const normalized = probabilities.map((value) => value / total)
  const mean = points.reduce(
    (sum, point, index) => sum + point * normalized[index]!,
    0
  )
  const variance = Math.max(
    0,
    points.reduce((sum, point, index) => {
      const difference = point - mean
      return sum + difference * difference * normalized[index]!
    }, 0)
  )
  const tailMass = (1 - credibleMass) / 2

  return {
    points: [...points],
    probabilities: normalized,
    mean,
    variance,
    standardDeviation: Math.sqrt(variance),
    credibleLower: discreteQuantile(points, normalized, tailMass),
    credibleUpper: discreteQuantile(points, normalized, 1 - tailMass),
    bandProbabilities: computeBandProbabilities(points, normalized, scale),
  }
}

export function stableBernoulliLogLikelihood(
  theta: number,
  response: AdaptiveScoredResponse
): number {
  if (!Number.isFinite(theta)) {
    throw new TypeError('Theta must be finite.')
  }
  assertScoredResponse(response)

  return bernoulliLogLikelihood(theta, response)
}

function bernoulliLogLikelihood(
  theta: number,
  response: AdaptiveScoredResponse
) {
  const { discrimination, difficulty, guessing } = response.item
  const linearPredictor = discrimination * (theta - difficulty)
  const logisticLogProbability = logSigmoid(linearPredictor)

  if (response.correct) {
    if (guessing === 0) return logisticLogProbability
    return logAddExp(
      Math.log(guessing),
      Math.log1p(-guessing) + logisticLogProbability
    )
  }

  return Math.log1p(-guessing) + logSigmoid(-linearPredictor)
}

function assertScale(scale: AdaptiveScaleDefinition) {
  const errors = validateAdaptiveScale(scale)
  if (errors.length > 0) {
    throw new TypeError(`Invalid adaptive scale: ${errors.join(' ')}`)
  }
}

function assertScoredResponse(response: AdaptiveScoredResponse) {
  if (typeof response.correct !== 'boolean') {
    throw new TypeError('Scored response correctness must be boolean.')
  }
  assertScoredItem(response.item)
}

function assertUniqueScoredResponses(responses: AdaptiveScoredResponse[]) {
  const itemIds = new Set<string>()
  const calibrationIds = new Set<string>()

  for (const response of responses) {
    assertScoredResponse(response)
    const itemId = `${typeof response.item.id}:${response.item.id}`
    if (itemIds.has(itemId)) {
      throw new TypeError('A scored item response must not be counted twice.')
    }
    if (calibrationIds.has(response.item.calibrationId)) {
      throw new TypeError(
        'A scored calibration response must not be counted twice.'
      )
    }
    itemIds.add(itemId)
    calibrationIds.add(response.item.calibrationId)
  }
}

function assertScoredItem(item: AdaptiveScoredItem) {
  if (
    (typeof item.id !== 'string' && typeof item.id !== 'number') ||
    (typeof item.id === 'string' && item.id.trim().length === 0) ||
    (typeof item.id === 'number' && !Number.isFinite(item.id))
  ) {
    throw new TypeError(
      'Scored item ID must be a finite number or non-empty string.'
    )
  }
  if (item.calibrationId.trim().length === 0) {
    throw new TypeError('Scored items require a calibration ID.')
  }
  if (!SUPPORTED_ADAPTIVE_ITEM_TYPES.includes(item.itemType)) {
    throw new TypeError('Scored item type is not supported.')
  }
  if (
    !Number.isFinite(item.discrimination) ||
    item.discrimination <= 0 ||
    item.discrimination > MAX_DISCRIMINATION
  ) {
    throw new TypeError(
      'Scored item discrimination is outside supported bounds.'
    )
  }
  if (
    !Number.isFinite(item.difficulty) ||
    Math.abs(item.difficulty) > MAX_ABSOLUTE_THETA
  ) {
    throw new TypeError('Scored item difficulty is outside supported bounds.')
  }
  if (
    !Number.isFinite(item.guessing) ||
    item.guessing < 0 ||
    item.guessing >= 1
  ) {
    throw new TypeError('Scored item guessing is outside supported bounds.')
  }

  const choiceItem =
    item.itemType === 'SC' ||
    item.itemType === 'MC' ||
    item.itemType === 'KPRIM'
  if (choiceItem) {
    if (!Number.isInteger(item.choiceCount) || (item.choiceCount ?? 0) < 2) {
      throw new TypeError('Scored choice items require an exact choice count.')
    }
    if (item.itemType === 'KPRIM' && item.choiceCount !== 4) {
      throw new TypeError(
        'Scored KPRIM items must contain exactly 4 statements.'
      )
    }
  } else if (item.choiceCount !== null) {
    throw new TypeError(
      'Non-choice scored items must not define a choice count.'
    )
  }

  const expectedModel: AdaptiveItemModel = choiceItem
    ? 'THREE_PL_FIXED_C'
    : 'TWO_PL'
  if (item.model !== expectedModel) {
    throw new TypeError('Scored item model is incompatible with its item type.')
  }
  const expectedGuessing = deriveGuessingParameter({
    type: item.itemType,
    choiceCount: item.choiceCount,
  })
  if (item.guessing !== expectedGuessing) {
    throw new TypeError(
      'Scored item guessing must match its item-type guessing parameter.'
    )
  }
}

function assertDistribution(
  points: readonly number[],
  probabilities: readonly number[]
) {
  if (points.length === 0 || points.length !== probabilities.length) {
    throw new TypeError(
      'Posterior points and probabilities must have the same non-zero length.'
    )
  }
  let previous = Number.NEGATIVE_INFINITY
  for (let index = 0; index < points.length; index++) {
    const point = points[index]!
    const probability = probabilities[index]!
    if (!Number.isFinite(point) || point <= previous) {
      throw new TypeError(
        'Posterior points must be finite and strictly increasing.'
      )
    }
    if (!Number.isFinite(probability) || probability < 0) {
      throw new TypeError(
        'Posterior probabilities must be finite and non-negative.'
      )
    }
    previous = point
  }
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total <= 0) {
    throw new TypeError(
      'Posterior probability mass must be positive and finite.'
    )
  }
}

function computeBandProbabilities(
  points: readonly number[],
  probabilities: readonly number[],
  scale: AdaptiveScaleDefinition
) {
  const levels = scale.levels
    .slice()
    .sort((left, right) => left.order - right.order)
  const massByLevel = new Map(levels.map((level) => [level.id, 0]))

  for (let index = 0; index < points.length; index++) {
    const point = points[index]!
    const probability = probabilities[index]!
    const higherIndex = levels.findIndex(
      (level, levelIndex) =>
        levelIndex > 0 && approximatelyEqual(point, level.lowerBound)
    )

    if (higherIndex > 0) {
      const lower = levels[higherIndex - 1]!
      const higher = levels[higherIndex]!
      massByLevel.set(lower.id, massByLevel.get(lower.id)! + probability / 2)
      massByLevel.set(higher.id, massByLevel.get(higher.id)! + probability / 2)
      continue
    }

    const level = levelForTheta(point, levels)
    if (level === null) {
      throw new TypeError('A posterior grid point is outside the scale bands.')
    }
    massByLevel.set(level.id, massByLevel.get(level.id)! + probability)
  }

  return levels.map((level) => ({
    levelId: level.id,
    probability: massByLevel.get(level.id)!,
  }))
}

function discreteQuantile(
  points: readonly number[],
  probabilities: readonly number[],
  target: number
) {
  let cumulative = 0
  for (let index = 0; index < points.length; index++) {
    cumulative += probabilities[index]!
    if (cumulative + NUMERIC_TOLERANCE >= target) return points[index]!
  }
  return points.at(-1)!
}

function logSigmoid(value: number) {
  return value >= 0
    ? -Math.log1p(Math.exp(-value))
    : value - Math.log1p(Math.exp(value))
}

function logAddExp(left: number, right: number) {
  const maximum = Math.max(left, right)
  if (maximum === Number.NEGATIVE_INFINITY) return maximum
  return (
    maximum + Math.log(Math.exp(left - maximum) + Math.exp(right - maximum))
  )
}

function assertProbability(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0 || value >= 1) {
    throw new TypeError(`${label} must be finite and strictly between 0 and 1.`)
  }
}

function approximatelyEqual(left: number, right: number) {
  return (
    Math.abs(left - right) <=
    Number.EPSILON * Math.max(1, Math.abs(left), Math.abs(right)) * 16
  )
}

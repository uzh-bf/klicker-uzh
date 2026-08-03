import { MAX_ABSOLUTE_THETA } from './core.js'

export const MAX_ADAPTIVE_POSTERIOR_GRID_POINTS = 2_001

export type ExplicitAdaptiveLevel = {
  id: number
  label: string
  order: number
  lowerBound: number
  upperBound: number
  itemDifficultyPrior: number
}

export type AdaptiveScaleDefinition = {
  priorMean: number
  priorStandardDeviation: number
  gridMin: number
  gridMax: number
  gridStep: number
  classificationPolicyVersion: number
  levels: ExplicitAdaptiveLevel[]
}

export function validateAdaptiveScale(
  scale: AdaptiveScaleDefinition
): string[] {
  const errors: string[] = []
  const addError = (message: string) => {
    if (!errors.includes(message)) errors.push(message)
  }
  const ordered = scale.levels.slice().sort((a, b) => a.order - b.order)

  if (ordered.length < 2) {
    addError('At least two levels are required.')
  }
  if (!Number.isFinite(scale.priorMean)) {
    addError('Prior mean must be finite.')
  } else if (Math.abs(scale.priorMean) > MAX_ABSOLUTE_THETA) {
    addError('Prior mean must be within supported theta bounds.')
  }
  if (
    !Number.isFinite(scale.priorStandardDeviation) ||
    !(scale.priorStandardDeviation > 0)
  ) {
    addError('Prior standard deviation must be positive.')
  }
  if (
    Number.isFinite(scale.priorStandardDeviation) &&
    Number.isFinite(scale.gridStep) &&
    scale.priorStandardDeviation > 0 &&
    scale.gridStep > 0 &&
    scale.priorStandardDeviation < scale.gridStep
  ) {
    addError(
      'Prior standard deviation must be at least the posterior grid step.'
    )
  }
  if (
    !Number.isFinite(scale.gridMin) ||
    !Number.isFinite(scale.gridMax) ||
    !Number.isFinite(scale.gridStep)
  ) {
    addError('Posterior grid values must be finite.')
  }
  if (!(scale.gridMin < scale.gridMax) || !(scale.gridStep > 0)) {
    addError('The posterior grid must be increasing.')
  }
  if (
    Number.isFinite(scale.gridMin) &&
    Number.isFinite(scale.gridMax) &&
    Number.isFinite(scale.gridStep) &&
    scale.gridMin < scale.gridMax &&
    scale.gridStep > 0
  ) {
    const intervalCount = (scale.gridMax - scale.gridMin) / scale.gridStep
    const roundedIntervalCount = Math.round(intervalCount)
    const tolerance = Number.EPSILON * Math.max(1, Math.abs(intervalCount)) * 16

    if (Math.abs(intervalCount - roundedIntervalCount) > tolerance) {
      addError('The posterior grid span must be divisible by its step.')
    }
    if (roundedIntervalCount + 1 > MAX_ADAPTIVE_POSTERIOR_GRID_POINTS) {
      addError(
        `The posterior grid must contain at most ${MAX_ADAPTIVE_POSTERIOR_GRID_POINTS} points.`
      )
    }
    if (
      Number.isFinite(scale.priorMean) &&
      (scale.priorMean < scale.gridMin || scale.priorMean > scale.gridMax)
    ) {
      addError('Prior mean must lie within the posterior grid.')
    }
  }
  if (
    Number.isFinite(scale.gridMin) &&
    Number.isFinite(scale.gridMax) &&
    (Math.abs(scale.gridMin) > MAX_ABSOLUTE_THETA ||
      Math.abs(scale.gridMax) > MAX_ABSOLUTE_THETA)
  ) {
    addError('The posterior grid must stay within supported theta bounds.')
  }
  if (
    !Number.isInteger(scale.classificationPolicyVersion) ||
    scale.classificationPolicyVersion < 1
  ) {
    addError('A supported classification policy version is required.')
  }

  const levelIds = new Set<number>()
  for (let index = 0; index < ordered.length; index++) {
    const level = ordered[index]!

    if (!Number.isInteger(level.id) || level.id < 1) {
      addError('Level IDs must be positive integers.')
    } else if (levelIds.has(level.id)) {
      addError('Level IDs must be unique.')
    }
    levelIds.add(level.id)
    if (level.label.trim().length === 0) {
      addError('Level labels must not be empty.')
    }
    if (level.order !== index) {
      addError('Level order must be contiguous.')
    }
    if (index > 0 && level.lowerBound !== ordered[index - 1]!.upperBound) {
      addError('Level bands must be contiguous.')
    }
    if (index === 0 && level.lowerBound !== Number.NEGATIVE_INFINITY) {
      addError('The first level must start at negative infinity.')
    }
    if (
      index === ordered.length - 1 &&
      level.upperBound !== Number.POSITIVE_INFINITY
    ) {
      addError('The last level must end at positive infinity.')
    }
    if (!(level.lowerBound < level.upperBound)) {
      addError('Level bounds must define increasing intervals.')
    }
    if (
      (index > 0 && !Number.isFinite(level.lowerBound)) ||
      (index < ordered.length - 1 && !Number.isFinite(level.upperBound))
    ) {
      addError('Internal level bounds must be finite.')
    }
    if (
      (Number.isFinite(level.lowerBound) &&
        Math.abs(level.lowerBound) > MAX_ABSOLUTE_THETA) ||
      (Number.isFinite(level.upperBound) &&
        Math.abs(level.upperBound) > MAX_ABSOLUTE_THETA)
    ) {
      addError('Level bounds must stay within supported theta bounds.')
    }
    if (
      index > 0 &&
      Number.isFinite(level.lowerBound) &&
      Number.isFinite(scale.gridMin) &&
      Number.isFinite(scale.gridMax) &&
      (level.lowerBound <= scale.gridMin || level.lowerBound >= scale.gridMax)
    ) {
      addError('Internal level bounds must lie inside the posterior grid.')
    }
    if (
      !Number.isFinite(level.itemDifficultyPrior) ||
      Math.abs(level.itemDifficultyPrior) > MAX_ABSOLUTE_THETA
    ) {
      addError(
        'Item difficulty priors must be finite and within supported theta bounds.'
      )
    } else if (
      Number.isFinite(scale.gridMin) &&
      Number.isFinite(scale.gridMax) &&
      (level.itemDifficultyPrior < scale.gridMin ||
        level.itemDifficultyPrior > scale.gridMax)
    ) {
      addError('Item difficulty priors must lie within the posterior grid.')
    }
  }

  return errors
}

export function levelForTheta(
  theta: number,
  levels: ExplicitAdaptiveLevel[]
): ExplicitAdaptiveLevel | null {
  if (!Number.isFinite(theta)) return null

  const ordered = levels.slice().sort((a, b) => a.order - b.order)
  return (
    ordered.find(
      (level) => theta >= level.lowerBound && theta < level.upperBound
    ) ?? null
  )
}

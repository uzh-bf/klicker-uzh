import {
  buildAdaptivePosteriorGrid,
  summarizeAdaptivePosterior,
  type AdaptivePosterior,
} from './posterior.js'
import type { AdaptiveRuntimeStopReason } from './runtime.js'
import { validateAdaptiveScale, type AdaptiveScaleDefinition } from './scale.js'

const PROBABILITY_TOLERANCE = 1e-12
const SUMMARY_TOLERANCE = 1e-10

export type AdaptivePosteriorClassification = {
  status:
    | 'CLASSIFIED'
    | 'BETWEEN_LEVELS'
    | 'INSUFFICIENT_EVIDENCE'
    | 'POOL_LIMITED'
  levelId: number | null
  probability: number
  leadingLevelIds: number[]
}

export class AdaptiveClassificationIntegrityError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AdaptiveClassificationIntegrityError'
  }
}

export function classifyPosterior({
  posterior,
  scale,
  credibleMass,
  probabilityThreshold,
  evidenceSatisfied,
  evidenceReachable,
  calibratedCoverageSatisfied,
  integritySatisfied,
  terminalReason,
}: {
  posterior: AdaptivePosterior
  scale: AdaptiveScaleDefinition
  credibleMass: number
  probabilityThreshold: number
  evidenceSatisfied: boolean
  evidenceReachable: boolean
  calibratedCoverageSatisfied: boolean
  integritySatisfied: boolean
  terminalReason: AdaptiveRuntimeStopReason | null
}): AdaptivePosteriorClassification {
  assertBoolean(integritySatisfied, 'Integrity satisfied')
  assertBoolean(evidenceSatisfied, 'Evidence satisfied')
  assertBoolean(evidenceReachable, 'Evidence reachable')
  assertBoolean(calibratedCoverageSatisfied, 'Calibrated coverage satisfied')
  if (!integritySatisfied) {
    throw new AdaptiveClassificationIntegrityError(
      'Adaptive result integrity checks did not pass.'
    )
  }
  const scaleErrors = validateAdaptiveScale(scale)
  if (scaleErrors.length > 0) {
    throw new TypeError(`Invalid adaptive scale: ${scaleErrors.join(' ')}`)
  }
  assertTerminalReason(terminalReason)
  if (
    !Number.isFinite(probabilityThreshold) ||
    probabilityThreshold <= 0 ||
    probabilityThreshold >= 1
  ) {
    throw new TypeError(
      'Classification probability threshold must be strictly between 0 and 1.'
    )
  }

  const orderedLevels = scale.levels
    .slice()
    .sort((left, right) => left.order - right.order)
  const trustedPosterior = validatePosteriorConsistency(
    posterior,
    scale,
    credibleMass
  )
  const probabilityByLevel = new Map(
    trustedPosterior.bandProbabilities.map((band) => [
      band.levelId,
      band.probability,
    ])
  )

  if (terminalReason === 'ABANDONED') {
    return unclassified('INSUFFICIENT_EVIDENCE')
  }
  if (!calibratedCoverageSatisfied) {
    assertNotClassifiedStop(terminalReason)
    return unclassified('POOL_LIMITED')
  }
  if (!evidenceSatisfied) {
    assertNotClassifiedStop(terminalReason)
    return unclassified(
      evidenceReachable ? 'INSUFFICIENT_EVIDENCE' : 'POOL_LIMITED'
    )
  }

  const ranked = orderedLevels
    .map((level) => ({
      id: level.id,
      order: level.order,
      probability: probabilityByLevel.get(level.id)!,
    }))
    .sort(
      (left, right) =>
        right.probability - left.probability || left.order - right.order
    )
  const first = ranked[0]!
  if (first.probability + PROBABILITY_TOLERANCE >= probabilityThreshold) {
    return {
      status: 'CLASSIFIED',
      levelId: first.id,
      probability: first.probability,
      leadingLevelIds: [first.id],
    }
  }

  if (terminalReason === 'CLASSIFIED') {
    throw new AdaptiveClassificationIntegrityError(
      'A classified stop reason requires a qualifying posterior band.'
    )
  }

  const second = ranked[1]
  const third = ranked[2]
  const secondIsUnambiguous =
    second !== undefined &&
    (third === undefined ||
      second.probability - third.probability > PROBABILITY_TOLERANCE)
  if (
    second !== undefined &&
    secondIsUnambiguous &&
    Math.abs(first.order - second.order) === 1 &&
    first.probability + second.probability + PROBABILITY_TOLERANCE >=
      probabilityThreshold
  ) {
    return {
      status: 'BETWEEN_LEVELS',
      levelId: null,
      probability: first.probability + second.probability,
      leadingLevelIds: [first, second]
        .sort((left, right) => left.order - right.order)
        .map(({ id }) => id),
    }
  }

  return unclassified(
    evidenceReachable ? 'INSUFFICIENT_EVIDENCE' : 'POOL_LIMITED'
  )
}

function unclassified(
  status: 'INSUFFICIENT_EVIDENCE' | 'POOL_LIMITED'
): AdaptivePosteriorClassification {
  return {
    status,
    levelId: null,
    probability: 0,
    leadingLevelIds: [],
  }
}

function assertTerminalReason(
  reason: AdaptiveRuntimeStopReason | null
): asserts reason is AdaptiveRuntimeStopReason | null {
  switch (reason) {
    case null:
    case 'CLASSIFIED':
    case 'ALL_ROOTS_CLASSIFIED':
    case 'TOTAL_QUESTION_CAP':
    case 'NODE_QUESTION_CAP':
    case 'POOL_EXHAUSTED':
    case 'INSUFFICIENT_DATA':
    case 'ABANDONED':
      return
    default: {
      const exhaustive: never = reason
      throw new TypeError(`Unsupported adaptive terminal reason: ${exhaustive}`)
    }
  }
}

function assertNotClassifiedStop(reason: AdaptiveRuntimeStopReason | null) {
  if (reason === 'CLASSIFIED') {
    throw new AdaptiveClassificationIntegrityError(
      'A classified stop reason requires satisfied evidence and calibrated coverage.'
    )
  }
}

function validatePosteriorConsistency(
  posterior: AdaptivePosterior,
  scale: AdaptiveScaleDefinition,
  credibleMass: number
) {
  assertPosteriorShape(posterior)
  const canonicalPoints = buildAdaptivePosteriorGrid(scale)
  if (
    posterior.points.length !== canonicalPoints.length ||
    posterior.points.some(
      (point, index) => !approximatelyEqual(point, canonicalPoints[index]!)
    )
  ) {
    throw new TypeError('Posterior points must use the canonical scale grid.')
  }

  const trusted = summarizeAdaptivePosterior({
    points: posterior.points,
    probabilities: posterior.probabilities,
    scale,
    credibleMass,
  })
  const summariesMatch =
    approximatelyEqual(posterior.mean, trusted.mean) &&
    approximatelyEqual(posterior.variance, trusted.variance) &&
    approximatelyEqual(
      posterior.standardDeviation,
      trusted.standardDeviation
    ) &&
    approximatelyEqual(posterior.credibleLower, trusted.credibleLower) &&
    approximatelyEqual(posterior.credibleUpper, trusted.credibleUpper)
  if (!summariesMatch) {
    throw new TypeError(
      'Posterior summary does not match its point probabilities.'
    )
  }

  const suppliedByLevel = new Map<number, number>()
  for (const band of posterior.bandProbabilities) {
    if (
      suppliedByLevel.has(band.levelId) ||
      !Number.isFinite(band.probability) ||
      band.probability < 0
    ) {
      throw new TypeError('Posterior band probabilities are malformed.')
    }
    suppliedByLevel.set(band.levelId, band.probability)
  }
  if (
    suppliedByLevel.size !== trusted.bandProbabilities.length ||
    trusted.bandProbabilities.some(
      (band) =>
        !suppliedByLevel.has(band.levelId) ||
        !approximatelyEqual(
          suppliedByLevel.get(band.levelId)!,
          band.probability
        )
    )
  ) {
    throw new TypeError(
      'Posterior band probabilities do not match its point probabilities.'
    )
  }

  return trusted
}

function assertPosteriorShape(posterior: AdaptivePosterior) {
  if (
    posterior.points.length === 0 ||
    posterior.points.length !== posterior.probabilities.length ||
    !Number.isFinite(posterior.mean) ||
    !Number.isFinite(posterior.variance) ||
    posterior.variance < 0 ||
    !Number.isFinite(posterior.standardDeviation) ||
    posterior.standardDeviation < 0 ||
    !Number.isFinite(posterior.credibleLower) ||
    !Number.isFinite(posterior.credibleUpper) ||
    posterior.credibleLower > posterior.credibleUpper
  ) {
    throw new TypeError('Posterior summary is malformed.')
  }

  let previous = Number.NEGATIVE_INFINITY
  let total = 0
  for (let index = 0; index < posterior.points.length; index++) {
    const point = posterior.points[index]!
    const probability = posterior.probabilities[index]!
    if (!Number.isFinite(point) || point <= previous) {
      throw new TypeError('Posterior points are malformed.')
    }
    if (!Number.isFinite(probability) || probability < 0) {
      throw new TypeError('Posterior probabilities are malformed.')
    }
    previous = point
    total += probability
  }
  if (!Number.isFinite(total) || Math.abs(total - 1) > PROBABILITY_TOLERANCE) {
    throw new TypeError('Posterior probabilities must sum to one.')
  }
}

function assertBoolean(value: boolean, label: string) {
  if (typeof value !== 'boolean') {
    throw new TypeError(`${label} must be boolean.`)
  }
}

function approximatelyEqual(left: number, right: number) {
  return (
    Math.abs(left - right) <=
    SUMMARY_TOLERANCE * Math.max(1, Math.abs(left), Math.abs(right))
  )
}

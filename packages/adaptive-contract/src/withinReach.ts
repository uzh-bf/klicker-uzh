import {
  DEFAULT_THETA_RANGE,
  type LevelDefinition,
  type LevelMappingRule,
  mapLevelsToTheta,
  type ThetaRange,
} from './core.js'

/** Where "mastered" begins inside a level band (client definition: 70%). */
export const DEFAULT_MASTERY_POINT = 0.7
/** Probability needed before a level is shown as mastered. */
export const DEFAULT_MASTERY_PROBABILITY = 0.7

export type LevelPosition = {
  /** Order of the level whose band contains theta. */
  levelOrder: number
  /**
   * Where theta lies in that band: 0 at the lower edge, 1 at the boundary
   * to the next level. Open edge bands use the width of a regular band.
   */
  position: number
  /** The band in theta units (edge bands closed with a regular width). */
  lower: number
  upper: number
}

/**
 * Position of an estimate inside its level band. Presentation only: it does
 * not change the reported level.
 */
export function levelPositionOfTheta(
  theta: number,
  levels: LevelDefinition[],
  range: ThetaRange = DEFAULT_THETA_RANGE,
  mappingRule: LevelMappingRule = 'NEAREST'
): LevelPosition | null {
  if (!Number.isFinite(theta) || levels.length < 2) return null
  const mapped = mapLevelsToTheta(levels, range, mappingRule)
  const index = mapped.findIndex(
    (level) => theta >= level.lowerBound && theta < level.upperBound
  )
  const band = mapped[index === -1 ? mapped.length - 1 : index]!
  const width = Math.abs(mapped[1]!.theta - mapped[0]!.theta)
  const lower = Number.isFinite(band.lowerBound)
    ? band.lowerBound
    : band.upperBound - width
  const upper = Number.isFinite(band.upperBound)
    ? band.upperBound
    : band.lowerBound + width
  return {
    levelOrder: band.order,
    position: Math.min(1, Math.max(0, (theta - lower) / (upper - lower))),
    lower,
    upper,
  }
}

/** Standard normal CDF (Abramowitz-Stegun 7.1.26, error below 1.5e-7). */
export function normalCdf(z: number) {
  const t = 1 / (1 + (0.3275911 * Math.abs(z)) / Math.SQRT2)
  const erf =
    1 -
    t *
      (0.254829592 +
        t *
          (-0.284496736 +
            t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) *
      Math.exp(-(z * z) / 2)
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2
}

export type LevelMastery = LevelPosition & {
  /**
   * Probability that the ability lies at or beyond the mastery point of the
   * level, from the estimate and its standard error (normal approximation).
   */
  probability: number
}

/**
 * Mastery of the level an estimate falls in: the chance that the true ability
 * lies at or beyond `masteryPoint` of that level's band. A precise estimate
 * high in the band gives a high probability; an uncertain one stays near 50%.
 */
export function levelMasteryOfEstimate(
  { theta, standardError }: { theta: number; standardError: number | null },
  levels: LevelDefinition[],
  range: ThetaRange = DEFAULT_THETA_RANGE,
  mappingRule: LevelMappingRule = 'NEAREST',
  masteryPoint = DEFAULT_MASTERY_POINT
): LevelMastery | null {
  const position = levelPositionOfTheta(theta, levels, range, mappingRule)
  if (!position) return null
  const cut = position.lower + masteryPoint * (position.upper - position.lower)
  const probability =
    standardError !== null && standardError > 0
      ? normalCdf((theta - cut) / standardError)
      : theta >= cut
        ? 1
        : 0
  return { ...position, probability }
}

/**
 * Mastery of a range of levels (e.g. a main level B1 = B1.1-B1.3): the chance
 * that the ability lies at or beyond `masteryPoint` of the combined band from
 * the first level's lower edge to the last level's upper edge.
 */
export function levelRangeMasteryOfEstimate(
  { theta, standardError }: { theta: number; standardError: number | null },
  levels: LevelDefinition[],
  range: { fromOrder: number; toOrder: number },
  thetaRange: ThetaRange = DEFAULT_THETA_RANGE,
  mappingRule: LevelMappingRule = 'NEAREST',
  masteryPoint = DEFAULT_MASTERY_POINT
): { position: number; probability: number } | null {
  if (!Number.isFinite(theta) || levels.length < 2) return null
  const mapped = mapLevelsToTheta(levels, thetaRange, mappingRule)
  const width = Math.abs(mapped[1]!.theta - mapped[0]!.theta)
  const first = mapped.find(({ order }) => order === range.fromOrder)
  const last = mapped.find(({ order }) => order === range.toOrder)
  if (!first || !last) return null
  const lower = Number.isFinite(first.lowerBound)
    ? first.lowerBound
    : first.upperBound - width
  const upper = Number.isFinite(last.upperBound)
    ? last.upperBound
    : last.lowerBound + width
  const cut = lower + masteryPoint * (upper - lower)
  return {
    position: Math.min(1, Math.max(0, (theta - lower) / (upper - lower))),
    probability:
      standardError !== null && standardError > 0
        ? normalCdf((theta - cut) / standardError)
        : theta >= cut
          ? 1
          : 0,
  }
}

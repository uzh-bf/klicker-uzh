import {
  DEFAULT_THETA_RANGE,
  type LevelDefinition,
  type LevelMappingRule,
  mapLevelsToTheta,
  type ThetaRange,
} from './core.js'

export const DEFAULT_WITHIN_REACH_THRESHOLD = 0.7

export type LevelPosition = {
  /** Order of the level whose band contains theta. */
  levelOrder: number
  /**
   * Where theta lies in that band: 0 at the lower edge, 1 at the boundary
   * to the next level. The open lowest band uses the width of a regular band.
   * Null for the highest level, which has no next level.
   */
  position: number | null
}

/**
 * Position of an estimate inside its level band. Presentation only: it does
 * not change the reported level, it supports a "next level within reach"
 * hint for estimates close to the boundary to the next level.
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
  if (band === mapped.at(-1)) return { levelOrder: band.order, position: null }
  const width = Math.abs(mapped[1]!.theta - mapped[0]!.theta)
  const lower = Number.isFinite(band.lowerBound)
    ? band.lowerBound
    : band.upperBound - width
  const position = (theta - lower) / (band.upperBound - lower)
  return {
    levelOrder: band.order,
    position: Math.min(1, Math.max(0, position)),
  }
}

/** True when the estimate reaches `threshold` of its band (and a next level exists). */
export function isNextLevelWithinReach(
  position: LevelPosition | null,
  threshold = DEFAULT_WITHIN_REACH_THRESHOLD
) {
  return position?.position != null && position.position >= threshold
}

// Klicker instance-specific variables
const POINTS_FIRST_LEVEL_UP = 9000
const TUNING_FACTOR = 1
// end user-specifyable variables

const POINT_FACTOR = Math.round(POINTS_FIRST_LEVEL_UP / 3)

export function xpForLevel(level: number): number {
  return (
    (POINT_FACTOR / (2 * TUNING_FACTOR)) * Math.pow(level, 2) +
    POINT_FACTOR * (1 + 1 / (2 * TUNING_FACTOR)) * level -
    POINT_FACTOR * (1 + 1 / TUNING_FACTOR)
  )
}

export function levelFromXp(xp: number): number {
  return Math.floor(
    Math.sqrt(
      POINT_FACTOR * Math.pow(2 * TUNING_FACTOR + 3, 2) + 8 * TUNING_FACTOR * xp
    ) /
      (2 * Math.sqrt(POINT_FACTOR)) -
      TUNING_FACTOR -
      0.5
  )
}

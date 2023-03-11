export function XpForLevel(level: number) {
  return 1500 * Math.pow(level, 2) + 4500 * level - 6000
}

export function LevelFromXp(xp: number) {
  return Math.floor(
    (-4500 + Math.sqrt(Math.pow(4500, 2) + 4 * 1500 * (6000 + xp))) / (2 * 1500)
  )
}

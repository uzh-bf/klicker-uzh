// shuffle an array and return a new copy
export function shuffle<T>(array: Array<T>): Array<T> {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ! ensure that the xp and level functions are in sync with the shared-components implementation
export function xpForLevel(level: number) {
  return 1500 * Math.pow(level, 2) + 4500 * level - 6000
}

export function levelFromXp(xp: number) {
  return Math.floor(
    (-4500 + Math.sqrt(Math.pow(4500, 2) + 4 * 1500 * (6000 + xp))) / (2 * 1500)
  )
}

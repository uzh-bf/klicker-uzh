// shuffle an array and return a new copy
export function shuffle<T>(array: Array<T>): Array<T> {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export { levelFromXp } from '@klicker-uzh/prisma/dist/util'

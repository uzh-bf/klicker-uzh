// ! ensure that the xp and level functions are in sync with the shared-components implementation
export function XpForLevel(level: number) {
  return 1500 * Math.pow(level, 2) + 4500 * level - 6000
}

export function LevelFromXp(xp: number) {
  return Math.floor(
    (-4500 + Math.sqrt(Math.pow(4500, 2) + 4 * 1500 * (6000 + xp))) / (2 * 1500)
  )
}

export const USER_ID_TEST = '76047345-3801-4628-ae7b-adbebcfe8821'
export const USER_ID_BF2 = 'f7ceeba0-ef5a-4d0b-a992-a44a1395cbf9'
export const COURSE_ID_TEST = '7c12e44e-d083-4acf-845e-4c34aaff6b49'
export const COURSE_ID_BF2 = 'f7ceeba0-ef5a-4d0b-a992-a44a1395cbf9'

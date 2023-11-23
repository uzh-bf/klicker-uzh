import Prisma from '../client/index.js'

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

export async function seedLevels(prisma: Prisma.PrismaClient) {
  for (let index of [11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]) {
    await prisma.level.upsert({
      where: { index },
      create: {
        index,
        name: `Level ${index}`,
        requiredXp: xpForLevel(index),
        avatar: `/levels/Level${index}.svg`,
        nextLevel: index < 11 ? { connect: { index: index + 1 } } : undefined,
      },
      update: {},
    })
  }
}

const prismaClient = new Prisma.PrismaClient()

// seedLevels(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })

import Prisma from '../client/index.js'
import { xpForLevel } from '../util.js'

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

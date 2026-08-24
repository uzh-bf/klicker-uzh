import * as Prisma from '@klicker-uzh/prisma/client'
import * as DATA_TEST from './data/TEST.js'

export async function seedAchievements(prisma: Prisma.PrismaClient) {
  const achievements = await Promise.all(
    DATA_TEST.Achievements.map(async (achievement) => {
      await prisma.achievement.upsert({
        where: { id: achievement.id },
        create: {
          id: achievement.id,
          nameDE: achievement.nameDE,
          nameEN: achievement.nameEN,
          descriptionDE: achievement.descriptionDE,
          descriptionEN: achievement.descriptionEN,
          icon: achievement.icon,
          rewardedPoints: achievement.rewardedPoints,
          rewardedXP: achievement.rewardedXP,
          type: achievement.type,
          isDiscoverable: true,
        },
        update: {
          nameDE: achievement.nameDE,
          nameEN: achievement.nameEN,
          descriptionDE: achievement.descriptionDE,
          descriptionEN: achievement.descriptionEN,
          icon: achievement.icon,
          rewardedPoints: achievement.rewardedPoints,
          rewardedXP: achievement.rewardedXP,
          isDiscoverable: true,
        },
      })
    })
  )

  return achievements
}

// All seeded achievements are discoverable: staff has manually distributed
// every entry at least once, so students can earn all of them even where no
// automatic award path exists yet.

// const prismaClient = new Prisma.PrismaClient()
// await seedAchievements(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })

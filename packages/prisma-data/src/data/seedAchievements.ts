import * as Prisma from '@klicker-uzh/prisma/client'
import * as DATA_TEST from './data/TEST.js'

// Match the rollout migration explicitly. Future seeded achievements remain
// hidden until their student-facing discoverability has been reviewed.
const DISCOVERABLE_ACHIEVEMENT_IDS = new Set([
  2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
])

export async function seedAchievements(prisma: Prisma.PrismaClient) {
  const achievements = await Promise.all(
    DATA_TEST.Achievements.map(async (achievement) => {
      const isDiscoverable = DISCOVERABLE_ACHIEVEMENT_IDS.has(achievement.id)

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
          isDiscoverable,
        },
        update: {
          nameDE: achievement.nameDE,
          nameEN: achievement.nameEN,
          descriptionDE: achievement.descriptionDE,
          descriptionEN: achievement.descriptionEN,
          icon: achievement.icon,
          rewardedPoints: achievement.rewardedPoints,
          rewardedXP: achievement.rewardedXP,
          isDiscoverable,
        },
      })
    })
  )

  return achievements
}

// const prismaClient = new Prisma.PrismaClient()
// await seedAchievements(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })

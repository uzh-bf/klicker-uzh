import Prisma from '../client/index.js'
import * as DATA_TEST from './data/TEST'

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
        },
        update: {
          nameDE: achievement.nameDE,
          nameEN: achievement.nameEN,
          descriptionDE: achievement.descriptionDE,
          descriptionEN: achievement.descriptionEN,
          icon: achievement.icon,
          rewardedPoints: achievement.rewardedPoints,
          rewardedXP: achievement.rewardedXP,
        },
      })
    })
  )
}

const prismaClient = new Prisma.PrismaClient()

await seedAchievements(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

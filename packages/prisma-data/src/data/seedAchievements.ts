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
          isDiscoverable: ACHIEVEMENT_AWARD_PATHS.includes(achievement.id),
        },
        update: {
          nameDE: achievement.nameDE,
          nameEN: achievement.nameEN,
          descriptionDE: achievement.descriptionDE,
          descriptionEN: achievement.descriptionEN,
          icon: achievement.icon,
          rewardedPoints: achievement.rewardedPoints,
          rewardedXP: achievement.rewardedXP,
          isDiscoverable: ACHIEVEMENT_AWARD_PATHS.includes(achievement.id),
        },
      })
    })
  )

  return achievements
}

// Achievements with an implemented award path (group activity grading in
// packages/graphql/src/services/groups.ts); all others are seeded as not
// discoverable until their award logic ships (gamification roadmap).
const ACHIEVEMENT_AWARD_PATHS = [8, 9]

// const prismaClient = new Prisma.PrismaClient()
// await seedAchievements(prismaClient)
//   .catch((e) => {
//     console.error(e)
//     process.exit(1)
//   })
//   .finally(async () => {
//     await prismaClient.$disconnect()
//   })

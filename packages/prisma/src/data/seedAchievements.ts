import Prisma from '@klicker-uzh/prisma'

async function seedAchievements(prisma: Prisma.PrismaClient) {
  const pilotAchievement = await prisma.achievement.upsert({
    where: { id: 2 },
    create: {
      id: 2,
      name: 'Explorer',
      description:
        'Du warst Teil des KlickerUZH im ersten Semester. Dankeschön!',
      icon: '/achievements/Erkunden.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Erkunden.svg',
    },
  })

  const solvedEverythingAchievement = await prisma.achievement.upsert({
    where: { id: 3 },
    create: {
      id: 3,
      name: 'Fleisspreis',
      description:
        'Du hast alle verfügbaren Microlearnings und Lernelemente gelöst.',
      icon: '/achievements/Fleisspreis.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Fleisspreis.svg',
    },
  })

  // TODO: include these achievements again and add icon for last place
  //   const lastPlaceAchievement = await prisma.achievement.upsert({
  //     where: { id: 4 },
  //     create: {
  //       id: 4,
  //       name: 'Trostpreis',
  //       description: 'Dabei sein ist alles (letzer Platz in einer Live-Session).',
  //       icon: 'TODO',
  //       type: 'PARTICIPANT',
  //     },
  //     update: {
  //       icon: 'TODO',
  //     },
  //   })

  //   lastPlaceIds.map(async (participant) => {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: lastPlaceAchievement.id,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: lastPlaceAchievement.id,
  //         achievedAt: new Date(),
  //         achievedCount: participant.count,
  //       },
  //       update: {},
  //     })
  //   })

  //   const goldMedalAchievement = await prisma.achievement.upsert({
  //     where: { id: 5 },
  //     create: {
  //       id: 5,
  //       name: 'Champion',
  //       description: 'Du hast einen ersten Platz in einer Live-Session erreicht.',
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(71%) sepia(100%) saturate(623%) hue-rotate(344deg) brightness(90%) contrast(89%)',
  //       type: 'PARTICIPANT',
  //     },
  //     update: {
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(71%) sepia(100%) saturate(623%) hue-rotate(344deg) brightness(90%) contrast(89%)',
  //     },
  //   })

  //   goldMedalIds.map(async (participant) => {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: goldMedalAchievement.id,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: goldMedalAchievement.id,
  //         achievedAt: new Date(),
  //         achievedCount: participant.count,
  //       },
  //       update: {},
  //     })
  //   })

  //   const silverMedalAchievement = await prisma.achievement.upsert({
  //     where: { id: 6 },
  //     create: {
  //       id: 6,
  //       name: 'Vize-Champion',
  //       description:
  //         'Du hast einen zweiten Platz in einer Live-Session erreicht.',
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(98%) sepia(0%) saturate(64%) hue-rotate(184deg) brightness(80%) contrast(89%)',
  //       type: 'PARTICIPANT',
  //     },
  //     update: {
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(98%) sepia(0%) saturate(64%) hue-rotate(184deg) brightness(80%) contrast(89%)',
  //     },
  //   })

  //   silverMedalIds.map(async (participant) => {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: silverMedalAchievement.id,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: silverMedalAchievement.id,
  //         achievedAt: new Date(),
  //         achievedCount: participant.count,
  //       },
  //       update: {},
  //     })
  //   })

  //   const bronzeMedalAchievement = await prisma.achievement.upsert({
  //     where: { id: 7 },
  //     create: {
  //       id: 7,
  //       name: 'Vize-Vize-Champion',
  //       description:
  //         'Du hast einen dritten Platz in einer Live-Session erreicht.',
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(53%) sepia(75%) saturate(457%) hue-rotate(349deg) brightness(88%) contrast(87%)',
  //       type: 'PARTICIPANT',
  //     },
  //     update: {
  //       icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/medal-solid.svg',
  //       iconColor:
  //         'invert(53%) sepia(75%) saturate(457%) hue-rotate(349deg) brightness(88%) contrast(87%)',
  //     },
  //   })

  //   bronzeMedalIds.map(async (participant) => {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: bronzeMedalAchievement.id,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: bronzeMedalAchievement.id,
  //         achievedAt: new Date(),
  //         achievedCount: participant.count,
  //       },
  //       update: {},
  //     })
  //   })

  const groupTaskPassedAchievement = await prisma.achievement.upsert({
    where: { id: 8 },
    create: {
      id: 8,
      name: 'Dream Team',
      description:
        'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
      icon: '/achievements/Dreamteam.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Dreamteam.svg',
    },
  })

  const groupTaskDoneAchievement = await prisma.achievement.upsert({
    where: { id: 9 },
    create: {
      id: 9,
      name: 'Teamgeist',
      description: 'Du hast einen Gruppentask absolviert.',
      icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/teamgeist.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/teamgeist.svg',
    },
  })

  const fewQuestionsAchievement = await prisma.achievement.upsert({
    where: { id: 10 },
    create: {
      id: 10,
      name: 'Unerschrocken',
      description:
        'Du hast eine Woche vor Ende der Vorlesung noch keine 6 Fragen beantwortet.',
      icon: '/achievements/Unerschrocken.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Unerschrocken.svg',
    },
  })
}

const prismaClient = new Prisma.PrismaClient()

seedAchievements(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

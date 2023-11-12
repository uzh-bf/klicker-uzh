import Prisma from '../../dist'

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
      name: 'Explorer',
      description:
        'Du warst Teil des KlickerUZH im ersten Semester. Dankeschön!',
      icon: '/achievements/Erkunden.svg',
    },
  })

  const solvedEverythingAchievement = await prisma.achievement.upsert({
    where: { id: 3 },
    create: {
      id: 3,
      name: 'Busy Bee',
      description:
        'Du hast alle verfügbaren Microlearnings und Lernelemente gelöst.',
      icon: '/achievements/Fleisspreis.svg',
      type: 'PARTICIPANT',
    },
    update: {
      name: 'Busy Bee',
      description:
        'Du hast alle verfügbaren Microlearnings und Lernelemente gelöst.',
      icon: '/achievements/Fleisspreis.svg',
    },
  })

  const goldMedalAchievement = await prisma.achievement.upsert({
    where: { id: 5 },
    create: {
      id: 5,
      name: 'Champion',
      description: 'Du hast einen ersten Platz in einer Live-Session erreicht.',
      icon: '/achievements/Champ.svg',
      type: 'PARTICIPANT',
      rewardedPoints: 200,
      rewardedXP: 100,
    },
    update: {
      name: 'Champion',
      description: 'Du hast einen ersten Platz in einer Live-Session erreicht.',
      icon: '/achievements/Champ.svg',
      rewardedPoints: 200,
      rewardedXP: 100,
    },
  })

  const silverMedalAchievement = await prisma.achievement.upsert({
    where: { id: 6 },
    create: {
      id: 6,
      name: 'Vize-Champion',
      description:
        'Du hast einen zweiten Platz in einer Live-Session erreicht.',
      icon: '/achievements/VizeChamp.svg',
      type: 'PARTICIPANT',
      rewardedPoints: 100,
      rewardedXP: 100,
    },
    update: {
      name: 'Vize-Champion',
      description:
        'Du hast einen zweiten Platz in einer Live-Session erreicht.',
      icon: '/achievements/VizeChamp.svg',
      rewardedPoints: 100,
      rewardedXP: 100,
    },
  })

  const bronzeMedalAchievement = await prisma.achievement.upsert({
    where: { id: 7 },
    create: {
      id: 7,
      name: 'Vize-Vize-Champion',
      description:
        'Du hast einen dritten Platz in einer Live-Session erreicht.',
      icon: '/achievements/VizevizeChamp.svg',
      type: 'PARTICIPANT',
      rewardedPoints: 50,
      rewardedXP: 100,
    },
    update: {
      name: 'Vize-Vize-Champion',
      description:
        'Du hast einen dritten Platz in einer Live-Session erreicht.',
      icon: '/achievements/VizevizeChamp.svg',
      rewardedPoints: 50,
      rewardedXP: 100,
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
      name: 'Dream Team',
      description:
        'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
      icon: '/achievements/Dreamteam.svg',
    },
  })

  const groupTaskDoneAchievement = await prisma.achievement.upsert({
    where: { id: 9 },
    create: {
      id: 9,
      name: 'Teamgeist',
      description: 'Du hast einen Gruppentask absolviert.',
      icon: '/achievements/Teamgeist.svg',
      type: 'PARTICIPANT',
    },
    update: {
      name: 'Teamgeist',
      description: 'Du hast einen Gruppentask absolviert.',
      icon: '/achievements/Teamgeist.svg',
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

  const creativeAchievement = await prisma.achievement.upsert({
    where: { id: 11 },
    create: {
      id: 11,
      name: 'Creative Mastermind',
      description: '',
      icon: '/achievements/CreativeMastermind.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/CreativeMastermind.svg',
    },
  })

  const entertainerAchievement = await prisma.achievement.upsert({
    where: { id: 12 },
    create: {
      id: 12,
      name: 'Entertainer',
      description: '',
      icon: '/achievements/Entertainer.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Entertainer.svg',
    },
  })

  const futureProofAchievement = await prisma.achievement.upsert({
    where: { id: 13 },
    create: {
      id: 13,
      name: 'Future Proof',
      description: '',
      icon: '/achievements/FutureProof.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/FutureProof.svg',
    },
  })

  const happinessAchievement = await prisma.achievement.upsert({
    where: { id: 14 },
    create: {
      id: 14,
      name: 'Happiness',
      description: '',
      icon: '/achievements/Happiness.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Happiness.svg',
    },
  })

  const presentationAchievement = await prisma.achievement.upsert({
    where: { id: 15 },
    create: {
      id: 15,
      name: 'Presentation Wizard',
      description: '',
      icon: '/achievements/PresentationWizard.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/PresentationWizard.svg',
    },
  })

  const shootingStarAchievement = await prisma.achievement.upsert({
    where: { id: 16 },
    create: {
      id: 16,
      name: 'Shooting Star',
      description: '',
      icon: '/achievements/ShootingStar.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/ShootingStar.svg',
    },
  })

  const speedyAchievement = await prisma.achievement.upsert({
    where: { id: 17 },
    create: {
      id: 17,
      name: 'Speedy',
      description: '',
      icon: '/achievements/Speedy.svg',
      type: 'PARTICIPANT',
    },
    update: {
      icon: '/achievements/Speedy.svg',
    },
  })
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

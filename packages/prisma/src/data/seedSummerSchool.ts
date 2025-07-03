import Prisma from '../../dist/index.js'

async function seedAchievements(prisma: Prisma.PrismaClient) {
  const COURSE_ID = '829c93c8-e8bc-433e-838b-5b33d3108cf4'

  // seed swiss quiz achievement
  const SWISS_QUIZ_ACHIEVEMENT_ID = 18
  const swissQuizAchievement = await prisma.achievement.upsert({
    where: { id: SWISS_QUIZ_ACHIEVEMENT_ID },
    create: {
      id: SWISS_QUIZ_ACHIEVEMENT_ID,
      name: 'Swiss Quiz',
      nameDE: 'Schweiz Quiz',
      nameEN: 'Swiss Quiz',
      icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/swiss_quiz.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {},
  })

  // seed escape room achievement
  const ESCAPE_ROOM_ACHIEVEMENT_ID = 19
  const escapeRoomAchievement = await prisma.achievement.upsert({
    where: { id: ESCAPE_ROOM_ACHIEVEMENT_ID },
    create: {
      id: ESCAPE_ROOM_ACHIEVEMENT_ID,
      name: 'Escape Room',
      nameDE: 'Escape Room',
      nameEN: 'Escape Room',
      icon: 'https://sos-ch-dk-2.exo.io/klicker-prod/achievements/uzh_escape_room.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {},
  })

  // achievement instances for swiss quiz
  const swissQuizWinners = ['2pFxA1hAEm', 'Nikolina']

  // achievement instances for escape room
  const escapeRoomWinners = ['piper', 'Belly', 'MiMi77', 'Thiago']

  // points collected during escape room
  const escapeRoomPoints = {
    '2pFxA1hAEm': 163,
    Nikolina: 299,
    'Sprindt&Lüngli': 100,
    arianna: 129,
    vihan: 367,
    Justinmoser: 333,
    piper: 400,
    Yilin: 367,
    TaylanS: 100,
    Rheinhart: 367,
    Devansh: 197,
    '14860023': 163,
    Financesis: 299,
    Ik73oqe1: 231,
    Helen1102: 299,
    DobPdPv7Xf: 197,
    Liangwen: 265,
    OliverCourtness: 299,
    Svanen: 129,
    CookieMonster: 265,
    chenjiajia1412: 231,
    agash17: 129,
    Joeyss: 333,
    Boban25: 367,
    GianLucas: 333,
    amelievastiau: 265,
    Karan: 265,
    buqichen: 129,
    Kavin: 197,
    Yanchuan: 231,
    Gloria: 333,
    Ningyi: 100,
    Belly: 400,
    SorinaMatthey: 231,
    MiMi77: 400,
    Thiago: 400,
    zoeyy: 163,
    suKJH8dWOs: 163,
  }

  // ! Grant live quiz achievements
  // await prisma.$transaction(async (prisma) => {
  //   const participants = await prisma.participant.findMany({
  //     where: { username: { in: swissQuizWinners } },
  //   })

  //   if (participants.length !== swissQuizWinners.length) {
  //     throw new Error('Not all participants found')
  //   }

  //   // upsert achievement instances for swiss quiz
  //   for (const participant of participants) {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: SWISS_QUIZ_ACHIEVEMENT_ID,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: SWISS_QUIZ_ACHIEVEMENT_ID,
  //         achievedAt: new Date('2023-07-01T12:00:00Z'),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   }
  // })

  // ! Grant escape room achievements
  await prisma.$transaction(async (prisma) => {
    const participants = await prisma.participant.findMany({
      where: { username: { in: escapeRoomWinners } },
    })

    if (participants.length !== escapeRoomWinners.length) {
      throw new Error('Not all participants found')
    }

    // upsert achievement instances for escape room
    for (const participant of participants) {
      await prisma.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: participant.id,
            achievementId: ESCAPE_ROOM_ACHIEVEMENT_ID,
          },
        },
        create: {
          participantId: participant.id,
          achievementId: ESCAPE_ROOM_ACHIEVEMENT_ID,
          achievedAt: new Date('2023-07-03T12:00:00Z'),
          achievedCount: 1,
        },
        update: {},
      })
    }
  })

  // ! Increment leaderboard entries with escape room points
  await prisma.$transaction(async (prisma) => {
    const participants = await prisma.participant.findMany({
      where: { username: { in: Object.keys(escapeRoomPoints) } },
    })

    if (participants.length !== Object.keys(escapeRoomPoints).length) {
      throw new Error('Not all participants found')
    }

    // update leaderboard entries for all participants
    for (const [username, points] of Object.entries(escapeRoomPoints)) {
      const participant = participants.find((p) => p.username === username)
      if (!participant) {
        throw new Error(`Participant not found: ${username}`)
      }

      await prisma.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: Prisma.LeaderboardType.COURSE,
            participantId: participant.id,
            courseId: COURSE_ID,
          },
        },
        create: {
          type: Prisma.LeaderboardType.COURSE,
          participantId: participant.id,
          courseId: COURSE_ID,
          score: points,
        },
        update: {
          score: {
            increment: points,
          },
        },
      })
    }
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

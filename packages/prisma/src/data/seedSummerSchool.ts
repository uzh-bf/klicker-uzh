import Prisma from '../../dist/index.js'

async function seedAchievements(prisma: Prisma.PrismaClient) {
  const COURSE_ID = '829c93c8-e8bc-433e-838b-5b33d3108cf4'

  // seed swiss quiz achievement
  const SWISS_QUIZ_ACHIEVEMENT_ID = 18
  const swissQuizAchievement = await prisma.achievement.upsert({
    where: { id: SWISS_QUIZ_ACHIEVEMENT_ID },
    create: {
      id: SWISS_QUIZ_ACHIEVEMENT_ID,
      name: 'Swiss Whiz',
      nameDE: 'Swiss Whiz',
      nameEN: 'Swiss Whiz',
      icon: 'https://klickeruzhprodimages.blob.core.windows.net/application/achievement_swiss_whiz.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {
      name: 'Swiss Whiz',
      nameDE: 'Swiss Whiz',
      nameEN: 'Swiss Whiz',
    },
  })

  // seed escape room achievement
  const ESCAPE_ROOM_ACHIEVEMENT_ID = 19
  const escapeRoomAchievement = await prisma.achievement.upsert({
    where: { id: ESCAPE_ROOM_ACHIEVEMENT_ID },
    create: {
      id: ESCAPE_ROOM_ACHIEVEMENT_ID,
      name: 'Escape Artist',
      nameDE: 'Escape Artist',
      nameEN: 'Escape Artist',
      icon: 'https://klickeruzhprodimages.blob.core.windows.net/application/achievement_escape_uzh.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {
      name: 'Escape Artist',
      nameDE: 'Escape Artist',
      nameEN: 'Escape Artist',
    },
  })

  const BUSINESS_GAME_ACHIEVEMENT_ID = 20
  const businessGameAchievement = await prisma.achievement.upsert({
    where: { id: BUSINESS_GAME_ACHIEVEMENT_ID },
    create: {
      id: BUSINESS_GAME_ACHIEVEMENT_ID,
      name: 'ChocoStrategist',
      nameDE: 'ChocoStrategist',
      nameEN: 'ChocoStrategist',
      icon: 'https://klickeruzhprodimages.blob.core.windows.net/application/achievement_choco_strategist.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {},
  })

  const PMG_GAME_ACHIEVEMENT_ID = 21
  const pmgGameAchievement = await prisma.achievement.upsert({
    where: { id: PMG_GAME_ACHIEVEMENT_ID },
    create: {
      id: PMG_GAME_ACHIEVEMENT_ID,
      name: 'Portfolio Professional',
      nameDE: 'Portfolio Professional',
      nameEN: 'Portfolio Professional',
      icon: 'https://klickeruzhprodimages.blob.core.windows.net/application/achievement_portfolio_professional.svg',
      type: Prisma.AchievementType.PARTICIPANT,
      scope: Prisma.AchievementScope.GLOBAL,
    },
    update: {},
  })

  pmgGameAchievement

  // achievement instances for swiss quiz
  // ! AWARDED
  // const swissQuizWinners = ['2pFxA1hAEm', 'Nikolina']

  // achievement instances for escape room
  // ! AWARDED
  // const escapeRoomWinners = ['piper', 'Belly', 'MiMi77', 'Thiago']

  // points collected during escape room
  // ! AWARDED
  // const escapeRoomPoints = {
  //   '2pFxA1hAEm': 163,
  //   Nikolina: 299,
  //   'Sprindt&Lüngli': 100,
  //   arianna: 129,
  //   vihan: 367,
  //   Justinmoser: 333,
  //   piper: 400,
  //   Yilin: 367,
  //   TaylanS: 100,
  //   Rheinhart: 367,
  //   Devansh: 197,
  //   '14860023': 163,
  //   Financesis: 299,
  //   Ik73oqe1: 231,
  //   Helen1102: 299,
  //   DobPdPv7Xf: 197,
  //   Liangwen: 265,
  //   OliverCourtness: 299,
  //   Svanen: 129,
  //   CookieMonster: 265,
  //   chenjiajia1412: 231,
  //   agash17: 129,
  //   Joeyss: 333,
  //   Boban25: 367,
  //   GianLucas: 333,
  //   amelievastiau: 265,
  //   Karan: 265,
  //   buqichen: 129,
  //   Kavin: 197,
  //   Yanchuan: 231,
  //   Gloria: 333,
  //   Ningyi: 100,
  //   Belly: 400,
  //   SorinaMatthey: 231,
  //   MiMi77: 400,
  //   Thiago: 400,
  //   zoeyy: 163,
  //   suKJH8dWOs: 163,
  // }

  // achievement instances for business game
  // ! AWARDED
  // const businessGameWinners = [
  //   'Ik73oqe1',
  //   'chenjiajia1412',
  //   'Yanchuan',
  //   'SorinaMatthey',
  // ]

  // points collected during business game
  // ! AWARDED
  // const businessGamePoints = {
  //   Ik73oqe1: 1000,
  //   vihan: 800,
  //   chenjiajia1412: 1000,
  //   Yilin: 800,
  //   Rheinhart: 800,
  //   Yanchuan: 1000,
  //   piper: 700,
  //   SorinaMatthey: 1000,
  //   Boban25: 800,
  //   Nikolina: 600,
  //   arianna: 900,
  //   Justinmoser: 700,
  //   '2pFxA1hAEm': 700,
  //   Belly: 700,
  //   Svanen: 900,
  //   Joeyss: 700,
  //   agash17: 900,
  //   MiMi77: 700,
  //   GianLucas: 700,
  //   buqichen: 900,
  //   Thiago: 700,
  //   Gloria: 700,
  //   Devansh: 700,
  //   Financesis: 600,
  //   Helen1102: 600,
  //   DobPdPv7Xf: 700,
  //   OliverCourtness: 600,
  //   '14860023': 700,
  //   Liangwen: 600,
  //   CookieMonster: 600,
  //   Kavin: 700,
  //   amelievastiau: 600,
  //   Karan: 600,
  //   'Sprindt&Lüngli': 600,
  //   TaylanS: 600,
  //   zoeyy: 700,
  //   suKJH8dWOs: 700,
  //   Ningyi: 600,
  // }

  // achievement instances for PMG game
  // ! AWARDED
  // const pmgGameWinners = [
  //   'Boban25',
  //   'Financesis',
  //   'Liangwen',
  //   'DobPdPv7Xf',
  //   'Ik73oqe1',
  //   'buqichen',
  // ]

  // points collected during PMG game
  // ! AWARDED
  // const pmgGamePoints = {
  //   Boban25: 1000,
  //   Financesis: 1000,
  //   Liangwen: 1000,
  //   DobPdPv7Xf: 1000,
  //   Ik73oqe1: 1000,
  //   buqichen: 1000,
  //   OliverCourtness: 800,
  //   'Sprindt&Lüngli': 800,
  //   Yanchuan: 800,
  //   Yilin: 800,
  //   CookieMonster: 700,
  //   Ningyi: 700,
  //   '14860023': 700,
  //   vihan: 700,
  //   Devansh: 700,
  //   Rheinhart: 700,
  //   MiMi77: 700,
  //   Justinmoser: 700,
  //   '2pFxA1hAEm': 700,
  //   Gloria: 700,
  //   piper: 700,
  //   amelievastiau: 700,
  //   chenjiajia1412: 700,
  //   Thiago: 700,
  //   Helen1102: 700,
  //   GianLucas: 700,
  //   suKJH8dWOs: 600,
  //   Kavin: 600,
  //   arianna: 600,
  //   SorinaMatthey: 600,
  //   agash17: 600,
  //   TaylanS: 600,
  //   Joeyss: 600,
  //   Belly: 600,
  //   Karan: 600,
  //   Svanen: 600,
  //   Nikolina: 600,
  //   zoeyy: 600,
  // }

  // ! Grant achievements
  // const ACHIEVEMENT_USERNAMES = pmgGameWinners
  // const ACHIEVEMENT_ID = pmgGameAchievement.id
  // await prisma.$transaction(async (prisma) => {
  //   const participants = await prisma.participant.findMany({
  //     where: { username: { in: ACHIEVEMENT_USERNAMES } },
  //   })

  //   if (participants.length !== ACHIEVEMENT_USERNAMES.length) {
  //     throw new Error('Not all participants found')
  //   }

  //   // upsert achievement instances
  //   for (const participant of participants) {
  //     await prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId: participant.id,
  //           achievementId: ACHIEVEMENT_ID,
  //         },
  //       },
  //       create: {
  //         participantId: participant.id,
  //         achievementId: ACHIEVEMENT_ID,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   }
  // })

  // ! Increment leaderboard entries with points
  // const POINTS = pmgGamePoints
  // await prisma.$transaction(async (prisma) => {
  //   const participants = await prisma.participant.findMany({
  //     where: { username: { in: Object.keys(POINTS) } },
  //   })

  //   if (participants.length !== Object.keys(POINTS).length) {
  //     throw new Error('Not all participants found')
  //   }

  //   // update leaderboard entries for all participants
  //   for (const [username, points] of Object.entries(POINTS)) {
  //     const participant = participants.find((p) => p.username === username)
  //     if (!participant) {
  //       throw new Error(`Participant not found: ${username}`)
  //     }

  //     await prisma.leaderboardEntry.upsert({
  //       where: {
  //         type_participantId_courseId: {
  //           type: Prisma.LeaderboardType.COURSE,
  //           participantId: participant.id,
  //           courseId: COURSE_ID,
  //         },
  //       },
  //       create: {
  //         type: Prisma.LeaderboardType.COURSE,
  //         participantId: participant.id,
  //         courseId: COURSE_ID,
  //         score: points,
  //       },
  //       update: {
  //         score: {
  //           increment: points,
  //         },
  //       },
  //     })
  //   }
  // })
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

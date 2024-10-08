import Prisma from '../../dist/index.js'

async function seedAchievements(prisma: Prisma.PrismaClient) {
  // // PERFORMANCE
  // const PERFORMANCE_IDS = [
  //   'ec8d958f-db17-4e41-8891-b7a906f49dc3',
  //   'f037c815-bb05-4082-b8ef-6919a8a40a60',
  //   'e8f654e3-ce4f-4b13-95c8-3ee61b71ed2f',
  //   '620c74f2-2e38-4609-9fe3-8daa03ee2525',
  // ]
  // // PRESENTATION & SPEED
  // const PRESENTATION_SPEED_IDS = [
  //   '7742fcdb-933a-4220-bef5-f449ffb3d22c',
  //   'cf3ae40c-6c8c-4e9a-b259-b2469b59b255',
  //   'a142e6c6-596f-4b76-9cfb-d1367811babc',
  //   'ab0ae4f9-7595-4fed-a540-2b5fce45085c',
  // ]
  // // CREATIVE
  // const CREATIVE_IDS = [
  //   '9a8e7d3d-8ec7-41e8-98af-16a5aeb316a5',
  //   '0c33fb80-347a-4152-8c87-d0ee529f2742',
  //   '315a0ed7-6718-4ed7-8a20-392862dfb9e2',
  //   'be13ada5-d48a-4a9e-a82d-2eebdb52b2b8',
  //   '17a3e5bf-24f4-41c7-90c9-8c53856aa42c',
  //   '48553d1b-d756-418c-a871-aa215283d3cf',
  //   '78dcdcf1-becc-40eb-98ba-1ce4dc1ae0a3',
  //   '4223636c-2bf0-429a-b3da-adacfac503ab',
  //   '0a350ec0-1b3a-468b-a342-fdb59165f7c2',
  //   'b7491b8c-aecc-45ae-9bec-d3c9f9644aa9',
  //   '50b7fb4c-00a8-43c0-acb6-21010e8c6198',
  //   'ec8d958f-db17-4e41-8891-b7a906f49dc3',
  //   'f037c815-bb05-4082-b8ef-6919a8a40a60',
  //   'e8f654e3-ce4f-4b13-95c8-3ee61b71ed2f',
  //   '620c74f2-2e38-4609-9fe3-8daa03ee2525',
  //   'd39fb4fe-cce4-4ee3-b16b-c4cdff3d65a9',
  //   'ddad16ff-2f46-42c1-b40f-f0d0ce06e74e',
  //   '68047b81-e5e5-4e31-93a0-695c5e8c3cb6',
  //   'c8205908-558d-45cf-942b-07dc2dc0e642',
  // ]
  // // ENTERTAINER
  // const ENTERTAINER_IDS = [
  //   '9a8e7d3d-8ec7-41e8-98af-16a5aeb316a5',
  //   '0716a870-b2b4-4c50-962a-abd624ae9032',
  // ]

  const HAPPY_IDS = [
    '86558cfc-4a4a-47b6-a7d4-1e1a3aa69f95',
    '9a8e7d3d-8ec7-41e8-98af-16a5aeb316a5',
    '17a3e5bf-24f4-41c7-90c9-8c53856aa42c',
    '50b7fb4c-00a8-43c0-acb6-21010e8c6198',
    '7742fcdb-933a-4220-bef5-f449ffb3d22c',
    'a142e6c6-596f-4b76-9cfb-d1367811babc',
    'ab0ae4f9-7595-4fed-a540-2b5fce45085c',
    '0716a870-b2b4-4c50-962a-abd624ae9032',
    '54254af7-be65-40d3-a754-a4afe7ac4251',
    '4ea6e33a-a508-4d61-98bc-94ed65820e88',
  ]

  const BEE_IDS = [
    'af3f0636-e10f-4f10-abc0-25f37225620a',
    '86558cfc-4a4a-47b6-a7d4-1e1a3aa69f95',
    '3a2fd047-e3e3-4490-9eb8-3dbd703247af',
    '9a8e7d3d-8ec7-41e8-98af-16a5aeb316a5',
    'be13ada5-d48a-4a9e-a82d-2eebdb52b2b8',
    '17a3e5bf-24f4-41c7-90c9-8c53856aa42c',
    '48553d1b-d756-418c-a871-aa215283d3cf',
    '78dcdcf1-becc-40eb-98ba-1ce4dc1ae0a3',
    '029551dc-c1d6-469c-8580-a63122a924c3',
    'cb6904f3-d72e-44d8-9792-05667e98827d',
    '10b986cc-5704-496e-973e-200ce43e06ae',
    '1dd80295-b371-43c9-be6b-8fe6f9f65df9',
    'b7491b8c-aecc-45ae-9bec-d3c9f9644aa9',
    '50b7fb4c-00a8-43c0-acb6-21010e8c6198',
    'ab0ae4f9-7595-4fed-a540-2b5fce45085c',
    'f037c815-bb05-4082-b8ef-6919a8a40a60',
    'e8f654e3-ce4f-4b13-95c8-3ee61b71ed2f',
    '620c74f2-2e38-4609-9fe3-8daa03ee2525',
    'ddad16ff-2f46-42c1-b40f-f0d0ce06e74e',
    '68047b81-e5e5-4e31-93a0-695c5e8c3cb6',
    '0716a870-b2b4-4c50-962a-abd624ae9032',
    '1c86e22c-6b7f-4b9b-b047-fccaa14c17e9',
    '4ea6e33a-a508-4d61-98bc-94ed65820e88',
    'f9ea97fa-ad51-4b1f-acf9-18e8b811b6be',
  ]

  await prisma.$transaction(
    HAPPY_IDS.map((participantId) =>
      prisma.leaderboardEntry.update({
        where: {
          type_participantId_courseId: {
            participantId,
            courseId: '9072f64f-f879-4f1a-a05c-9f87707409ac',
            type: 'COURSE',
          },
        },
        data: {
          score: {
            increment: 100,
          },
        },
      })
    )
  )

  await prisma.$transaction(
    BEE_IDS.map((participantId) =>
      prisma.leaderboardEntry.update({
        where: {
          type_participantId_courseId: {
            participantId,
            courseId: '9072f64f-f879-4f1a-a05c-9f87707409ac',
            type: 'COURSE',
          },
        },
        data: {
          score: {
            increment: 100,
          },
        },
      })
    )
  )

  // await prisma.$transaction(
  //   HAPPY_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 14,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 14,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   HAPPY_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 250,
  //         },
  //       },
  //     })
  //   )
  // )

  // await prisma.$transaction(
  //   BEE_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 3,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 3,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   BEE_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 250,
  //         },
  //       },
  //     })
  //   )
  // )

  // await prisma.$transaction(
  //   ENTERTAINER_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 250,
  //         },
  //       },
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PERFORMANCE_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 16,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 16,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PERFORMANCE_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 500,
  //         },
  //       },
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PERFORMANCE_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 500,
  //         },
  //       },
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PRESENTATION_SPEED_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 15,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 15,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PRESENTATION_SPEED_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 17,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 17,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   PRESENTATION_SPEED_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 1000,
  //         },
  //       },
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   CREATIVE_IDS.map((participantId) =>
  //     prisma.participantAchievementInstance.upsert({
  //       where: {
  //         participantId_achievementId: {
  //           participantId,
  //           achievementId: 11,
  //         },
  //       },
  //       create: {
  //         participantId,
  //         achievementId: 11,
  //         achievedAt: new Date(),
  //         achievedCount: 1,
  //       },
  //       update: {},
  //     })
  //   )
  // )
  // await prisma.$transaction(
  //   CREATIVE_IDS.map((participantId) =>
  //     prisma.participant.update({
  //       where: {
  //         id: participantId,
  //       },
  //       data: {
  //         xp: {
  //           increment: 250,
  //         },
  //       },
  //     })
  //   )
  // )
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

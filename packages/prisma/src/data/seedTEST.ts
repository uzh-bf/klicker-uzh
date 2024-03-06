import Prisma from '../../dist'
import { Element } from '../client'
import {
  COURSE_ID_TEST,
  USER_ID_TEST,
  USER_ID_TEST2,
  USER_ID_TEST3,
  USER_ID_TEST4,
} from './constants.js'
import * as DATA_TEST from './data/TEST'
import {
  prepareContentElements,
  prepareCourse,
  prepareFlashcardsFromFile,
  prepareGroupActivityClues,
  prepareGroupActivityStack,
  prepareParticipant,
  prepareQuestion,
  prepareSession,
  prepareStackVariety,
  prepareUser,
} from './helpers.js'
import { seedAchievements } from './seedAchievements'
import { seedLevels } from './seedLevels'

export const PARTICIPANT_IDS = [
  '6f45065c-667f-4259-818c-c6f6b477eb48',
  '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
  '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
  '16c39a69-03b4-4ce4-a695-e7b93d535598',
  'c48f624e-7de9-4e1b-a16d-82d22e64828f',
  '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
  'f53e6a95-689b-48c0-bfab-6625c04f39ed',
  '46407010-0e7c-4903-9a66-2c8d9d6909b0',
  '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
  '05a933a0-b2bc-4551-b7e1-6975140d996d',
  'bb822996-97d6-41e4-b648-d93057d1b49c',
  'abf8ddf8-f90d-4d29-af8b-6f007d41dd23',
  'de19e261-7848-4f4a-8992-e1e5db4b6825',
  'c9e11f3f-d485-4ed3-bd05-5eefedf4987f',
  '1b3ebc59-b93c-414d-a69e-cc2783221e28',
  '1b348636-d665-4618-9ed0-90ddb27a36b0',
  'e9c2e5da-0954-4970-a7c8-c752cb76b8df',
  '6283a267-1e66-4429-b7b8-3449d52ca87a',
  'f99c2387-56b6-407c-9b9a-19eba6bde857',
  '60f451a4-9005-4f08-90b6-3df7ff648aff',
  '2d7f7f11-c7ab-4223-acbf-c248c07a2e90',
  'd9fc5c24-4357-4a8f-ac5b-d56e6b22690d',
  '7013c323-12c5-45c4-8af4-40474bb08f27',
  'ef14f3c6-24b1-44eb-a464-63cede2255b3',
]

export const PARTICIPANT_GROUP_IDS = [
  '9c4940c1-87ca-47a7-afc4-cd85656df3e7',
  '4fc5c849-5a2b-437c-a6fd-91daac4e556a',
  '0de95dcb-1802-47f7-9fb9-01085d1d2281',
  '6f4ae38f-5866-4d24-8844-cd380998591c',
  'e91fe13f-4394-496f-b12f-993f9a1a8dba',
  'ac6a7361-f71e-4fcd-821f-8904954af90f',
  'f30a99f8-3d66-4f28-8aaf-af64b392de05',
  'e5ddf45a-89e3-466a-9d17-e60354470925',
  'fb1c3685-f51e-4585-8444-dbbe2ddb76a4',
  'f2f843c6-a35e-46d7-9574-902e1d134d6c',
  'd822a233-c6d4-4cb5-a7b8-4a265d7ffaa0',
]

async function seedTest(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  await seedLevels(prisma)
  await seedAchievements(prisma)

  const standardUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST,
      name: 'Lecturer',
      email: 'lecturer@bf.uzh.ch',
      shortname: 'lecturer',
      password: 'abcd',
      catalystIndividual: true,
      catalystInstitutional: true,
    })
  )

  const freeUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST2,
      name: 'Free Tier User',
      email: 'free@bf.uzh.ch',
      shortname: 'free',
      password: 'abcd',
    })
  )

  const individualProUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST3,
      name: 'Individual Pro User',
      email: 'pro1@bf.uzh.ch',
      shortname: 'pro1',
      password: 'abcd',
      catalystIndividual: true,
    })
  )

  const institutionalProUser = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST4,
      name: 'Institutional Pro User',
      email: 'pro2@bf.uzh.ch',
      shortname: 'pro2',
      password: 'abcd',
      catalystInstitutional: true,
    })
  )

  const courseTest = await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_TEST,
      name: 'Testkurs',
      displayName: 'Testkurs',
      ownerId: USER_ID_TEST,
      color: '#016272',
      pinCode: 123456789,
      startDate: new Date('2023-01-01T00:00'),
      endDate: new Date('2030-01-01T23:59'),
      groupDeadlineDate: new Date('2024-01-01T00:01'),
      notificationEmail: process.env.NOTIFICATION_EMAIL as string,
    })
  )

  const questionsTest = (await Promise.all(
    DATA_TEST.QUESTIONS.map((data) =>
      prisma.element.upsert(prepareQuestion({ ownerId: USER_ID_TEST, ...data }))
    )
  )) as Element[]

  // ----- ELEMENT STACK SEED -----
  // const microLearningTestWithStacks = await prisma.microLearning.upsert({
  //   where: {
  //     id: 'f9d2c9f0-2e1c-4c1b-9c4c-6a1d2f7f0f2b',
  //   },
  //   create: {
  //     id: 'f9d2c9f0-2e1c-4c1b-9c4c-6a1d2f7f0f2b',
  //     name: 'Test Microlearning',
  //     displayName: 'Test Microlearning',
  //     description: 'Test Microlearning',
  //     ownerId: USER_ID_TEST,
  //     courseId: COURSE_ID_TEST,
  //     status: Prisma.PublicationStatus.PUBLISHED,
  //     scheduledEndAt: new Date('2025-03-17T11:00:00.000Z'),
  //     scheduledStartAt: new Date('2020-03-10T11:00:00.000Z'),
  //     stacks: {
  //       create: [
  //         {
  //           type: 'MICROLEARNING',
  //           options: {},
  //           elements: {
  //             create: [
  //               {
  //                 elementId: 1,
  //               },
  //             ],
  //           },
  //         },
  //       ],
  //     },
  //   },
  //   update: {},
  // })

  // const liveQuizTestWithStacks = await prisma.liveQuiz.upsert({
  //   where: {
  //     id: 'f98c4633-085d-4681-8e4c-dc03772c2aa0',
  //   },
  //   create: {
  //     id: 'f98c4633-085d-4681-8e4c-dc03772c2aa0',
  //     name: 'Test Live Quiz',
  //     displayName: 'Test Live Quiz',
  //     description: 'Test Live Quiz',
  //     ownerId: USER_ID_TEST,
  //     courseId: COURSE_ID_TEST,
  //     status: Prisma.LiveQuizStatus.PREPARED,
  //     stacks: {
  //       create: [
  //         {
  //           type: 'LIVE_QUIZ',
  //           options: {},
  //           elements: {
  //             create: [
  //               {
  //                 elementId: 1,
  //               },
  //             ],
  //           },
  //         },
  //       ],
  //     },
  //   },
  //   update: {},
  // })

  // const groupActivityTestWithStacks = await prisma.groupActivity.upsert({
  //   where: {
  //     id: 'b1556e4b-3856-4b4a-87eb-70817e97e16a',
  //   },
  //   create: {
  //     id: 'b1556e4b-3856-4b4a-87eb-70817e97e16a',
  //     name: 'Test Group Activity',
  //     displayName: 'Test Group Activity',
  //     description: 'Test Group Activity',
  //     ownerId: USER_ID_TEST,
  //     courseId: COURSE_ID_TEST,
  //     status: Prisma.GroupActivityStatus.PUBLISHED,
  //     elementStack: {
  //       create: {
  //         type: 'GROUP_ACTIVITY',
  //         options: {},
  //         elements: {
  //           create: [
  //             {
  //               elementId: 1,
  //             },
  //           ],
  //         },
  //       },
  //     },
  //   },
  //   update: {},
  // })

  // ----- LEGACY SEED -----
  const sessionsTest = await Promise.all(
    DATA_TEST.SESSIONS.map(async (data) =>
      prisma.liveSession.upsert(
        await prepareSession({
          ...data,
          blocks: data.blocks.map((block, ix) => ({
            ...block,
            order: ix,
            questions: questionsTest
              .filter((q) => block.questions.includes(parseInt(q.originalId!)))
              .map(async (q) => q),
          })),
          ownerId: USER_ID_TEST,
          courseId: COURSE_ID_TEST,
        })
      )
    )
  )

  // TODO: remove after migration to new data structure
  // const GROUP_ACTIVITY_ID = '06e53b6b-97b1-4e29-b70f-e5309a2a3369'
  // const groupActivityTest = await prisma.groupActivity.upsert({
  //   where: {
  //     id: GROUP_ACTIVITY_ID,
  //   },
  //   create: {
  //     id: GROUP_ACTIVITY_ID,
  //     name: 'Gruppenquest 1',
  //     displayName: 'Gruppenquest 1',
  //     description: `testing it`,
  //     status: 'PUBLISHED',
  //     scheduledStartAt: new Date('2020-03-10T11:00:00.000Z'),
  //     scheduledEndAt: new Date('2025-03-17T11:00:00.000Z'),
  //     parameters: {},
  //     clues: {
  //       connectOrCreate: [
  //         ...prepareGroupActivityClues({ activityId: GROUP_ACTIVITY_ID }),
  //       ],
  //     },
  //     instances: {
  //       connectOrCreate: await Promise.all(
  //         [0].map(async (qId, ix) => {
  //           const question = await prisma.element.findUnique({
  //             where: { originalId: String(qId) },
  //           })

  //           return {
  //             where: {
  //               type_groupActivityId_order: {
  //                 type: 'GROUP_ACTIVITY',
  //                 groupActivityId: GROUP_ACTIVITY_ID,
  //                 order: ix,
  //               },
  //             },
  //             create: prepareQuestionInstance({
  //               question,
  //               type: 'GROUP_ACTIVITY',
  //               order: ix,
  //             }),
  //           }
  //         })
  //       ),
  //     },
  //     owner: {
  //       connect: {
  //         id: USER_ID_TEST,
  //       },
  //     },
  //     course: {
  //       connect: {
  //         id: COURSE_ID_TEST,
  //       },
  //     },
  //   },
  //   update: {},
  // })

  // create participants
  const participantsTesting = await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id,
          password: 'abcd',
          username: `testuser${ix + 1}`,
          courseIds: [COURSE_ID_TEST],
        })
      )
    })
  )

  // create participations for all participants
  const participations = await Promise.all(
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participation.upsert({
        where: {
          courseId_participantId: {
            courseId: COURSE_ID_TEST,
            participantId: id,
          },
        },
        create: {
          isActive: true,
          course: {
            connect: {
              id: COURSE_ID_TEST,
            },
          },
          participant: {
            connect: {
              id: id,
            },
          },
        },
        update: {
          isActive: true,
        },
      })
    })
  )

  // create leaderboard entries for the top 15
  const leaderboardEntries = await Promise.all(
    PARTICIPANT_IDS.slice(0, 15).map(async (id, ix) => {
      return prisma.leaderboardEntry.upsert({
        where: {
          type_participantId_courseId: {
            type: 'COURSE',
            courseId: COURSE_ID_TEST,
            participantId: id,
          },
        },
        create: {
          type: 'COURSE',
          score: ix * 100 + 100,
          participant: {
            connect: {
              id: id,
            },
          },
          course: {
            connect: {
              id: COURSE_ID_TEST,
            },
          },
          participation: {
            connect: {
              courseId_participantId: {
                courseId: COURSE_ID_TEST,
                participantId: id,
              },
            },
          },
        },
        update: {},
      })
    })
  )

  // create participant groups
  const participantGroupsTesting = await Promise.all(
    PARTICIPANT_GROUP_IDS.map(async (id, ix) => {
      const code = 100000 + Math.floor(Math.random() * 900000)

      return prisma.participantGroup.upsert({
        where: {
          id,
        },
        create: {
          id,
          name: `Gruppe ${ix + 1}`,
          code: code,
          courseId: COURSE_ID_TEST,
          participants: {
            connect: [
              {
                id: PARTICIPANT_IDS[ix],
              },
              {
                id: PARTICIPANT_IDS[ix + PARTICIPANT_GROUP_IDS.length],
              },
            ],
          },
          averageMemberScore: Math.round(ix * 100 + 500),
        },
        update: {
          name: `Gruppe ${ix + 1}`,
          code: code,
        },
      })
    })
  )

  const participantsNoCourse = await Promise.all(
    [
      '908f84d0-fd32-4a99-8a9f-b4793288234d',
      'ec8385db-e951-47dc-9e86-e215b7e4c501',
    ].map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id,
          password: 'abcd',
          username: `testuser${ix + PARTICIPANT_IDS.length + 1}`,
          courseIds: [],
        })
      )
    })
  )

  const awardedPilotAchievements = await Promise.all(
    PARTICIPANT_IDS.map(async (participantId) => {
      await prisma.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: participantId,
            achievementId: DATA_TEST.AchievementIds.Explorer,
          },
        },
        create: {
          participant: {
            connect: {
              id: participantId,
            },
          },
          achievement: {
            connect: {
              id: DATA_TEST.AchievementIds.Explorer,
            },
          },
          achievedAt: new Date(),
          achievedCount: 1,
        },
        update: {},
      })
    })
  )

  const awardedAchievements = [
    DATA_TEST.AchievementIds['Busy Bee'],
    DATA_TEST.AchievementIds['Dream Team'],
    DATA_TEST.AchievementIds['Team Spirit'],
    DATA_TEST.AchievementIds.Fearless,
  ].map(async (achievementId) => {
    await prisma.participantAchievementInstance.upsert({
      where: {
        participantId_achievementId: {
          participantId: PARTICIPANT_IDS[0],
          achievementId: achievementId,
        },
      },
      create: {
        participant: {
          connect: {
            id: PARTICIPANT_IDS[0],
          },
        },
        achievement: {
          connect: {
            id: achievementId,
          },
        },
        achievedAt: new Date(),
        achievedCount: 1,
      },
      update: {},
    })
  })

  // seed practice quiz
  const flashcards = (await prepareFlashcardsFromFile(
    prisma,
    'data/FC_Modul_1.xml',
    USER_ID_TEST
  )) as Element[]

  // seed content elements
  const contentElements = (await prepareContentElements(
    prisma,
    {
      'Dummy Content Element 1':
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Dummy Content 1',
      'Dummy Content Element 2':
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Dummy Content 2',
      'Dummy Content Element 3':
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed vitae nisl euismod, aliquam nunc vita. Dummy Content 3',
    },
    USER_ID_TEST
  )) as Element[]

  const groupActivityId1 = '99fe99d2-696c-46d7-b6ae-cf385879822a'
  const groupActivityPublished = await prisma.groupActivity.upsert({
    where: {
      id: groupActivityId1,
    },
    create: {
      id: groupActivityId1,
      name: 'Gruppenquest Published',
      displayName: 'Gruppenquest Published',
      description: `Description of the published group activity.`,
      status: Prisma.GroupActivityStatus.PUBLISHED,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId1 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            migrationIdOffset: 0,
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
            connectStackToCourse: true,
          }),
        },
      },
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_TEST,
        },
      },
    },
    update: {},
  })

  const groupActivityId2 = '07e9847d-32bb-44a1-af49-de11a2151a92'
  const groupActivityDraft = await prisma.groupActivity.upsert({
    where: {
      id: groupActivityId2,
    },
    create: {
      id: groupActivityId2,
      name: 'Gruppenquest Draft',
      displayName: 'Gruppenquest Draft',
      description: `Description of the draft group activity.`,
      status: Prisma.GroupActivityStatus.DRAFT,
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          ...prepareGroupActivityClues({ activityId: groupActivityId2 }),
        ],
      },
      stacks: {
        create: {
          ...prepareGroupActivityStack({
            migrationIdOffset: 100,
            flashcards,
            questions: questionsTest,
            contentElements,
            courseId: COURSE_ID_TEST,
            connectStackToCourse: false,
          }),
        },
      },
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_TEST,
        },
      },
    },
    update: {},
  })

  const quizId = '4214338b-c5af-4ff7-84f9-ae5a139d6e5b'
  const practiceQuiz = await prismaClient.practiceQuiz.upsert({
    where: {
      id: quizId,
    },
    create: {
      id: quizId,
      name: 'Practice Quiz Demo',
      displayName: 'Practice Quiz Demo Student Title',
      description:
        'This is a **description** of the practice quiz, illustrating the use of flashcards, questions and content elements.',
      ownerId: USER_ID_TEST,
      courseId: COURSE_ID_TEST,
      status: Prisma.PublicationStatus.PUBLISHED,
      orderType: Prisma.ElementOrderType.SPACED_REPETITION,
      stacks: {
        create: [
          ...prepareStackVariety({
            migrationIdOffset: 200,
            flashcards: flashcards,
            questions: questionsTest,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.PRACTICE_QUIZ,
            elementInstanceType: Prisma.ElementInstanceType.PRACTICE_QUIZ,
            courseId: COURSE_ID_TEST,
          }),
        ],
      },
    },
    update: {},
    include: {
      stacks: {
        include: {
          elements: true,
        },
      },
    },
  })

  const microlearningId1 = 'd2f7fcbc-a54c-4518-b094-91d8adbd803f'
  const microlearningPublished = await prismaClient.microLearning.upsert({
    where: {
      id: microlearningId1,
    },
    create: {
      id: microlearningId1,
      name: 'Test Microlearning',
      displayName: 'Test Microlearning',
      description: `
Diese Woche lernen wir...

Mehr bla bla...
`,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_TEST,
        },
      },
      pointsMultiplier: 4,
      status: Prisma.PublicationStatus.PUBLISHED,
      scheduledEndAt: new Date('2030-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2020-01-01T11:00:00.000Z'),
      stacks: {
        create: [
          ...prepareStackVariety({
            migrationIdOffset: 300,
            flashcards: flashcards,
            questions: questionsTest,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
          }),
        ],
      },
    },
    update: {},
  })

  const microlearningId2 = '6a0b6674-5f9b-40fd-90a4-53d493c210ba'
  const microlearningFuture = await prismaClient.microLearning.upsert({
    where: {
      id: microlearningId2,
    },
    create: {
      id: microlearningId2,
      name: 'Test Microlearning Future',
      displayName: 'Test Microlearning Future',
      description: `
In ferner Zukunft lernen wir...

Mehr bla bla...
`,
      owner: {
        connect: {
          id: USER_ID_TEST,
        },
      },
      course: {
        connect: {
          id: COURSE_ID_TEST,
        },
      },
      pointsMultiplier: 1,
      status: Prisma.PublicationStatus.DRAFT,
      scheduledEndAt: new Date('2040-01-01T11:00:00.000Z'),
      scheduledStartAt: new Date('2030-01-01T11:00:00.000Z'),
      stacks: {
        create: [
          ...prepareStackVariety({
            migrationIdOffset: 400,
            flashcards: flashcards,
            questions: questionsTest,
            contentElements: contentElements,
            stackType: Prisma.ElementStackType.MICROLEARNING,
            elementInstanceType: Prisma.ElementInstanceType.MICROLEARNING,
            courseId: COURSE_ID_TEST,
          }),
        ],
      },
    },
    update: {},
  })
}

const prismaClient = new Prisma.PrismaClient()

await seedTest(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

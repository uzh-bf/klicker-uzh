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
  getInitialElementResults,
  prepareContentElements,
  prepareCourse,
  prepareFlashcardsFromFile,
  prepareLearningElement,
  prepareMicroSession,
  prepareParticipant,
  prepareQuestion,
  prepareQuestionInstance,
  prepareSession,
  prepareUser,
  processElementData,
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
      endDate: new Date('2024-01-01T23:59'),
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
  //     status: Prisma.MicroLearningStatus.PUBLISHED,
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
  const learningElementsTest = await Promise.all(
    DATA_TEST.LEARNING_ELEMENTS.map(async (data) =>
      prisma.learningElement.upsert(
        await prepareLearningElement({
          ...data,
          ownerId: USER_ID_TEST,
          courseId: COURSE_ID_TEST,
          stacks: data.stacks.map((stack) => {
            return {
              ...stack,
              elements: stack.elements.map((element) => {
                if (typeof element !== 'string') {
                  return questionsTest.find(
                    (q) => parseInt(q.originalId!) === element
                  ) as Element
                }
                return element
              }),
            }
          }),
        })
      )
    )
  )

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

  const microSessionsTest = await Promise.all(
    DATA_TEST.MICRO_SESSIONS.map(async (data) =>
      prisma.microSession.upsert(
        await prepareMicroSession({
          ...data,
          ownerId: USER_ID_TEST,
          courseId: COURSE_ID_TEST,
          status: Prisma.MicroSessionStatus.PUBLISHED,
          questions: questionsTest
            .filter((q) => data.questions.includes(parseInt(q.originalId!)))
            .map(async (q) => q),
        })
      )
    )
  )

  const GROUP_ACTIVITY_ID = '06e53b6b-97b1-4e29-b70f-e5309a2a3369'
  const groupActivityTest = await prisma.groupActivity.upsert({
    where: {
      id: GROUP_ACTIVITY_ID,
    },
    create: {
      id: GROUP_ACTIVITY_ID,
      name: 'Gruppenquest 1',
      displayName: 'Gruppenquest 1',
      description: `testing it`,
      status: 'PUBLISHED',
      scheduledStartAt: new Date('2020-03-10T11:00:00.000Z'),
      scheduledEndAt: new Date('2025-03-17T11:00:00.000Z'),
      parameters: {},
      clues: {
        connectOrCreate: [
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond1',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond1',
              displayName: 'Bond 1',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond2',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond2',
              displayName: 'Bond 2',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond3',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond3',
              displayName: 'Bond 3',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond4',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond4',
              displayName: 'Bond 4',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond5',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond5',
              displayName: 'Bond 5',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond6',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond6',
              displayName: 'Bond 6',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond7',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond7',
              displayName: 'Bond 7',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond8',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond8',
              displayName: 'Bond 8',
              value: 'Schweiz',
            },
          },
          {
            where: {
              groupActivityId_name: {
                groupActivityId: GROUP_ACTIVITY_ID,
                name: 'bond9',
              },
            },
            create: {
              type: 'STRING',
              name: 'bond9',
              displayName: 'Bond 9',
              value: 'Schweiz',
            },
          },
        ],
      },
      instances: {
        connectOrCreate: await Promise.all(
          [0].map(async (qId, ix) => {
            const question = await prisma.element.findUnique({
              where: { originalId: String(qId) },
            })

            return {
              where: {
                type_groupActivityId_order: {
                  type: 'GROUP_ACTIVITY',
                  groupActivityId: GROUP_ACTIVITY_ID,
                  order: ix,
                },
              },
              create: prepareQuestionInstance({
                question,
                type: 'GROUP_ACTIVITY',
                order: ix,
              }),
            }
          })
        ),
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
          // create stacks with one flashcard each
          ...flashcards.map((el, ix) => ({
            displayName: undefined,
            description: undefined,
            order: ix,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: [
                  {
                    order: ix,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: el.type,
                    elementData: processElementData(el),
                    options: {},
                    results: getInitialElementResults(el),
                    ownerId: el.ownerId,
                    elementId: el.id,
                  },
                ],
              },
            },
          })),
          // create one stack with all flashcards
          {
            displayName: undefined,
            description: undefined,
            order: flashcards.length,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: flashcards.map((el, ix) => ({
                  order: ix,
                  type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                  elementType: el.type,
                  elementData: processElementData(el),
                  options: {},
                  results: getInitialElementResults(el),
                  ownerId: el.ownerId,
                  elementId: el.id,
                })),
              },
            },
          },
          // create stacks with questions
          ...questionsTest.map((el, ix) => ({
            displayName: undefined,
            description: undefined,
            order: flashcards.length + ix + 1,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: [
                  {
                    order: ix,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: el.type,
                    elementData: processElementData(el),
                    options: {},
                    results: getInitialElementResults(el),
                    ownerId: el.ownerId,
                    elementId: el.id,
                  },
                ],
              },
            },
          })),
          // create one stack with all questions
          {
            displayName: undefined,
            description: undefined,
            order: flashcards.length + questionsTest.length + 1,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: questionsTest.map((el, ix) => ({
                  order: ix,
                  type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                  elementType: el.type,
                  elementData: processElementData(el),
                  options: {},
                  results: getInitialElementResults(el),
                  ownerId: el.ownerId,
                  elementId: el.id,
                })),
              },
            },
          },
          // create stacks with content elements
          ...contentElements.map((el, ix) => ({
            displayName: undefined,
            description: undefined,
            order: flashcards.length + questionsTest.length + ix + 2,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: [
                  {
                    order: ix,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: el.type,
                    elementData: processElementData(el),
                    options: {},
                    results: getInitialElementResults(el),
                    ownerId: el.ownerId,
                    elementId: el.id,
                  },
                ],
              },
            },
          })),
          // create two stacks with all content elements
          ...[0, 1].map((ix) => ({
            displayName: undefined,
            description: undefined,
            order:
              flashcards.length +
              questionsTest.length +
              contentElements.length +
              2 +
              ix,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: contentElements.map((el, ix) => ({
                  order: ix,
                  type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                  elementType: el.type,
                  elementData: processElementData(el),
                  options: {},
                  results: getInitialElementResults(el),
                  ownerId: el.ownerId,
                  elementId: el.id,
                })),
              },
            },
          })),
          // create two stacks with one of each kind of elements
          ...[0, 1].map((ix) => ({
            displayName: undefined,
            description: undefined,
            order:
              flashcards.length +
              questionsTest.length +
              contentElements.length +
              4 +
              ix,
            type: Prisma.ElementStackType.PRACTICE_QUIZ,
            options: {},
            elements: {
              createMany: {
                data: [
                  {
                    order: 0,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: flashcards[0].type,
                    elementData: processElementData(flashcards[0]),
                    options: {},
                    results: getInitialElementResults(flashcards[0]),
                    ownerId: flashcards[0].ownerId,
                    elementId: flashcards[0].id,
                  },
                  {
                    order: 1,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: questionsTest[0].type,
                    elementData: processElementData(questionsTest[0]),
                    options: {},
                    results: getInitialElementResults(questionsTest[0]),
                    ownerId: questionsTest[0].ownerId,
                    elementId: questionsTest[0].id,
                  },
                  {
                    order: 2,
                    type: Prisma.ElementInstanceType.PRACTICE_QUIZ,
                    elementType: contentElements[0].type,
                    elementData: processElementData(contentElements[0]),
                    options: {},
                    results: getInitialElementResults(contentElements[0]),
                    ownerId: contentElements[0].ownerId,
                    elementId: contentElements[0].id,
                  },
                ],
              },
            },
          })),
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

import Prisma, { Question } from '@klicker-uzh/prisma'
// const klickerUZHPrisma = require('@klicker-uzh/prisma')
// const Prisma = klickerUZHPrisma.Prisma
// const Question = klickerUZHPrisma.Question
import { COURSE_ID_TEST, USER_ID_TEST } from './constants.js'
import * as DATA_TEST from './data/TEST'
import {
  prepareCourse,
  prepareLearningElement,
  prepareMicroSession,
  prepareParticipant,
  prepareQuestion,
  prepareQuestionInstance,
  prepareSession,
  prepareUser,
} from './helpers.js'
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
]

async function seedTest(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  await seedLevels(prisma)

  const userTest = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_TEST,
      email: 'lecturer@bf.uzh.ch',
      shortname: 'lecturer',
      password: process.env.INITIAL_PASSWORD as string,
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
      prisma.question.upsert(
        prepareQuestion({ ownerId: USER_ID_TEST, ...data })
      )
    )
  )) as Question[]

  const questionCount = await prisma.question.findFirst({
    orderBy: { id: 'desc' },
  })

  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questionCount.id + 1}`
  )

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
                  return questionsTest.find((q) => q.id === element) as Question
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
              .filter((q) => block.questions.includes(q.id))
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
            .filter((q) => data.questions.includes(q.id))
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
        ],
      },
      instances: {
        connectOrCreate: await Promise.all(
          [0].map(async (qId, ix) => {
            const question = await prisma.question.findUnique({
              where: { id: qId },
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

  const participantsNoCourse = await Promise.all(
    [
      '908f84d0-fd32-4a99-8a9f-b4793288234d',
      'ec8385db-e951-47dc-9e86-e215b7e4c501',
    ].map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id,
          password: 'abcd',
          username: `testuser${ix + 11}`,
          courseIds: [],
        })
      )
    })
  )

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

  const awardedPilotAchievements = PARTICIPANT_IDS.map(
    async (participantId) => {
      await prisma.participantAchievementInstance.upsert({
        where: {
          participantId_achievementId: {
            participantId: participantId,
            achievementId: pilotAchievement.id,
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
              id: pilotAchievement.id,
            },
          },
          achievedAt: new Date(),
          achievedCount: 1,
        },
        update: {},
      })
    }
  )

  const awardedAchievements = [
    solvedEverythingAchievement,
    groupTaskPassedAchievement,
    groupTaskDoneAchievement,
    fewQuestionsAchievement,
  ].map(async (achievement) => {
    await prisma.participantAchievementInstance.upsert({
      where: {
        participantId_achievementId: {
          participantId: PARTICIPANT_IDS[0],
          achievementId: achievement.id,
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
            id: achievement.id,
          },
        },
        achievedAt: new Date(),
        achievedCount: 1,
      },
      update: {},
    })
  })
}

const prismaClient = new Prisma.PrismaClient()

seedTest(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

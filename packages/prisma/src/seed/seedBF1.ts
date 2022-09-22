import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import * as DATA_BF1 from './data/BF1.js'

import {
  prepareCourse,
  prepareLearningElement,
  prepareMicroSession,
  prepareQuestion,
  prepareSession,
  prepareUser,
} from './helpers.js'

// const PARTICIPANT_IDS = [
//   '6f45065c-667f-4259-818c-c6f6b477eb48',
//   '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
//   '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
//   '16c39a69-03b4-4ce4-a695-e7b93d535598',
//   'c48f624e-7de9-4e1b-a16d-82d22e64828f',
//   '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
//   'f53e6a95-689b-48c0-bfab-6625c04f39ed',
//   '46407010-0e7c-4903-9a66-2c8d9d6909b0',
//   '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
//   '05a933a0-b2bc-4551-b7e1-6975140d996d',
// ]

async function seedBF1(prisma: Prisma.PrismaClient) {
  const userBF1 = await prisma.user.upsert(
    await prepareUser({
      id: 'b7e21ad0-dcf6-4277-9b06-a3eb1d03147c',
      email: 'julia.gut@bf.uzh.ch',
      shortname: 'bf1hs22',
      password: process.env.INITIAL_PASSWORD as string,
    })
  )

  const courseBF1 = await prisma.course.upsert(
    prepareCourse({
      id: '2b302436-4fc3-4d5d-bbfb-1e13b4ee11b2',
      name: 'Banking and Finance I',
      displayName: 'Banking and Finance I',
      ownerId: userBF1.id,
      color: '#016272',
    })
  )

  // const participantsTesting = await Promise.all(
  //   PARTICIPANT_IDS.map(async (id, ix) => {
  //     return prisma.participant.upsert(
  //       await prepareParticipant({
  //         id: PARTICIPANT_IDS[ix],
  //         password: 'testing',
  //         username: `testuser${ix + 1}`,
  //         courseIds: ['2b302436-4fc3-4d5d-bbfb-1e13b4ee11b2'],
  //       })
  //     )
  //   })
  // )

  const questionsBF1 = await Promise.all(
    DATA_BF1.QUESTIONS.map((data) =>
      prisma.question.upsert(prepareQuestion({ ownerId: userBF1.id, ...data }))
    )
  )

  const questionCount = await prisma.question.count()
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questionCount + 1}`
  )

  const learningElementsBF1 = await Promise.all(
    DATA_BF1.LEARNING_ELEMENTS.map((data) =>
      prisma.learningElement.upsert(
        prepareLearningElement({
          ...data,
          ownerId: userBF1.id,
          courseId: courseBF1.id,
          questions: questionsBF1.filter((q) => data.questions.includes(q.id)),
        })
      )
    )
  )

  const sessionsBF1 = await Promise.all(
    DATA_BF1.SESSIONS.map((data) =>
      prisma.session.upsert(
        prepareSession({
          ...data,
          linkTo: 'https://app.klicker.uzh.ch/join/bf1hs22',
          blocks: data.blocks.map((block) => ({
            ...block,
            questions: questionsBF1.filter((q) =>
              block.questions.includes(q.id)
            ),
          })),
          ownerId: userBF1.id,
          courseId: courseBF1.id,
        })
      )
    )
  )

  const microSessionsBF1 = await Promise.all(
    DATA_BF1.MICRO_SESSIONS.map((data) =>
      prisma.microSession.upsert(
        prepareMicroSession({
          ...data,
          ownerId: userBF1.id,
          courseId: courseBF1.id,
          questions: questionsBF1.filter((q) => data.questions.includes(q.id)),
        })
      )
    )
  )
}

const prismaClient = new Prisma.PrismaClient()

seedBF1(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

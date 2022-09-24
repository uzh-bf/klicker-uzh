import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import { COURSE_ID_AMI, USER_ID_AMI } from './constants.js'
import * as DATA_AMI from './data/AMI.js'
import {
  prepareCourse,
  prepareLearningElement,
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

async function seedAMI(prisma: Prisma.PrismaClient) {
  /* ----- Asset Management: Investments ----- */
  const userAMI = await prisma.user.upsert(
    await prepareUser({
      id: USER_ID_AMI,
      email: 'benjamin.wilding@bf.uzh.ch',
      shortname: 'beni',
      password: process.env.INITIAL_PASSWORD as string,
    })
  )

  const courseAMI = await prisma.course.upsert(
    prepareCourse({
      id: COURSE_ID_AMI,
      name: 'Asset Management: Investments',
      displayName: 'Asset Management: Investments',
      ownerId: USER_ID_AMI,
      color: '#FE7408',
    })
  )

  const questionsAMI = await Promise.all(
    DATA_AMI.QUESTIONS.map((data) =>
      prisma.question.upsert(prepareQuestion({ ownerId: userAMI.id, ...data }))
    )
  )

  const learningElementsAMI = await Promise.all(
    DATA_AMI.LEARNING_ELEMENTS.map((data) =>
      prisma.learningElement.upsert(
        prepareLearningElement({
          ...data,
          ownerId: USER_ID_AMI,
          courseId: COURSE_ID_AMI,
          questions: questionsAMI.filter((q) => data.questions.includes(q.id)),
        })
      )
    )
  )

  const sessionsBF1 = await Promise.all(
    DATA_AMI.SESSIONS.map((data) =>
      prisma.session.upsert(
        prepareSession({
          ...data,
          blocks: data.blocks.map((block, ix) => ({
            ...block,
            order: ix,
            questions: questionsAMI.filter((q) =>
              block.questions.includes(q.id)
            ),
          })),
          ownerId: USER_ID_AMI,
          courseId: COURSE_ID_AMI,
        })
      )
    )
  )

  // const participantsTesting = await Promise.all(
  //   PARTICIPANT_IDS.map(async (id, ix) => {
  //     return prisma.participant.upsert(
  //       await prepareParticipant({
  //         id: PARTICIPANT_IDS[ix],
  //         password: 'testing',
  //         username: `testuser${ix + 1}`,
  //         courseIds: [courseAMI.id],
  //       })
  //     )
  //   })
  // )

  const questionCount = await prisma.question.count()
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questionCount + 1}`
  )
}

const prismaClient = new Prisma.PrismaClient()

seedAMI(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

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

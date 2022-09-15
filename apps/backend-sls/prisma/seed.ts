import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import * as DATA_TEST from './constants.js'
import * as DATA_BF1 from './dataBF1.js'

import {
  prepareAttachment,
  prepareCourse,
  prepareLearningElement,
  prepareMicroSession,
  prepareParticipant,
  prepareQuestion,
  prepareSession,
  prepareUser,
} from './helpers.js'

async function main(prisma: Prisma.PrismaClient) {
  const userTesting = await prisma.user.upsert(
    await prepareUser({
      id: '6f45065c-447f-4259-818c-c6f6b477eb48',
      email: 'roland.schlaefli@bf.uzh.ch',
      shortname: 'rschlaefli',
      password: 'testing',
    })
  )

  const courseTesting = await prisma.course.upsert(
    prepareCourse({
      id: '064ef09b-07b9-4bfd-b657-5c77d7123e93',
      name: 'Test Course 1',
      displayName: 'Test Course 1',
      ownerId: userTesting.id,
    })
  )

  const participantsTesting = await Promise.all(
    DATA_TEST.PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id: DATA_TEST.PARTICIPANT_IDS[ix],
          password: 'testing',
          username: `testuser${ix + 1}`,
          courseId: courseTesting.id,
        })
      )
    })
  )

  const attachmentsTesting = await Promise.all(
    DATA_TEST.ATTACHMENTS.map((data) =>
      prisma.attachment.upsert(
        prepareAttachment({ ownerId: userTesting.id, ...data })
      )
    )
  )

  const questionsTesting = await Promise.all(
    DATA_TEST.QUESTIONS.map((data) =>
      prisma.question.upsert(
        prepareQuestion({ ownerId: userTesting.id, ...data })
      )
    )
  )

  const learningElementsTesting = await Promise.all(
    DATA_TEST.LEARNING_ELEMENTS.map((data) =>
      prisma.learningElement.upsert(
        prepareLearningElement({
          ...data,
          ownerId: userTesting.id,
          courseId: courseTesting.id,
          questions: questionsTesting.filter((q) =>
            data.questions.includes(q.id)
          ),
        })
      )
    )
  )

  const sessionsTesting = await Promise.all(
    DATA_TEST.SESSIONS.map((data) =>
      prisma.session.upsert(
        prepareSession({
          ...data,
          blocks: data.blocks.map((block) => ({
            ...block,
            questions: questionsTesting.filter((q) =>
              block.questions.includes(q.id)
            ),
          })),
          ownerId: userTesting.id,
          courseId: courseTesting.id,
        })
      )
    )
  )

  const microSessionsTesting = await Promise.all(
    DATA_TEST.MICRO_SESSIONS.map((data) =>
      prepareMicroSession({
        ...data,
        ownerId: userTesting.id,
        courseId: courseTesting.id,
        questions: questionsTesting.filter((q) =>
          data.questions.includes(q.id)
        ),
      })
    )
  )

  /* ----- Banking and Finance 1 ----- */
  const userBF1 = await prisma.user.upsert(
    await prepareUser({
      id: 'b7e21ad0-dcf6-4277-9b06-a3eb1d03147c',
      email: 'julia.gut@bf.uzh.ch',
      shortname: 'bf1hs22',
      password: 'testing',
    })
  )

  const courseBF1 = await prisma.course.upsert(
    prepareCourse({
      id: '2b302436-4fc3-4d5d-bbfb-1e13b4ee11b2',
      name: 'Banking und Finance 1',
      displayName: 'Banking und Finance 1',
      ownerId: userBF1.id,
    })
  )

  const questionsBF1 = await Promise.all(
    DATA_BF1.QUESTIONS.map((data) =>
      prisma.question.upsert(prepareQuestion({ ownerId: userBF1.id, ...data }))
    )
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
      prepareMicroSession({
        ...data,
        ownerId: userBF1.id,
        courseId: courseBF1.id,
        questions: questionsBF1.filter((q) => data.questions.includes(q.id)),
      })
    )
  )

  /* ----- Asset Management: Investments ----- */
  const userAMI = await prisma.user.upsert(
    await prepareUser({
      id: '163e4f34-52a4-4e47-866f-79a8aec2feac',
      email: 'benjamin.wilding@bf.uzh.ch',
      shortname: 'beni',
      password: 'testing',
    })
  )

  const courseAMI = await prisma.course.upsert(
    prepareCourse({
      id: '2f208c63-cb02-4b46-9462-7ce735a42235',
      name: 'Asset Management: Investments',
      displayName: 'Asset Management: Investments',
      ownerId: userAMI.id,
    })
  )

  /* ----- CONSOLIDATION ----- */
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${
      questionsTesting.length + 1
    }`
  )
}

const prismaClient = new Prisma.PrismaClient()

main(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

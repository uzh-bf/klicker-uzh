import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'
import * as DATA_TEST from './data/TEST.js'

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

async function seedTest(prisma: Prisma.PrismaClient) {
  const PARTICIPANT_IDS = [
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
    PARTICIPANT_IDS.map(async (id, ix) => {
      return prisma.participant.upsert(
        await prepareParticipant({
          id: PARTICIPANT_IDS[ix],
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

  const questionCount = await prisma.question.count()
  await prisma.$executeRawUnsafe(
    `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questionCount + 1}`
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
      prisma.microSession.upsert(
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
  )
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

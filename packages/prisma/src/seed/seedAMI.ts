import 'dotenv/config'

import Prisma from '@klicker-uzh/prisma'

import { prepareCourse, prepareUser } from './helpers.js'

async function seedAMI(prisma: Prisma.PrismaClient) {
  /* ----- Asset Management: Investments ----- */
  const userAMI = await prisma.user.upsert(
    await prepareUser({
      id: '163e4f34-52a4-4e47-866f-79a8aec2feac',
      email: 'benjamin.wilding@bf.uzh.ch',
      shortname: 'beni',
      password: process.env.INITIAL_PASSWORD as string,
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

  // const questionsAMI = await Promise.all(
  //   DATA_AMI.QUESTIONS.map((data) =>
  //     prisma.question.upsert(prepareQuestion({ ownerId: userAMI.id, ...data }))
  //   )
  // )

  // const questionCount = await prisma.question.count()
  // await prisma.$executeRawUnsafe(
  //   `ALTER SEQUENCE "Question_id_seq" RESTART WITH ${questionCount + 1}`
  // )
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

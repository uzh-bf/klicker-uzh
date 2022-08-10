import { PrismaClient } from '@prisma/client'

async function main(prisma: PrismaClient) {
  const user = await prisma.user.upsert({
    create: {
      email: 'roland.schlaefli@bf.uzh.ch',
      password: 'abcd',
      shortname: 'rschlaefli',
      salt: 'abcd',
    },
    update: {},
    where: {
      email: 'roland.schlaefli@bf.uzh.ch',
    },
  })

  const course = await prisma.course.create({
    data: {
      name: 'Test Course',
      displayName: 'Test Course',
      ownerId: user.id,
    },
  })

  const question = await prisma.question.create({
    data: {
      name: 'test',
      content: 'hallo',
      contentPlain: 'hallo',
      type: 'SC',
      options: {
        choices: [
          {
            feedback: 'nope',
            correct: false,
            value: 'A',
          },
          {
            feedback: 'no!',
            correct: false,
            value: 'B',
          },
          {
            feedback: 'yes!',
            correct: true,
            value: 'C',
          },
        ],
      },
      ownerId: user.id,
    },
  })

  const instance = await prisma.questionInstance.create({
    data: {
      questionData: question,
      results: {},
      questionId: question.id,
      ownerId: user.id,
    },
  })

  const learningElement = await prisma.learningElement.create({
    data: {
      courseId: course.id,
      ownerId: user.id,
      instances: {
        connect: [
          {
            id: instance.id,
          },
        ],
      },
    },
  })

  console.log(learningElement)
}

const prismaClient = new PrismaClient()

main(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

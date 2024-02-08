import Prisma, { PublicationStatus } from '../../dist'
import { COURSE_ID_AMI_HS23, USER_ID_AMI_HS23 } from './constants'
// import * as R from 'ramda'
// import { prepareQuestionInstance } from './helpers.js'

const OWNER_ID = USER_ID_AMI_HS23
const COURSE_ID = COURSE_ID_AMI_HS23

async function seed(prisma: Prisma.PrismaClient) {
  if (process.env.ENV !== 'development') process.exit(1)

  const questions = await prisma.element.findMany({
    orderBy: { id: 'desc' },
    where: {
      ownerId: OWNER_ID,
    },
  })

  const uniqueQuestionIds = new Set<number>()

  // get all practice quizzes and microlearnings of the course
  const learningElements = await prisma.learningElement.findMany({
    where: {
      courseId: COURSE_ID,
      status: PublicationStatus.PUBLISHED,
    },
    include: {
      stacks: {
        include: {
          elements: {
            include: {
              questionInstance: true,
            },
          },
        },
      },
    },
  })

  const microSessions = await prisma.microSession.findMany({
    where: {
      courseId: COURSE_ID,
      status: PublicationStatus.PUBLISHED,
    },
    include: {
      instances: true,
    },
  })

  // go through practice quizzes and microlearnings and add all used questions to the repetition pool
  learningElements.forEach((learningElement) => {
    learningElement.stacks.forEach((stack) => {
      stack.elements.forEach((element) => {
        if (
          element.questionInstance !== null &&
          element.questionInstance.questionId !== null
        ) {
          uniqueQuestionIds.add(element.questionInstance.questionId)
        }
      })
    })
  })

  microSessions.forEach((microSession) => {
    microSession.instances.forEach((instance) => {
      if (instance.questionId !== null) {
        uniqueQuestionIds.add(instance.questionId)
      }
    })
  })

  console.log(uniqueQuestionIds)
}

const prismaClient = new Prisma.PrismaClient()

await seed(prismaClient)
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prismaClient.$disconnect()
  })

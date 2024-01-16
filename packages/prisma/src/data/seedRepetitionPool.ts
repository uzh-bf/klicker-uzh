import Prisma, { Element, OrderType, PublicationStatus } from '../../dist'
import { COURSE_ID_AMI_HS23, USER_ID_AMI_HS23 } from './constants'
import { prepareLearningElement } from './helpers'
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

  // get all learning elements and micro sessions of the course
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

  // go through learning elements and micro sessions and add all used questions to the repetition pool
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

  // create a new learning element based on the set of unique question ids
  await prisma.learningElement.upsert(
    await prepareLearningElement({
      id: 'c8866eb2-a41c-4029-b386-30d57941f00c',
      name: 'AMI Repetition',
      displayName: 'AMI Repetition',
      description: '',
      status: PublicationStatus.DRAFT,
      orderType: OrderType.LAST_RESPONSE,
      ownerId: OWNER_ID,
      courseId: COURSE_ID,
      pointsMultiplier: 2,
      stacks: [...uniqueQuestionIds].map((questionId) => {
        return {
          elements: [questions.find((q) => q.id === questionId) as Element],
        }
      }),
    })
  )
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

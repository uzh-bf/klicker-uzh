import { ElementOrderType } from 'dist'
import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const learningElements = await prisma.learningElement.findMany({
    include: {
      stacks: {
        include: {
          elements: {
            include: {
              questionInstance: {
                include: {
                  question: {},
                },
              },
            },
          },
        },
      },
    },
  })

  let counter = 1

  for (const elem of learningElements) {
    console.log(counter, elem.id, elem)

    // create a new practice quiz
    await prisma.practiceQuiz.upsert({
      where: {
        id: elem.id,
      },
      create: {
        id: elem.id,
        name: elem.name,
        displayName: elem.displayName,
        description: elem.description,
        status: elem.status,
        orderType:
          ((elem.orderType === 'LAST_RESPONSE' ||
            elem.orderType === 'SHUFFLED') &&
            ElementOrderType.SPACED_REPETITION) ||
          ElementOrderType.SEQUENTIAL,
        pointsMultiplier: elem.pointsMultiplier,
        resetTimeDays: elem.resetTimeDays,
        createdAt: elem.createdAt,
        updatedAt: elem.updatedAt,
        course: {
          connect: {
            id: elem.courseId as string,
          },
        },
        owner: {
          connect: {
            id: elem.ownerId as string,
          },
        },
      },
      update: {},
    })

    counter++
  }

  console.log(counter)
}

await migrate()

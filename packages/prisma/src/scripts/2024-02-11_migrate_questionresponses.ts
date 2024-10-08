import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  await prisma.questionResponse.deleteMany({
    where: {
      questionInstanceId: 3745,
    },
  })

  await prisma.questionResponseDetail.deleteMany({
    where: {
      questionInstanceId: 3745,
    },
  })

  const questionInstances = await prisma.questionInstance.findMany({
    where: {
      type: 'LEARNING_ELEMENT',
    },
    include: {
      stackElement: {
        include: {
          stack: {
            include: {
              learningElement: {
                include: {
                  course: true,
                },
              },
            },
          },
        },
      },
    },
  })

  console.log('questionInstances', questionInstances.length)

  let counter = 0
  let counter2 = 0
  let counter3 = 0

  for (const elem of questionInstances) {
    const matchingElementInstance = await prisma.elementInstance.findFirst({
      where: {
        migrationId: String(elem.id),
      },
    })

    if (!matchingElementInstance) {
      console.log(
        `${elem.id};${matchingElementInstance?.id};${elem.questionData.name};${matchingElementInstance?.elementData.name}`
      )
      counter2++
      continue
    }

    if (elem.questionData.name !== matchingElementInstance.elementData.name) {
      console.log(
        `${elem.id};${matchingElementInstance?.id};${elem.questionData.name};${matchingElementInstance?.elementData.name};${elem.stackElement?.stack.learningElement?.course?.name}`
      )
      counter3++
      continue
    }

    try {
      await prisma.questionResponse.updateMany({
        where: { questionInstanceId: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })

      await prisma.questionResponseDetail.updateMany({
        where: { questionInstanceId: elem.id },
        data: {
          elementInstanceId: matchingElementInstance?.id,
        },
      })
    } catch (e) {
      console.log('Error', e, elem.id, matchingElementInstance?.id)
      throw e
    }

    counter++
  }

  console.log(counter, counter2, counter3)
}

await migrate()

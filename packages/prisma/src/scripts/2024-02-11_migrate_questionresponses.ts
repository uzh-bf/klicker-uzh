import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const questionInstances = await prisma.questionInstance.findMany({
    where: {
      type: 'LEARNING_ELEMENT',
    },
  })

  console.log('questionInstances', questionInstances.length)

  let counter = 1
  let counter2 = 1

  for (const elem of questionInstances) {
    const matchingElementInstance = await prisma.elementInstance.findFirst({
      where: {
        migrationId: String(elem.id),
      },
    })

    if (
      !matchingElementInstance ||
      elem.questionData.name !== matchingElementInstance.elementData.name
    ) {
      console.log(
        `${elem.id};${matchingElementInstance?.id};${elem.questionData.name};${matchingElementInstance?.elementData.name}`
      )
      counter2++
      continue
    }

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

    counter++
  }

  console.log(counter, counter2)
}

await migrate()

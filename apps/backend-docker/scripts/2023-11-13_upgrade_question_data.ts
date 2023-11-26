import type { PrismaMigrationClient } from '@klicker-uzh/graphql/src/types/app.js'

export default async function execute(prisma: PrismaMigrationClient) {
  let counter = 1

  const questionInstances = await prisma.questionInstance.findMany({
    where: {
      questionData: {
        questionId: {
          not: null,
        },
      },
    },
  })
  for (const elem of questionInstances) {
    console.log(counter, elem.id)
    await prisma.questionInstance.update({
      where: {
        id: elem.id,
      },
      data: {
        questionData: {
          ...elem.questionData,
          id:
            typeof elem.questionData.id === 'number'
              ? `${elem.questionData.id}-v1`
              : elem.questionData.id,
          questionId:
            typeof elem.questionData.id === 'number'
              ? elem.questionData.id
              : elem.questionData.questionId,
        },
      },
    })
    counter++
  }

  const elementInstances = await prisma.elementInstance.findMany({
    where: {
      questionData: {
        questionId: {
          not: null,
        },
      },
    },
  })

  for (const elem of elementInstances) {
    console.log(counter, elem.id)
    await prisma.elementInstance.update({
      where: {
        id: elem.id,
      },
      data: {
        elementData: {
          ...elem.elementData,
          id:
            typeof elem.elementData.id === 'number'
              ? `${elem.elementData.id}-v1`
              : elem.elementData.id,
          questionId:
            typeof elem.elementData.id === 'number'
              ? elem.elementData.id
              : elem.elementData.questionId,
        },
      },
    })
    counter++
  }
}

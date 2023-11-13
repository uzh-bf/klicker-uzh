import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const instances = await prisma.questionInstance.findMany({})

  let counter = 1
  for (const elem of instances) {
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
          questionId: elem.questionData.id,
        },
      },
    })
    await prisma.elementInstance.update({
      where: {
        id: elem.id,
      },
      data: {
        elementData: {
          ...elem.questionData,
          id:
            typeof elem.questionData.id === 'number'
              ? `${elem.questionData.id}-v1`
              : elem.questionData.id,
          questionId: elem.questionData.id,
        },
      },
    })
    counter++
  }
}

migrate()

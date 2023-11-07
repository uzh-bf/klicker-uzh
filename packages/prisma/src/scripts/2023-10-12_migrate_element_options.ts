import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const elements = await prisma.element.findMany({})

  // await prisma.$transaction(

  let counter = 1
  for (const elem of elements) {
    console.log(counter, elem.id)
    await prisma.element.update({
      where: {
        id: elem.id,
      },
      data: {
        options: {
          ...elem.options,
          displayMode: elem.options?.displayMode ?? elem.displayMode,
          hasSampleSolution:
            elem.options?.hasSampleSolution ?? elem.hasSampleSolution,
          hasAnswerFeedbacks:
            elem.options?.hasAnswerFeedbacks ?? elem.hasAnswerFeedbacks,
        },
      },
    })
    counter++
  }
}

migrate()

import { prisma } from '@klicker-uzh/prisma'

async function migrate() {
  const elements = await prisma.element.findMany({})

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

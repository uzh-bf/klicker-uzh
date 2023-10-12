import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const elements = await prisma.element.findMany({})

  await prisma.$transaction(
    elements.map((elem) =>
      prisma.element.update({
        where: {
          id: elem.id,
        },
        data: {
          options: {
            ...elem.options,
            displayMode: elem.displayMode,
            hasSampleSolution: elem.hasSampleSolution,
            hasAnswerFeedbacks: elem.hasAnswerFeedbacks,
          },
        },
      })
    )
  )
}

migrate()

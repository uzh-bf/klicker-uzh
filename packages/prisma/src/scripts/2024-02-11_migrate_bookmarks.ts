import { PrismaClient } from '../client'

async function migrate() {
  const prisma = new PrismaClient()

  const participationsWithBookmarks = await prisma.participation.findMany({
    include: {
      course: true,
      bookmarkedStacks: true,
      bookmarkedElementStacks: true,
    },
  })

  let counter = 1

  for (const elem of participationsWithBookmarks) {
    if (elem.bookmarkedStacks.length === 0) {
      continue
    }

    console.log(counter, elem.id, elem)

    await prisma.participation.update({
      where: { id: elem.id },
      data: {
        bookmarkedElementStacks: {
          connect: elem.bookmarkedStacks
            .filter((stack) => !!stack.learningElementId)
            .map((stack) => ({
              type_practiceQuizId_order: {
                type: 'PRACTICE_QUIZ',
                practiceQuizId: stack.learningElementId,
                order: stack.order,
              },
            })),
        },
      },
    })

    counter++
  }

  console.log(counter)
}

await migrate()

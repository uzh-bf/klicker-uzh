import { PrismaClient } from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  const stacks = await prisma.elementStack.findMany({
    where: {
      practiceQuizId: {
        not: null,
      },
    },
    include: {
      practiceQuiz: {
        include: {
          course: true,
        },
      },
    },
  })

  const stacksFiltered = stacks.filter(
    (stack) =>
      stack.courseId !== null && stack.courseId !== stack.practiceQuiz!.courseId
  )

  const courseNames = [
    ...new Set(stacksFiltered.map((stack) => stack.practiceQuiz!.course.name)),
  ]

  const stackCounts = stacksFiltered.reduce((counts, stack) => {
    const stackName = stack.practiceQuiz!.course.name
    counts[stackName] = (counts[stackName] || 0) + 1
    return counts
  }, {})

  const stackData = stacksFiltered.map((stack) => {
    return {
      stackId: stack.id,
      courseId: stack.courseId,
      correctCourseId: stack.practiceQuiz!.courseId,
      correctCourseName: stack.practiceQuiz!.course.name,
    }
  })

  console.log(stackData)
  console.log(stackCounts)
  console.log(courseNames)

  // ! UDPATE
  const results = await Promise.allSettled(
    stackData.map((stack) =>
      prisma.elementStack.update({
        where: {
          id: stack.stackId,
        },
        data: {
          course: {
            connect: {
              id: stack.correctCourseId,
            },
          },
        },
      })
    )
  )

  const successfulResults = results.filter(
    (result) => result.status === 'fulfilled'
  )
  const failedResults = results.filter((result) => result.status === 'rejected')

  console.log('Successful updates:', successfulResults.length)
  console.log('Failed updates:', failedResults.length)
}

await run()

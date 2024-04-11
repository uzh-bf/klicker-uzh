import { PrismaClient } from '@klicker-uzh/prisma'

async function run() {
  const prisma = new PrismaClient()

  // fetch all element instances and their associated klicker elements
  const instances = await prisma.elementInstance.findMany({
    include: {
      element: true,
      elementStack: {
        include: {
          practiceQuiz: true,
          microLearning: true,
          liveQuiz: true,
        },
      },
    },
  })

  // initialize promises array and counters
  let updatePromises: any[] = []
  let practiceQuizInstanceUpdates = 0
  let microLearningInstanceUpdates = 0
  let liveQuizInstanceErrors = 0

  // iterate over all element instances and check if the correct options are specified
  instances.forEach((instance) => {
    const stack = instance.elementStack
    const element = instance.element
    if (!stack || !element) {
      return
    }

    if (stack.practiceQuiz) {
      const quiz = stack.practiceQuiz
      const options = instance.options

      // check if both the correct pointsMultiplier and correct resetTimeDays are specified
      if (
        !options ||
        !options.pointsMultiplier ||
        !options.resetTimeDays ||
        options.pointsMultiplier !==
          quiz.pointsMultiplier * element.pointsMultiplier ||
        options.resetTimeDays !== quiz.resetTimeDays
      ) {
        console.log(
          'Element instance (practice quiz) with missing or invalid options:',
          instance.id,
          'with pointsMultiplier:',
          options?.pointsMultiplier,
          'instead of correct value:',
          quiz.pointsMultiplier * element.pointsMultiplier,
          'and resetTimeDays:',
          options?.resetTimeDays,
          'instead of correct value:',
          quiz.resetTimeDays
        )

        // update the instance with the correct options
        updatePromises.push(
          prisma.elementInstance.update({
            where: {
              id: instance.id,
            },
            data: {
              options: {
                pointsMultiplier:
                  quiz.pointsMultiplier * element.pointsMultiplier,
                resetTimeDays: quiz.resetTimeDays,
              },
            },
          })
        )
        practiceQuizInstanceUpdates++
      }
    }

    if (stack.microLearning) {
      const microLearning = stack.microLearning

      // check if the correct pointsMultiplier is specified
      if (
        !instance.options ||
        !instance.options.pointsMultiplier ||
        instance.options.pointsMultiplier !==
          microLearning.pointsMultiplier * element.pointsMultiplier
      ) {
        console.log(
          'Element instance (microlearning) with missing or invalid options:',
          instance.id,
          'with pointsMultiplier:',
          instance.options?.pointsMultiplier,
          'instead of correct value:',
          microLearning.pointsMultiplier * element.pointsMultiplier
        )

        // update the instance with the correct options
        updatePromises.push(
          prisma.elementInstance.update({
            where: {
              id: instance.id,
            },
            data: {
              options: {
                pointsMultiplier:
                  microLearning.pointsMultiplier * element.pointsMultiplier,
              },
            },
          })
        )
        microLearningInstanceUpdates++
      }
    }

    if (stack.liveQuiz) {
      const liveQuiz = stack.liveQuiz
      console.error(
        'ERROR: Live quizzes should not contain element instances at this point'
      )
      liveQuizInstanceErrors++
    }
  })

  // log number of updates and errors
  console.log(
    'Instance updates (used in practice quizzes):',
    practiceQuizInstanceUpdates
  )
  console.log(
    'Instance updates (used in microlearnings):',
    microLearningInstanceUpdates
  )
  console.log('Instance errors (used in live quizzes):', liveQuizInstanceErrors)

  // ! USE THIS STATEMENT TO EXECUTE UPDATES
  //   await prisma.$transaction(updatePromises)
}

await run()

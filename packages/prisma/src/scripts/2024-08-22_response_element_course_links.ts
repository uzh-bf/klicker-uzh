import { PrismaClient } from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  // ! Link all question responses and details to the corresponding practice quiz / microlearning and course
  // fetch all instances
  let counter = 0
  let responseCounter = 0
  let detailResponseCounter = 0
  const instances = await prisma.elementInstance.findMany({
    include: {
      elementStack: {
        include: {
          practiceQuiz: true,
          microLearning: true,
        },
      },
    },
  })
  const numOfInstsances = instances.length

  for (const instance of instances) {
    counter = counter + 1
    console.log('Processing element instance', counter, '/', numOfInstsances)

    const responses = await prisma.questionResponse.findMany({
      where: {
        elementInstanceId: instance.id,
      },
    })
    const responseDetails = await prisma.questionResponseDetail.findMany({
      where: {
        elementInstanceId: instance.id,
      },
    })

    // link all question responses to the corresponding practice quiz / microlearning and course
    const responseUpdates = responses.map((response) => {
      if (
        !(
          instance.elementStack.practiceQuizId ||
          instance.elementStack.microLearningId
        ) ||
        !(
          instance.elementStack.practiceQuiz?.courseId ||
          instance.elementStack.microLearning?.courseId
        )
      ) {
        throw new Error(
          'No practice quiz / microlearning or course found for element stack!'
        )
      }

      return prisma.questionResponse.update({
        where: {
          id: response.id,
        },
        data: {
          courseId: instance.elementStack.practiceQuiz
            ? instance.elementStack.practiceQuiz.courseId
            : instance.elementStack.microLearning!.courseId,
          practiceQuizId: instance.elementStack.practiceQuizId,
          microLearningId: instance.elementStack.microLearningId,
        },
      })
    })

    const responseDetailUpdates = responseDetails.map((responseDetail) => {
      return prisma.questionResponseDetail.update({
        where: {
          id: responseDetail.id,
        },
        data: {
          practiceQuizId: instance.elementStack.practiceQuizId,
          microLearningId: instance.elementStack.microLearningId,
        },
      })
    })

    // ! USE THIS STATEMENT TO EXECUTE UPDATES
    await prisma.$transaction(responseUpdates)
    await prisma.$transaction(responseDetailUpdates)
    responseCounter += responses.length
    detailResponseCounter += responseDetails.length
  }

  console.log(`Updated ${responseCounter} question responses`)
  console.log(`Updated ${detailResponseCounter} question response details`)
}

await run()

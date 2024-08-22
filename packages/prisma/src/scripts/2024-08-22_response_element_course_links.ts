import { PrismaClient } from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  // ! PART 1 - update courseId on all elementStacks
  const elementStacks = await prisma.elementStack.findMany({
    where: { courseId: null },
    include: {
      practiceQuiz: true,
      microLearning: true,
      groupActivity: true,
    },
  })

  const stackUpdates = elementStacks.map((elementStack) => {
    if (
      !(
        (elementStack.practiceQuizId && elementStack.practiceQuiz?.courseId) ||
        (elementStack.microLearningId &&
          elementStack.microLearning?.courseId) ||
        (elementStack.groupActivityId && elementStack.groupActivity?.courseId)
      )
    ) {
      console.log(elementStack)
      throw new Error('No course found for element linked to stack!')
    }

    // update the courseId on the elementStack
    return prisma.elementStack.update({
      where: {
        id: elementStack.id,
      },
      data: {
        courseId: elementStack.practiceQuizId
          ? elementStack.practiceQuiz!.courseId
          : elementStack.microLearningId
          ? elementStack.microLearning!.courseId
          : elementStack.groupActivity!.courseId,
      },
    })
  })

  // run transaction to update all elementStacks
  await prisma.$transaction(stackUpdates)
  console.log(
    `Updated ${elementStacks.length} elementStacks with corresponding course ID`
  )

  // ! PART 2 - link all question responses and details to the corresponding practice quiz / microlearning and course
  // fetch all instances
  let counter = 0
  let responseCounter = 0
  let detailResponseCounter = 0
  const instances = await prisma.elementInstance.findMany({
    include: {
      elementStack: true,
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
        !instance.elementStack.courseId
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
          courseId: instance.elementStack.courseId,
          practiceQuizId: instance.elementStack.practiceQuizId,
          microLearningId: instance.elementStack.microLearningId,
        },
      })
    })

    const responseDetailUpdates = responseDetails.map((responseDetail) => {
      if (
        !(
          instance.elementStack.practiceQuizId ||
          instance.elementStack.microLearningId
        ) ||
        !instance.elementStack.courseId
      ) {
        throw new Error(
          'No practice quiz / microlearning or course found for element stack!'
        )
      }

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

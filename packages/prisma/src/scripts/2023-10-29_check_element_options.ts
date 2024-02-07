import { PrismaClient } from '../client'

async function run() {
  const prisma = new PrismaClient()

  const elements = await prisma.element.findMany({})

  let counter = 1
  for (const elem of elements) {
    if (
      (elem.type === 'SC' || elem.type === 'MC' || elem.type === 'KPRIM') &&
      typeof elem.options.displayMode === 'undefined'
    ) {
      console.warn('display mode in options not defined')
    }

    if (typeof elem.options.hasSampleSolution === 'undefined') {
      console.warn('no hasSampleSolution')
    }

    if (typeof elem.options.hasAnswerFeedbacks === 'undefined') {
      console.warn('no hasAnswerFeedbacks')
    }

    counter++
  }

  console.log(`processed ${counter} items`)

  const questionInstances = await prisma.questionInstance.findMany({})

  let counter2 = 1
  let counter3 = 0
  for (const elem of questionInstances) {
    if (
      (elem.questionData.type === 'SC' ||
        elem.questionData.type === 'MC' ||
        elem.questionData.type === 'KPRIM') &&
      typeof elem.questionData.options?.displayMode === 'undefined'
    ) {
      console.warn('display mode in options not defined')
    }

    if (typeof elem.questionData.options?.hasSampleSolution === 'undefined') {
      console.warn('no hasSampleSolution')
    }

    if (typeof elem.questionData.options?.hasAnswerFeedbacks === 'undefined') {
      console.warn('no hasAnswerFeedbacks')
      counter3++
    }

    counter2++
  }

  console.log(`processed ${counter2} items, failed for ${counter3}`)
}

await run()

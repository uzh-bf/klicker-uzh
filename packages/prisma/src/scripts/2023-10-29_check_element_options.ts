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
}

await run()

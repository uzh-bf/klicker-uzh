import {
  gradeQuestionFreeText,
  gradeQuestionNumerical,
} from '@klicker-uzh/grading'
import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import { error } from 'console'
import md5 from 'md5'
import { FreeTextQuestionOptions, NumericalQuestionOptions } from 'src/ops'
import { AllElementTypeData, QuestionResultsOpen } from 'src/types/app'

async function run() {
  const prisma = new PrismaClient()

  // fetch all element instances, which have NR or FT type
  const instances = await prisma.elementInstance.findMany({
    include: {
      element: true,
    },
    where: {
      OR: [
        { elementType: ElementType.NUMERICAL },
        { elementType: ElementType.FREE_TEXT },
      ],
    },
  })

  // intialize promises array and counters
  let updatePromises: any[] = []
  let numericalResults = 0
  let freeTextResults = 0
  let totalUpdates = 0

  for (const instance of instances) {
    const responses = instance.results.responses

    // check if the results follow the old logic with value: count instead of hash: {value, count, correct}
    const isOldLogic =
      Object.keys(responses).length === 0 ||
      Object.values(responses).every((result) => typeof result === 'number')

    if (isOldLogic) {
      totalUpdates++
      console.log(`Instance ${instance.id} (FT / NR follows the old logic)`)
    } else {
      continue
    }

    if (instance.elementType === ElementType.NUMERICAL) {
      const updatedResponses = convertNumericalResponses(
        instance.elementData,
        responses
      )
      //   console.log('OLD RESPONSES:', responses)
      //   console.log('NEW RESPONSES:', updatedResponses)
      console.log(`Updating results for instance ${instance.id}`)
      numericalResults++

      // TODO: uncomment this part for execution
      //   updatePromises.push(
      //     prisma.elementInstance.update({
      //       where: { id: instance.id },
      //       data: {
      //         results: {
      //           set: updatedResponses,
      //         },
      //       },
      //     })
      //   )
    } else if (instance.elementType === ElementType.FREE_TEXT) {
      const updatedResponses = convertFreeTextResponses(
        instance.elementData,
        responses
      )
      //   console.log('OLD RESPONSES:', responses)
      //   console.log('NEW RESPONSES:', updatedResponses)
      console.log(`Updating results for instance ${instance.id}`)
      freeTextResults++

      // TODO: uncomment this part for execution
      //   updatePromises.push(
      //     prisma.elementInstance.update({
      //       where: { id: instance.id },
      //       data: {
      //         results: {
      //           set: updatedResponses,
      //         },
      //       },
      //     })
      //   )
    } else {
      error(`Unknown element type for this script: ${instance.elementType}`)
    }
  }

  // logging
  console.log(
    `Total considered instances with open questions: ${instances.length}`
  )
  console.log(`Total updates: ${totalUpdates}`)
  console.log(`Numerical updates: ${numericalResults}`)
  console.log(`Free text updates: ${freeTextResults}`)

  // ! USE THIS STATEMENT TO EXECUTE UPDATES
  //   await prisma.$transaction(updatePromises)
}

function convertNumericalResponses(
  elementData: AllElementTypeData,
  responses: Record<string, number>
): QuestionResultsOpen {
  let newResults: QuestionResultsOpen = { total: 0, responses: {} }

  // loop over responses and convert them to the new format
  for (const [value, count] of Object.entries(responses)) {
    const solutionRanges = (elementData.options as NumericalQuestionOptions)
      .solutionRanges
    const correct = gradeQuestionNumerical({
      response: parseFloat(value),
      solutionRanges: solutionRanges ?? [],
    })
    const hashValue = md5(value)

    newResults.responses[hashValue] = {
      value: value,
      count: count,
      correct: correct === 1,
    }
    newResults.total += count
  }

  return newResults
}

function convertFreeTextResponses(
  elementData: AllElementTypeData,
  responses: Record<string, number>
): QuestionResultsOpen {
  let newResults: QuestionResultsOpen = { total: 0, responses: {} }

  // loop over responses and convert them to the new format
  for (const [value, count] of Object.entries(responses)) {
    const solutions = (elementData.options as FreeTextQuestionOptions).solutions
    const correct = gradeQuestionFreeText({
      response: value,
      solutions: solutions ?? [],
    })
    const hashValue = md5(value)

    newResults.responses[hashValue] = {
      value: value,
      count: count,
      correct: correct === 1,
    }
    newResults.total += count
  }

  return newResults
}

await run()

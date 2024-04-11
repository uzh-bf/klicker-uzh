import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import { FlashcardCorrectness, QuestionResponseFlashcard } from 'src/types/app'

async function run() {
  const prisma = new PrismaClient()

  // fetch all questionResponses and the linked element; filter for flashcards only
  const questionResponses = await prisma.questionResponse.findMany({
    include: {
      elementInstance: {
        include: {
          element: true,
        },
      },
    },
    where: {
      elementInstance: {
        element: {
          type: ElementType.FLASHCARD,
        },
      },
    },
  })

  // intialize promises array and counters
  let updatePromises: any[] = []
  let valueErrors = 0
  let responseValueUpdates = 0
  let aggregatedResponseValueUpdates = 0

  // iterate over all questionResponseDetails and check if the correctness uses the correct enum representation
  questionResponses.forEach((questionResponse) => {
    const element = questionResponse.elementInstance?.element
    if (!element) {
      console.error(
        'Element not found for question response:',
        questionResponse.id
      )
      valueErrors++
      return
    }

    // response should only have a single key with correctness value
    if (
      Object.keys(questionResponse.response).length !== 1 ||
      Object.keys(questionResponse.response)[0] !== 'correctness'
    ) {
      console.error(
        'Flashcard question response detail with invalid response:',
        questionResponse.response,
        'and id:',
        questionResponse.id
      )
      valueErrors++
      return
    }

    // check response values and potentially correct them
    let responseUpdate = {}
    const value = (questionResponse.response as QuestionResponseFlashcard)
      .correctness

    // check if value is none of the anticipated ones
    if (
      value !== 0 &&
      value !== 1 &&
      value !== 2 &&
      value !== FlashcardCorrectness.CORRECT &&
      value !== FlashcardCorrectness.INCORRECT &&
      value !== FlashcardCorrectness.PARTIAL
    ) {
      console.error(
        'Flashcard question response detail with invalid correctness value:',
        value,
        'and id:',
        questionResponse.id
      )
      valueErrors++
      return
    }

    if (value === 0) {
      responseUpdate = {
        response: {
          correctness: FlashcardCorrectness.INCORRECT,
        },
      }
      console.log(
        'Response value was:',
        value,
        'and will be updated to:',
        responseUpdate
      )
    } else if (value === 1) {
      responseUpdate = {
        response: {
          correctness: FlashcardCorrectness.PARTIAL,
        },
      }
      console.log(
        'Response value was:',
        value,
        'and will be updated to:',
        responseUpdate
      )
    } else if (value === 2) {
      responseUpdate = {
        response: {
          correctness: FlashcardCorrectness.CORRECT,
        },
      }
      console.log(
        'Response value was:',
        value,
        'and will be updated to:',
        responseUpdate
      )
    }

    // check aggregated response values and potentially correct them
    let aggregatedResponseUpdate = {}
    const responses = questionResponse.aggregatedResponses

    // check if the keys are not either [0,1,2] or [CORRECT, INCORRECT, PARTIAL]
    const keys = Object.keys(responses)
    if (
      !(
        keys.length === 4 &&
        keys.includes('0') &&
        keys.includes('1') &&
        keys.includes('2') &&
        keys.includes('total')
      ) &&
      !(
        keys.length === 4 &&
        keys.includes(FlashcardCorrectness.CORRECT) &&
        keys.includes(FlashcardCorrectness.PARTIAL) &&
        keys.includes(FlashcardCorrectness.INCORRECT) &&
        keys.includes('total')
      )
    ) {
      console.error(
        'Flashcard question response with invalid aggregated response keys:',
        responses,
        'and id:',
        questionResponse.id
      )
      valueErrors++
      return
    }

    // if numerical keys are used, translate them to enum keys
    if (keys.includes('0') && keys.includes('1') && keys.includes('2')) {
      aggregatedResponseUpdate = {
        aggregatedResponses: {
          [FlashcardCorrectness.INCORRECT]: responses['0'],
          [FlashcardCorrectness.PARTIAL]: responses['1'],
          [FlashcardCorrectness.CORRECT]: responses['2'],
          total: responses.total,
        },
      }
      console.log(
        'previous response struct was:',
        responses,
        'and will be updated to:',
        aggregatedResponseUpdate
      )
      aggregatedResponseValueUpdates++
    }

    // if either one of the updates if defined, add the update to the promises array
    if (
      Object.keys(responseUpdate).length > 0 ||
      Object.keys(aggregatedResponseUpdate).length > 0
    ) {
      updatePromises.push(
        prisma.questionResponse.update({
          where: {
            id: questionResponse.id,
          },
          data: {
            ...responseUpdate,
            ...aggregatedResponseUpdate,
          },
        })
      )
      responseValueUpdates++
    }
  })

  // log number of errors and updates
  console.log('Value errors:', valueErrors)
  console.log('Response value updates:', responseValueUpdates)
  console.log(
    'Aggregated response value updates:',
    aggregatedResponseValueUpdates
  )
  console.log('Number of combined updates in total:', updatePromises.length)

  // ! USE THIS STATEMENT TO EXECUTE UPDATES
  //   await prisma.$transaction(updatePromises)
}

await run()

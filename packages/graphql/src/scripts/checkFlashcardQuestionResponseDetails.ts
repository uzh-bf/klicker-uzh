import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import { FlashcardCorrectness, QuestionResponseFlashcard } from 'src/types/app'

async function run() {
  const prisma = new PrismaClient()

  // fetch all questionResponseDetails and the linked element; filter for flashcards only
  const questionResponseDetails = await prisma.questionResponseDetail.findMany({
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
  let wrongResultRepresentations = 0

  // iterate over all questionResponseDetails and check if the correctness uses the correct enum representation
  questionResponseDetails.forEach((questionResponseDetail) => {
    const element = questionResponseDetail.elementInstance?.element
    if (!element) {
      console.error(
        'Element not found for question response detail:',
        questionResponseDetail.id
      )
      valueErrors++
      return
    }

    // response should only have a single key with correctness value
    if (
      Object.keys(questionResponseDetail.response).length !== 1 ||
      Object.keys(questionResponseDetail.response)[0] !== 'correctness'
    ) {
      console.error(
        'Flashcard question response detail with invalid response:',
        questionResponseDetail.response,
        'and id:',
        questionResponseDetail.id
      )
      valueErrors++
      return
    }

    const value = (questionResponseDetail.response as QuestionResponseFlashcard)
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
        questionResponseDetail.id
      )
      valueErrors++
      return
    }

    // if the value is a number, log this error and append a promise to update the value to an enum
    if (value === 2) {
      console.error(
        'Flashcard question response detail with wrong correctness value:',
        value,
        'and id:',
        questionResponseDetail.id,
        'will be updated to:',
        FlashcardCorrectness.CORRECT
      )
      wrongResultRepresentations++

      updatePromises.push(
        prisma.questionResponseDetail.update({
          where: {
            id: questionResponseDetail.id,
          },
          data: {
            response: {
              correctness: FlashcardCorrectness.CORRECT,
            },
          },
        })
      )
    } else if (value === 1) {
      console.error(
        'Flashcard question response detail with wrong correctness value:',
        value,
        'and id:',
        questionResponseDetail.id,
        'will be updated to:',
        FlashcardCorrectness.PARTIAL
      )
      wrongResultRepresentations++

      updatePromises.push(
        prisma.questionResponseDetail.update({
          where: {
            id: questionResponseDetail.id,
          },
          data: {
            response: {
              correctness: FlashcardCorrectness.PARTIAL,
            },
          },
        })
      )
    } else if (value === 0) {
      console.error(
        'Flashcard question response detail with wrong correctness value:',
        value,
        'and id:',
        questionResponseDetail.id,
        'will be updated to:',
        FlashcardCorrectness.INCORRECT
      )
      wrongResultRepresentations++

      updatePromises.push(
        prisma.questionResponseDetail.update({
          where: {
            id: questionResponseDetail.id,
          },
          data: {
            response: {
              correctness: FlashcardCorrectness.INCORRECT,
            },
          },
        })
      )
    } else if (
      value === FlashcardCorrectness.CORRECT ||
      value === FlashcardCorrectness.INCORRECT ||
      value === FlashcardCorrectness.PARTIAL
    ) {
      return // do nothing
    } else {
      console.error(
        'Unexpected flashcard question response detail with correct correctness value:',
        value,
        'and id:',
        questionResponseDetail.id
      )
      valueErrors++
    }
  })

  // log number of errors and updates
  console.log('Value errors:', valueErrors)
  console.log('Wrong result representations:', wrongResultRepresentations)

  // ! USE THIS STATEMENT TO EXECUTE UPDATES
  //   await prisma.$transaction(updatePromises)
}

await run()

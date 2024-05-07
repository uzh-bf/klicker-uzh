import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import dayjs from 'dayjs'
import { evaluateAnswerCorrectness } from '../services/practiceQuizzes'
import {
  FlashcardCorrectness,
  QuestionResponseChoices,
  QuestionResponseContent,
  QuestionResponseFlashcard,
  QuestionResponseValue,
} from '../types/app'

async function run() {
  const prisma = new PrismaClient()

  // fetch all question responses belonging to an element instance with type SC, MC, KPRIM, NUMERICAL or FREE_TEXT
  const responses = await prisma.questionResponse.findMany({
    where: {
      elementInstanceId: {
        not: null, // ! MIGRATION ONLY WORKS FOR THOSE CASES
      },
      // elementInstance: {
      //   elementType: {
      //     in: [
      // ElementType.SC,
      // ElementType.MC,
      // ElementType.KPRIM,
      // ElementType.NUMERICAL,
      // ElementType.FREE_TEXT,
      // ElementType.FLASHCARD,
      // ElementType.CONTENT,
      //   ],
      // },
      // },
    },
    include: {
      elementInstance: {
        include: { element: true },
      },
    },
    orderBy: {
      createdAt: 'asc',
    },
    // skip: 20000, // TODO: update skipping parameter together with window
    // take: 100, // TODO: either run all at once or increase window
  })

  console.log(`Total considered question responses: ${responses.length}`)

  // intialize promises array and counters
  let updatePromises: any[] = []
  let missingQuestionResponseDetails = 0
  let flashcardResponseUpdates = 0
  let contentResponseUpdates = 0
  let questionResponseUpdates = 0
  let totalUpdates = 0

  // define the generator function that yields
  // N items at a time from the provided array
  function* getBatch(records: any, batchsize = 10) {
    while (records.length) {
      yield records.splice(0, batchsize)
    }
  }

  for (let batch of getBatch(responses)) {
    for (let response of batch) {
      console.log(`Processing question response`, response)

      const detailResponses = await prisma.questionResponseDetail.findMany({
        where: {
          elementInstanceId: response.elementInstanceId,
          participantId: response.participantId,
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      if (detailResponses.length === 0) {
        console.error(
          `No detail responses found for questionResponse ${response.id} with elementInstanceId ${response.elementInstanceId} and participantId ${response.participantId}`
        )
        missingQuestionResponseDetails++
        continue
      }

      if (
        response.elementInstance!.elementType === ElementType.SC ||
        response.elementInstance!.elementType === ElementType.MC ||
        response.elementInstance!.elementType === ElementType.KPRIM ||
        response.elementInstance!.elementType === ElementType.NUMERICAL ||
        response.elementInstance!.elementType === ElementType.FREE_TEXT
      ) {
        // loop over the detail responses and aggregate the correctness values
        const {
          correctCount,
          correctCountStreak,
          partialCount,
          incorrectCount,
          lastCorrectAt,
          lastPartialAt,
          lastIncorrectAt,
        } = detailResponses.reduce<{
          correctCount: number
          correctCountStreak: number
          partialCount: number
          incorrectCount: number
          lastCorrectAt: Date | null
          lastPartialAt: Date | null
          lastIncorrectAt: Date | null
        }>(
          (acc, detailResponse) => {
            const correctness = evaluateAnswerCorrectness({
              elementData: response.elementInstance!.elementData,
              response: detailResponse.response as
                | QuestionResponseChoices
                | QuestionResponseValue,
            })

            if (correctness === null) {
              return acc
            }
            if (correctness === 1) {
              return {
                ...acc,
                correctCount: acc.correctCount + 1,
                correctCountStreak: acc.correctCountStreak + 1,
                lastCorrectAt: detailResponse.createdAt,
              }
            } else if (correctness < 1 && correctness > 0) {
              return {
                ...acc,
                partialCount: acc.partialCount + 1,
                correctCountStreak: 0,
                lastPartialAt: detailResponse.createdAt,
              }
            } else if (correctness === 0) {
              return {
                ...acc,
                incorrectCount: acc.incorrectCount + 1,
                correctCountStreak: 0,
                lastIncorrectAt: detailResponse.createdAt,
              }
            } else {
              throw new Error('Unknown correctness value')
            }
          },
          {
            correctCount: 0,
            correctCountStreak: 0,
            partialCount: 0,
            incorrectCount: 0,
            lastCorrectAt: null,
            lastPartialAt: null,
            lastIncorrectAt: null,
          }
        )

        if (
          correctCount === response.correctCount &&
          correctCountStreak === response.correctCountStreak &&
          partialCount === response.partialCorrectCount &&
          incorrectCount === response.wrongCount &&
          ((!lastCorrectAt && !response.lastCorrectAt) ||
            dayjs(lastCorrectAt).diff(response.lastCorrectAt) < 1000) &&
          ((!lastPartialAt && !response.lastPartialCorrectAt) ||
            dayjs(lastPartialAt).diff(response.lastPartialCorrectAt) < 1000) &&
          ((!lastIncorrectAt && !response.lastWrongAt) ||
            dayjs(lastIncorrectAt).diff(response.lastWrongAt) < 1000)
        ) {
          console.log(`No changes for question response ${response.id}`)
          continue
        }

        // TODO: uncomment this code for execution on production database
        // updatePromises.push(
        //   prisma.questionResponse.update({
        //     where: { id: response.id },
        //     data: {
        //       correctCount: correctCount,
        //       correctCountStreak: correctCountStreak,
        //       lastCorrectAt: lastCorrectAt,
        //       partialCorrectCount: partialCount,
        //       lastPartialCorrectAt: lastPartialAt,
        //       wrongCount: incorrectCount,
        //       lastWrongAt: lastIncorrectAt,
        //     },
        //   })
        // )

        console.log(
          `Updating correctness parameters for question response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        )

        questionResponseUpdates++
      } else if (
        response.elementInstance!.elementType === ElementType.FLASHCARD
      ) {
        // loop over the detail responses and aggregate the correctness values
        const {
          correctCount,
          correctCountStreak,
          partialCount,
          incorrectCount,
          lastCorrectAt,
          lastPartialAt,
          lastIncorrectAt,
        } = detailResponses.reduce<{
          correctCount: number
          correctCountStreak: number
          partialCount: number
          incorrectCount: number
          lastCorrectAt: Date | null
          lastPartialAt: Date | null
          lastIncorrectAt: Date | null
        }>(
          (acc, detailResponse) => {
            const flashcardResponse =
              detailResponse.response as QuestionResponseFlashcard

            if (flashcardResponse === null) {
              return acc
            }
            if (
              flashcardResponse.correctness === FlashcardCorrectness.CORRECT
            ) {
              return {
                ...acc,
                correctCount: acc.correctCount + 1,
                correctCountStreak: acc.correctCountStreak + 1,
                lastCorrectAt: detailResponse.createdAt,
              }
            } else if (
              flashcardResponse.correctness === FlashcardCorrectness.PARTIAL
            ) {
              return {
                ...acc,
                partialCount: acc.partialCount + 1,
                correctCountStreak: 0,
                lastPartialAt: detailResponse.createdAt,
              }
            } else if (
              flashcardResponse.correctness === FlashcardCorrectness.INCORRECT
            ) {
              return {
                ...acc,
                incorrectCount: acc.incorrectCount + 1,
                correctCountStreak: 0,
                lastIncorrectAt: detailResponse.createdAt,
              }
            } else {
              throw new Error('Unknown correctness value')
            }
          },
          {
            correctCount: 0,
            correctCountStreak: 0,
            partialCount: 0,
            incorrectCount: 0,
            lastCorrectAt: null,
            lastPartialAt: null,
            lastIncorrectAt: null,
          }
        )

        if (
          correctCount === response.correctCount &&
          correctCountStreak === response.correctCountStreak &&
          partialCount === response.partialCorrectCount &&
          incorrectCount === response.wrongCount &&
          ((!lastCorrectAt && !response.lastCorrectAt) ||
            dayjs(lastCorrectAt).diff(response.lastCorrectAt) < 1000) &&
          ((!lastPartialAt && !response.lastPartialCorrectAt) ||
            dayjs(lastPartialAt).diff(response.lastPartialCorrectAt) < 1000) &&
          ((!lastIncorrectAt && !response.lastWrongAt) ||
            dayjs(lastIncorrectAt).diff(response.lastWrongAt) < 1000)
        ) {
          console.log(`No changes for flashcard response ${response.id}`)
          continue
        }

        // TODO: uncomment this code for execution on production database
        // updatePromises.push(
        //   prisma.questionResponse.update({
        //     where: { id: response.id },
        //     data: {
        //       correctCount: correctCount,
        //       correctCountStreak: correctCountStreak,
        //       lastCorrectAt: lastCorrectAt,
        //       partialCorrectCount: partialCount,
        //       lastPartialCorrectAt: lastPartialAt,
        //       wrongCount: incorrectCount,
        //       lastWrongAt: lastIncorrectAt,
        //     },
        //   })
        // )

        console.log(
          `Updating correctness parameters for flashcard response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        )

        flashcardResponseUpdates++
      } else if (
        response.elementInstance!.elementType === ElementType.CONTENT
      ) {
        // loop over the detail responses and aggregate the correctness values
        const {
          correctCount,
          correctCountStreak,
          partialCount,
          incorrectCount,
          lastCorrectAt,
          lastPartialAt,
          lastIncorrectAt,
        } = detailResponses.reduce<{
          correctCount: number
          correctCountStreak: number
          partialCount: number
          incorrectCount: number
          lastCorrectAt: Date | null
          lastPartialAt: Date | null
          lastIncorrectAt: Date | null
        }>(
          (acc, detailResponse) => {
            const contentResponse =
              detailResponse.response as QuestionResponseContent

            if (contentResponse === null) {
              return acc
            }
            if (contentResponse.viewed) {
              return {
                ...acc,
                correctCount: acc.correctCount + 1,
                correctCountStreak: acc.correctCountStreak + 1,
                lastCorrectAt: detailResponse.createdAt,
              }
            } else {
              throw new Error('Unknown correctness value')
            }
          },
          {
            correctCount: 0,
            correctCountStreak: 0,
            partialCount: 0,
            incorrectCount: 0,
            lastCorrectAt: null,
            lastPartialAt: null,
            lastIncorrectAt: null,
          }
        )

        if (
          correctCount === response.correctCount &&
          correctCountStreak === response.correctCountStreak &&
          partialCount === response.partialCorrectCount &&
          incorrectCount === response.wrongCount &&
          ((!lastCorrectAt && !response.lastCorrectAt) ||
            dayjs(lastCorrectAt).diff(response.lastCorrectAt) < 1000) &&
          ((!lastPartialAt && !response.lastPartialCorrectAt) ||
            dayjs(lastPartialAt).diff(response.lastPartialCorrectAt) < 1000) &&
          ((!lastIncorrectAt && !response.lastWrongAt) ||
            dayjs(lastIncorrectAt).diff(response.lastWrongAt) < 1000)
        ) {
          console.log(`No changes for content response ${response.id}`)
          continue
        }

        // TODO: uncomment this code for execution on production database
        // updatePromises.push(
        //   prisma.questionResponse.update({
        //     where: { id: response.id },
        //     data: {
        //       correctCount: correctCount,
        //       correctCountStreak: correctCountStreak,
        //       lastCorrectAt: lastCorrectAt,
        //       partialCorrectCount: partialCount,
        //       lastPartialCorrectAt: lastPartialAt,
        //       wrongCount: incorrectCount,
        //       lastWrongAt: lastIncorrectAt,
        //     },
        //   })
        // )

        console.log(
          `Updating correctness parameters for content response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        )

        contentResponseUpdates++
      } else {
        throw new Error(
          `Unknown element type for this script ${
            response.elementInstance!.elementType
          }`
        )
      }

      await Promise.allSettled(updatePromises)
    }
  }

  // logging
  console.log(`Total considered question responses: ${responses.length}`)
  console.log(
    `Missing question response details: ${missingQuestionResponseDetails}`
  )
  console.log(`Total updates: ${totalUpdates}`)
  console.log(`Flashcard response updates: ${flashcardResponseUpdates}`)
  console.log(`Content response updates: ${contentResponseUpdates}`)
  console.log(`Question response updates: ${questionResponseUpdates}`)
}

await run()

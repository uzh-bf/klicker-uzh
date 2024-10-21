import { ElementType, PrismaClient } from '@klicker-uzh/prisma'
import type {
  FlashcardCorrectness,
  SingleQuestionResponseChoices,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import dayjs from 'dayjs'
import { evaluateAnswerCorrectness } from '../services/practiceQuizzes.js'

async function run() {
  const prisma = new PrismaClient()

  const startTime = new Date().getTime()

  // reset isMigrated flag
  // await prisma.questionResponse.updateMany({
  //   data: {
  //     isMigrated: false,
  //   },
  // })

  // return

  // delete all questionResponses without elementInstanceId
  // const result = await prisma.questionResponse.findMany({
  //   where: {
  //     elementInstanceId: null,
  //   },
  // })
  // console.warn(
  //   `Found ${result.length} questionResponses without elementInstanceId`
  // )
  // await prisma.questionResponse.deleteMany({
  //   where: {
  //     elementInstanceId: null,
  //   },
  // })
  // const result2 = await prisma.questionResponseDetail.findMany({
  //   where: {
  //     elementInstanceId: null,
  //   },
  // })
  // console.warn(
  //   `Found ${result2.length} questionResponseDetails without elementInstanceId`
  // )
  // await prisma.questionResponseDetail.deleteMany({
  //   where: {
  //     elementInstanceId: null,
  //   },
  // })
  // return

  // delete all questionResponses without aggregated results
  // do this manually

  let doContinue = true

  while (doContinue) {
    // fetch all question responses belonging to an element instance with type SC, MC, KPRIM, NUMERICAL or FREE_TEXT
    const responses = await prisma.questionResponse.findMany({
      where: {
        isMigrated: false,
      },
      include: {
        elementInstance: {
          include: { element: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 50,
    })

    console.log(`Total considered question responses: ${responses.length}`)

    if (responses.length === 0) {
      doContinue = false
      break
    }

    let missingQuestionResponseDetails = 0
    let flashcardResponseUpdates = 0
    let contentResponseUpdates = 0
    let questionResponseUpdates = 0
    let totalUpdates = 0

    let updates = []

    for (const response of responses) {
      // console.log(`Processing question response`, response)

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
        updates.push({
          where: {
            id: response.id,
          },
          data: {
            isMigrated: true,
          },
        })
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
                | SingleQuestionResponseChoices
                | SingleQuestionResponseValue,
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
          // console.log(`No changes for question response ${response.id}`)
          updates.push({
            where: {
              id: response.id,
            },
            data: {
              isMigrated: true,
            },
          })
          continue
        }

        updates.push({
          where: { id: response.id },
          data: {
            correctCount: correctCount,
            correctCountStreak: correctCountStreak,
            lastCorrectAt: lastCorrectAt,
            partialCorrectCount: partialCount,
            lastPartialCorrectAt: lastPartialAt,
            wrongCount: incorrectCount,
            lastWrongAt: lastIncorrectAt,
          },
        })

        // console.log(
        //   `Updating correctness parameters for question response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        // )

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
              detailResponse.response as SingleQuestionResponseFlashcard

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
          // console.log(`No changes for flashcard response ${response.id}`)
          updates.push({
            where: {
              id: response.id,
            },
            data: {
              isMigrated: true,
            },
          })
          continue
        }

        updates.push({
          where: { id: response.id },
          data: {
            correctCount: correctCount,
            correctCountStreak: correctCountStreak,
            lastCorrectAt: lastCorrectAt,
            partialCorrectCount: partialCount,
            lastPartialCorrectAt: lastPartialAt,
            wrongCount: incorrectCount,
            lastWrongAt: lastIncorrectAt,
          },
        })

        // console.log(
        //   `Updating correctness parameters for flashcard response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        // )

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
              detailResponse.response as SingleQuestionResponseContent

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
          // console.log(`No changes for content response ${response.id}`)
          updates.push({
            where: {
              id: response.id,
            },
            data: {
              isMigrated: true,
            },
          })
          continue
        }

        updates.push({
          where: { id: response.id },
          data: {
            correctCount: correctCount,
            correctCountStreak: correctCountStreak,
            lastCorrectAt: lastCorrectAt,
            partialCorrectCount: partialCount,
            lastPartialCorrectAt: lastPartialAt,
            wrongCount: incorrectCount,
            lastWrongAt: lastIncorrectAt,
          },
        })

        // console.log(
        //   `Updating correctness parameters for content response ${response.id} with: ${correctCount} correct, ${correctCountStreak} correct streak, ${partialCount} partial, ${incorrectCount} incorrect. Dates are ${lastCorrectAt}, ${lastPartialAt}, ${lastIncorrectAt}.`
        // )

        contentResponseUpdates++
      } else {
        throw new Error(
          `Unknown element type for this script ${
            response.elementInstance!.elementType
          }`
        )
      }
    }

    await prisma.$transaction(
      updates.map((update) => prisma.questionResponse.update(update))
    )

    console.warn(`Time elapsed: ${(new Date().getTime() - startTime) / 1000}`)

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
}

await run()

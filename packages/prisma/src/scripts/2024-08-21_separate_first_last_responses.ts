import { evaluateAnswerCorrectness } from '../../../graphql/src/services/practiceQuizzes'
import {
  FlashcardCorrectness,
  QuestionResponseChoices,
  QuestionResponseFlashcard,
  QuestionResponseValue,
} from '../../../graphql/src/types/app'
import {
  ElementType,
  PrismaClient,
  ResponseCorrectness,
} from '../prisma/client'

async function run() {
  const prisma = new PrismaClient()

  let deletedResponses = 0
  let counter = 0

  // fetch all participants
  const participants = await prisma.participant.findMany()
  const numOfParticipants = participants.length

  for (const participant of participants) {
    counter = counter + 1
    console.log('Processing participant', counter, '/', numOfParticipants)

    // all question responses and details of one participant
    const questionResponses = await prisma.questionResponse.findMany({
      where: {
        participantId: participant.id,
      },
      include: {
        elementInstance: {
          include: {
            detailResponses: {
              where: {
                participantId: participant.id,
              },
              orderBy: {
                createdAt: 'asc',
              },
            },
          },
        },
      },
    })

    // if no instances have been found, break the loop
    if (questionResponses.length === 0) {
      continue
    }

    const updatePromises: any[] = questionResponses.map((response) => {
      if (response.elementInstance.detailResponses.length === 0) {
        console.log(
          'Warning: No detail responses found for question response! --> RESPONSE WILL BE DELETED'
        )
        deletedResponses = deletedResponses + 1

        return prisma.questionResponse.delete({
          where: {
            id: response.id,
          },
        })
      }

      // find the first and last questionResponseDetail for each questionResponse
      let firstLastIdentical = false
      if (response.elementInstance.detailResponses.length === 1) {
        firstLastIdentical = true
      }
      const firstDetail = response.elementInstance.detailResponses[0]
      const lastDetail = firstLastIdentical
        ? firstDetail
        : response.elementInstance.detailResponses[
            response.elementInstance.detailResponses.length - 1
          ]

      // validate that the last questionResponseDetail coincides with the lastResponse on the questionResponse
      // if (
      //   JSON.stringify(lastDetail.response) !==
      //   JSON.stringify(response.lastResponse)
      // ) {
      //   console.log('DETAIL RESPONSE')
      //   console.log(lastDetail.response)
      //   console.log(lastDetail.createdAt)
      //   console.log('LAST RESPONSE')
      //   console.log(response.lastResponse)
      //   console.log(response.lastAnsweredAt)
      //   throw new Error(`Last detail response does not match last response!`)
      // }

      // compute the correctness for the first and last questionResponseDetail
      // if the first and last are identical, only execute one computation
      let firstCorrectness = -1
      let lastCorrectness = -1

      if (
        response.elementInstance!.elementType === ElementType.SC ||
        response.elementInstance!.elementType === ElementType.MC ||
        response.elementInstance!.elementType === ElementType.KPRIM ||
        response.elementInstance!.elementType === ElementType.NUMERICAL ||
        response.elementInstance!.elementType === ElementType.FREE_TEXT
      ) {
        firstCorrectness =
          evaluateAnswerCorrectness({
            elementData: response.elementInstance!.elementData,
            response: firstDetail.response as
              | QuestionResponseChoices
              | QuestionResponseValue,
          }) ?? -1

        if (firstLastIdentical) {
          lastCorrectness = firstCorrectness
        } else {
          lastCorrectness =
            evaluateAnswerCorrectness({
              elementData: response.elementInstance!.elementData,
              response: lastDetail.response as
                | QuestionResponseChoices
                | QuestionResponseValue,
            }) ?? -1
        }
      } else if (
        response.elementInstance!.elementType === ElementType.FLASHCARD
      ) {
        const firstFlashcardCorrectness = (
          firstDetail.response as QuestionResponseFlashcard
        ).correctness

        firstCorrectness =
          firstFlashcardCorrectness === FlashcardCorrectness.CORRECT
            ? 1
            : firstFlashcardCorrectness === FlashcardCorrectness.INCORRECT
              ? 0
              : 0.5

        if (firstLastIdentical) {
          lastCorrectness = firstCorrectness
        } else {
          const lastFlashcardCorrectness = (
            lastDetail.response as QuestionResponseFlashcard
          ).correctness

          lastCorrectness =
            lastFlashcardCorrectness === FlashcardCorrectness.CORRECT
              ? 1
              : lastFlashcardCorrectness === FlashcardCorrectness.INCORRECT
                ? 0
                : 0.5
        }
      } else if (
        response.elementInstance!.elementType === ElementType.CONTENT
      ) {
        firstCorrectness = 1
        lastCorrectness = 1
      } else {
        throw new Error(
          `Element type ${response.elementInstance!.elementType} not supported`
        )
      }

      if (firstCorrectness === -1 || lastCorrectness === -1) {
        // console.log(response.elementInstance)
        // console.log(response.elementInstance.elementData)
        // console.log('First correctness: ', firstCorrectness)
        // console.log('Last correctness: ', lastCorrectness)
        console.log(response.lastResponse)
        throw new Error(
          `Correctness computation has failed for question response!`
        )
      }

      // console.log(
      //   'Updating first response, first correctness, last correctness'
      // )
      // console.log('First response: ', firstDetail.response)
      // console.log('First correctness: ', firstCorrectness)
      // console.log('Last correctness: ', lastCorrectness)

      // update the firstResponse, firstResponseCorrectness and lastResponseCorrectness on the questionResponse through a transaction
      return prisma.questionResponse.update({
        where: {
          id: response.id,
        },
        data: {
          firstResponse: firstDetail.response,
          firstResponseCorrectness:
            firstCorrectness === 1
              ? ResponseCorrectness.CORRECT
              : firstCorrectness === 0
                ? ResponseCorrectness.WRONG
                : ResponseCorrectness.PARTIAL,
          lastResponseCorrectness:
            lastCorrectness === 1
              ? ResponseCorrectness.CORRECT
              : lastCorrectness === 0
                ? ResponseCorrectness.WRONG
                : ResponseCorrectness.PARTIAL,
        },
      })
    })

    // ! USE THIS STATEMENT TO EXECUTE UPDATES
    await prisma.$transaction(updatePromises)
  }

  console.log(`Deleted ${deletedResponses} responses`)
}

await run()

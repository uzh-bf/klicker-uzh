import { Element, ElementType, PrismaClient } from '@klicker-uzh/prisma'
import {
  QuestionResultsChoices,
  QuestionResultsOpen,
  SingleQuestionResponseChoices,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import { getInitialElementResults } from '@klicker-uzh/util'
import { createHash } from 'node:crypto'

async function run() {
  const MD5 = createHash('md5')
  const prisma = new PrismaClient()

  const startTime = new Date().getTime()

  let doContinue = true

  while (doContinue) {
    // fetch all question responses belonging to an element instance with type SC, MC, KPRIM, NUMERICAL or FREE_TEXT
    const responses = await prisma.questionResponse.findMany({
      where: {
        // createdAt: {
        //   lte: new Date('2023-04-18T00:00:00.000Z'),
        // },
        isMigrated: false,
        elementInstance: {
          elementType: {
            in: [
              ElementType.SC,
              ElementType.MC,
              ElementType.KPRIM,
              ElementType.NUMERICAL,
              ElementType.FREE_TEXT,
            ],
          },
        },
      },
      include: {
        elementInstance: {
          include: { element: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100,
    })

    if (responses.length === 0) {
      doContinue = false
      break
    }

    // intialize promises array and counters
    let updatePromises: any[] = []
    let missingDetailResponses = 0
    let choicesQuestions = 0
    let openQuestions = 0
    let totalUpdates = 0

    // loop over responses and update them as required
    for (const response of responses) {
      // const aggregatedResponses = response.aggregatedResponses

      // if (aggregatedResponses !== null) {
      //   // console.log(
      //   //   `Aggregated responses for questionResponse ${response.id} are not set to null`
      //   // )
      //   // updatePromises.push(
      //   //   prisma.questionResponse.update({
      //   //     where: { id: response.id },
      //   //     data: {
      //   //       isMigrated: true,
      //   //     },
      //   //   })
      //   // )
      //   continue
      // }

      const detailResponses = await prisma.questionResponseDetail.findMany({
        where: {
          elementInstanceId: response.elementInstanceId,
          participantId: response.participantId,
        },
      })

      if (detailResponses.length === 0) {
        // console.log(
        //   `No detail responses found for questionResponse ${response.id}`
        // )
        const emptyAggregatedResponses = getInitialElementResults(
          response.elementInstance!.element as Element
        )
        missingDetailResponses++

        updatePromises.push(
          prisma.questionResponse.update({
            where: { id: response.id },
            data: {
              aggregatedResponses: emptyAggregatedResponses,
              isMigrated: true,
            },
          })
        )

        continue
      }

      if (
        response.elementInstance!.elementType === ElementType.SC ||
        response.elementInstance!.elementType === ElementType.MC ||
        response.elementInstance!.elementType === ElementType.KPRIM
      ) {
        let aggregatedResponses = getInitialElementResults(
          response.elementInstance!.element as Element
        ) as QuestionResultsChoices

        // loop over the detail responses and update the aggregated responses
        for (const detailResponse of detailResponses) {
          aggregatedResponses.choices = (
            detailResponse.response as SingleQuestionResponseChoices
          ).choices.reduce(
            (acc, ix) => ({
              ...acc,
              [ix]: acc[ix] + 1,
            }),
            aggregatedResponses.choices
          )
          aggregatedResponses.total = aggregatedResponses.total + 1
        }

        updatePromises.push(
          prisma.questionResponse.update({
            where: { id: response.id },
            data: {
              aggregatedResponses: aggregatedResponses,
              isMigrated: true,
            },
          })
        )

        // console.log(
        //   `NEW AGGREAGTED RESULTS FOR ${
        //     response.elementInstance!.elementType
        //   } QUESTION:`,
        //   aggregatedResponses
        // )

        choicesQuestions++
      } else if (
        response.elementInstance!.elementType === ElementType.NUMERICAL ||
        response.elementInstance!.elementType === ElementType.FREE_TEXT
      ) {
        let aggregatedResponses = getInitialElementResults(
          response.elementInstance!.element as Element
        ) as QuestionResultsOpen

        // loop over the detail responses and update the aggregated responses
        for (const detailResponse of detailResponses) {
          const value = (detailResponse.response as SingleQuestionResponseValue)
            .value
          MD5.update(value)
          const hashValue = MD5.digest('hex')
          aggregatedResponses.responses[hashValue] = {
            value: value,
            count: (aggregatedResponses.responses[hashValue]?.count ?? 0) + 1,
          }
          aggregatedResponses.total = aggregatedResponses.total + 1
        }

        updatePromises.push(
          prisma.questionResponse.update({
            where: { id: response.id },
            data: {
              aggregatedResponses: aggregatedResponses,
              isMigrated: true,
            },
          })
        )

        // console.log(
        //   `NEW AGGREAGTED RESULTS FOR ${
        //     response.elementInstance!.elementType
        //   } QUESTION:`,
        //   aggregatedResponses
        // )

        openQuestions++
      } else {
        throw new Error(
          `Unknown element type for this script ${
            response.elementInstance!.elementType
          }`
        )
      }
    }

    await Promise.allSettled(updatePromises)

    // logging
    console.warn(`Time elapsed: ${(new Date().getTime() - startTime) / 1000}`)
    console.log(
      `Total considered question responses with inconsistent aggregated results: ${responses.length}`
    )
    console.log(`Missing detail responses: ${missingDetailResponses}`)
    console.log(`Total updates: ${totalUpdates}`)
    console.log(`Choices question updates: ${choicesQuestions}`)
    console.log(`Open question updates: ${openQuestions}`)
  }
}

await run()

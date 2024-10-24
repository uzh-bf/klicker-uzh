import { Element, ElementType, PrismaClient } from '@klicker-uzh/prisma'
import {
  FlashcardCorrectness,
  SingleQuestionResponseContent,
  SingleQuestionResponseFlashcard,
} from '@klicker-uzh/types'
import { getInitialElementResults } from '@klicker-uzh/util'

async function run() {
  const prisma = new PrismaClient()

  const startTime = new Date().getTime()

  let offset = 0

  while (offset >= 0) {
    // fetch all question responses belonging to an element instance with type SC, MC, KPRIM, NUMERICAL or FREE_TEXT
    const responses = await prisma.questionResponse.findMany({
      where: {
        isMigrated: false,
        elementInstance: {
          elementType: {
            in: [ElementType.FLASHCARD, ElementType.CONTENT],
          },
        },
        aggregatedResponses: {
          not: null,
        },
      },
      include: {
        elementInstance: {
          include: { element: true },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 100,
      skip: offset,
    })

    if (responses.length === 0) {
      offset = -1
      break
    }

    // intialize promises array and counters
    let updatePromises: any[] = []
    let missingDetailResponses = 0
    let flashcardsChecked = 0
    let contentElementChecked = 0
    let totalInconsistencies = 0
    let counter = 0
    let total = responses.length

    // loop over responses and update them as required
    for (const response of responses) {
      // console.log(`${counter}/${total}`)
      // const aggregatedResponses = response.aggregatedResponses

      // if (aggregatedResponses === null) {
      //   console.log(
      //     `Aggregated responses for questionResponse ${response.id} are set to null`
      //   )
      //   continue
      // }

      const detailResponses = await prisma.questionResponseDetail.findMany({
        where: {
          elementInstanceId: response.elementInstanceId,
          participantId: response.participantId,
        },
      })

      if (detailResponses.length === 0) {
        console.log(
          `No detail responses found for questionResponse ${response.id}`
        )
        missingDetailResponses++
        continue
      }

      if (response.elementInstance!.elementType === ElementType.FLASHCARD) {
        let aggregatedResponses = getInitialElementResults(
          response.elementInstance!.element as Element
        ) as FlashcardInstanceResults

        // loop over the detail responses and update the aggregated responses
        for (const detailResponse of detailResponses) {
          const flashcardResponse =
            detailResponse.response as SingleQuestionResponseFlashcard
          if (flashcardResponse.correctness === FlashcardCorrectness.CORRECT) {
            aggregatedResponses[FlashcardCorrectness.CORRECT] =
              aggregatedResponses[FlashcardCorrectness.CORRECT] + 1
          } else if (
            flashcardResponse.correctness === FlashcardCorrectness.PARTIAL
          ) {
            aggregatedResponses[FlashcardCorrectness.PARTIAL] =
              aggregatedResponses[FlashcardCorrectness.PARTIAL] + 1
          } else if (
            flashcardResponse.correctness === FlashcardCorrectness.INCORRECT
          ) {
            aggregatedResponses[FlashcardCorrectness.INCORRECT] =
              aggregatedResponses[FlashcardCorrectness.INCORRECT] + 1
          }
          aggregatedResponses.total = aggregatedResponses.total + 1
        }

        // check consistency
        let inconsistent = false
        if (
          response.aggregatedResponses[FlashcardCorrectness.CORRECT] !==
          aggregatedResponses[FlashcardCorrectness.CORRECT]
        ) {
          console.log(
            `Inconsistent correct responses for questionResponse ${response.id}`
          )
          console.log('WRONG aggregated results:', response.aggregatedResponses)
          console.log('CORRECT aggregated results:', aggregatedResponses)
          inconsistent = true
        }
        if (
          response.aggregatedResponses[FlashcardCorrectness.PARTIAL] !==
          aggregatedResponses[FlashcardCorrectness.PARTIAL]
        ) {
          console.log(
            `Inconsistent partial responses for questionResponse ${response.id}`
          )
          console.log('WRONG aggregated results:', response.aggregatedResponses)
          console.log('CORRECT aggregated results:', aggregatedResponses)
          inconsistent = true
        }
        if (
          response.aggregatedResponses[FlashcardCorrectness.INCORRECT] !==
          aggregatedResponses[FlashcardCorrectness.INCORRECT]
        ) {
          console.log(
            `Inconsistent incorrect responses for questionResponse ${response.id}`
          )
          console.log('WRONG aggregated results:', response.aggregatedResponses)
          console.log('CORRECT aggregated results:', aggregatedResponses)
          inconsistent = true
        }

        if (inconsistent) {
          updatePromises.push(
            prisma.questionResponse.update({
              where: { id: response.id },
              data: {
                aggregatedResponses: aggregatedResponses,
                isMigrated: true,
              },
            })
          )

          totalInconsistencies++
        }

        flashcardsChecked++
      } else if (
        response.elementInstance!.elementType === ElementType.CONTENT
      ) {
        let aggregatedResponses = getInitialElementResults(
          response.elementInstance!.element as Element
        ) as ContentInstanceResults

        // loop over the detail responses and update the aggregated responses
        for (const detailResponse of detailResponses) {
          const contentResponse =
            detailResponse.response as SingleQuestionResponseContent

          if (contentResponse.viewed) {
            aggregatedResponses.total = aggregatedResponses.total + 1
          }
        }

        // check consistency
        if (response.aggregatedResponses.total !== aggregatedResponses.total) {
          console.log(
            `Inconsistent total views for questionResponse ${response.id}`
          )
          console.log('WRONG aggregated results:', response.aggregatedResponses)
          console.log('CORRECT aggregated results:', aggregatedResponses)

          updatePromises.push(
            prisma.questionResponse.update({
              where: { id: response.id },
              data: {
                aggregatedResponses: aggregatedResponses,
                isMigrated: true,
              },
            })
          )

          totalInconsistencies++
        }

        contentElementChecked++
      } else {
        throw new Error(
          `Unknown element type for this script ${
            response.elementInstance!.elementType
          }`
        )
      }

      counter++
    }

    // logging
    console.warn(`Time elapsed: ${(new Date().getTime() - startTime) / 1000}`)
    console.log(
      `Total considered question responses with inconsistent aggregated results: ${responses.length}`
    )
    console.log(`Missing detail responses: ${missingDetailResponses}`)
    console.log(`Total inconsistencies: ${totalInconsistencies}`)
    console.log(`Flashcard checks: ${flashcardsChecked}`)
    console.log(`Content element checks: ${contentElementChecked}`)

    // ! USE THIS STATEMENT TO EXECUTE UPDATES
    await Promise.allSettled(updatePromises)

    offset += 100
  }
}

await run()

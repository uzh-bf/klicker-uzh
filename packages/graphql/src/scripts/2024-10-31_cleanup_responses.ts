import {
  ElementInstanceType,
  ElementType,
  PrismaClient,
  QuestionResponse,
  QuestionResponseDetail,
  ResponseCorrectness,
} from '@klicker-uzh/prisma'
// import {
//   FlashcardCorrectness,
//   FlashcardResults,
//   SingleQuestionResponseFlashcard,
// } from '@klicker-uzh/types'
import {
  ElementInstanceResults,
  ElementResultsChoices,
  SingleQuestionResponse,
  SingleQuestionResponseChoices,
} from '@klicker-uzh/types' // TODO: replace this import with proper types import from types package
import { getInitialElementResults } from '@klicker-uzh/util'
import { prop, sortBy } from 'remeda'
// import { updateSpacedRepetition } from '../services/practiceQuizzes'
import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
} from '@klicker-uzh/grading'
import { evaluateAnswerCorrectness } from '../services/practiceQuizzes'

const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

// ? This script will iterate through all element instances and
// ? update the question responses and question response details
async function run() {
  const prisma = new PrismaClient()
  let counter = 0

  // fetch all element instances with their corresponding responses
  const instances = await prisma.elementInstance.findMany({
    where: {
      type: {
        in: [
          ElementInstanceType.PRACTICE_QUIZ,
          ElementInstanceType.MICROLEARNING,
        ],
      },
    },
    include: {
      responses: { include: { participant: true, participation: true } },
      detailResponses: { include: { participant: true } },
      element: true,
    },
  })

  for (const instance of instances) {
    // ! Initialization
    const emptyInstanceResults = getInitialElementResults(instance.element)
    const instanceResults = { ...emptyInstanceResults }

    // ! Response and Result Updates
    const detailUpdates: any[] = []
    const responseUpdates: any[] = []
    const leaderboardUpdates: any[] = [] // leaderboard entries are only updated for instances in microlearnings

    // group responses and details by participant (format: { participantId: { response, detail[] }, ... })
    const participantResponses = instance.responses.reduce<
      Record<
        string,
        { response: QuestionResponse; details: QuestionResponseDetail[] }
      >
    >((acc, response) => {
      // find all details for this response (same participant and same instance)
      const responseDetails = instance.detailResponses.filter(
        (detail) =>
          detail.elementInstanceId === instance.id &&
          detail.participantId === response.participantId
      )

      // if there are no details for this response, skip it
      if (responseDetails.length === 0) return acc

      // add response and details to the accumulator
      acc[response.participantId] = {
        response,
        details: sortBy(responseDetails, [prop('createdAt'), 'asc']),
      }
      return acc
    }, {})

    for (const [participantId, { response, details }] of Object.entries(
      participantResponses
    )) {
      // initialize fields for question response
      let trialsCount = 0
      let totalScore = 0
      let totalPointsAwarded = 0
      let totalXpAwarded = 0
      let averageTimeSpent = 0
      let lastAwardedAt: Date | undefined = undefined
      let lastXpAwardedAt: Date | undefined = undefined
      let lastAnsweredAt: Date | undefined = undefined

      let correctCount = 0
      let correctCountStreak = 0
      let lastCorrectAt: Date | undefined = undefined

      let partialCorrectCount = 0
      let lastPartialCorrectAt: Date | undefined = undefined

      let wrongCount = 0
      let lastWrongAt: Date | undefined = undefined

      let eFactor = 2.5
      let interval = 1
      let nextDueAt: Date | undefined = undefined

      let firstResponse: SingleQuestionResponse | undefined = undefined
      let firstResponseCorrectness: ResponseCorrectness | undefined = undefined
      let lastResponse: SingleQuestionResponse | undefined = undefined
      let lastResponseCorrectness: ResponseCorrectness | undefined = undefined
      let aggregatedResponses: ElementInstanceResults = {
        ...emptyInstanceResults,
      }

      if (instance.elementType === ElementType.CONTENT) {
        // TODO: uncomment
        // const lastDetail = details[details.length - 1]
        // // set correctness parameters, trials, timestamps and time spent
        // trialsCount = details.length
        // lastAnsweredAt = lastDetail.createdAt
        // correctCount = details.length
        // correctCountStreak = details.length
        // lastCorrectAt = lastDetail.createdAt
        // firstResponseCorrectness = ResponseCorrectness.CORRECT
        // lastResponseCorrectness = ResponseCorrectness.CORRECT
        // averageTimeSpent = details.reduce(
        //   (acc, detail) => acc + detail.timeSpent,
        //   0
        // )
        // // compute updated spaced repetition parameters
        // const repetitionParams = details.reduce<{
        //   streak: number
        //   eFactor: number
        //   interval: number
        //   nextDueAt: Date | undefined
        // }>(
        //   (acc, _) => {
        //     acc.streak += 1
        //     const newValues = updateSpacedRepetition({
        //       eFactor: acc.eFactor,
        //       interval: acc.interval,
        //       streak: acc.streak,
        //       grade: 1,
        //     })
        //     acc.eFactor = newValues.eFactor
        //     acc.interval = newValues.interval
        //     acc.nextDueAt = newValues.nextDueAt
        //     return acc
        //   },
        //   {
        //     streak: 0,
        //     eFactor,
        //     interval,
        //     nextDueAt,
        //   }
        // )
        // eFactor = repetitionParams.eFactor
        // interval = repetitionParams.interval
        // nextDueAt = repetitionParams.nextDueAt
        // // update responses
        // firstResponse = { viewed: true }
        // lastResponse = { viewed: true }
        // aggregatedResponses.total = details.length
      } else if (instance.elementType === ElementType.FLASHCARD) {
        // TODO: uncomment
        // const firstDetail = details[0]
        // const lastDetail = details[details.length - 1]
        // // set correctness parameters, trials, timestamps and time spent
        // trialsCount = details.length
        // lastAnsweredAt = lastDetail.createdAt
        // firstResponse = firstDetail.response as SingleQuestionResponseFlashcard
        // lastResponse = lastDetail.response as SingleQuestionResponseFlashcard
        // firstResponseCorrectness =
        //   firstResponse.correctness === FlashcardCorrectness.CORRECT
        //     ? ResponseCorrectness.CORRECT
        //     : firstResponse.correctness === FlashcardCorrectness.PARTIAL
        //       ? ResponseCorrectness.PARTIAL
        //       : ResponseCorrectness.WRONG
        // lastResponseCorrectness =
        //   lastResponse.correctness === FlashcardCorrectness.CORRECT
        //     ? ResponseCorrectness.CORRECT
        //     : lastResponse.correctness === FlashcardCorrectness.PARTIAL
        //       ? ResponseCorrectness.PARTIAL
        //       : ResponseCorrectness.WRONG
        // averageTimeSpent =
        //   details.reduce((acc, detail) => acc + detail.timeSpent, 0) /
        //   details.length
        // // aggregate over all details to compute the total quantities
        // const newValues = details.reduce<{
        //   correctCount: number
        //   correctCountStreak: number
        //   lastCorrectAt: Date | undefined
        //   partialCorrectCount: number
        //   lastPartialCorrectAt: Date | undefined
        //   wrongCount: number
        //   lastWrongAt: Date | undefined
        //   eFactor: number
        //   interval: number
        //   nextDueAt: Date | undefined
        //   aggResponses: FlashcardResults
        // }>(
        //   (acc, detail) => {
        //     const correctness = (
        //       detail.response as SingleQuestionResponseFlashcard
        //     ).correctness
        //     if (correctness === FlashcardCorrectness.CORRECT) {
        //       acc.correctCount += 1
        //       acc.correctCountStreak += 1
        //       acc.lastCorrectAt = detail.createdAt
        //     } else if (correctness === FlashcardCorrectness.PARTIAL) {
        //       acc.partialCorrectCount += 1
        //       acc.lastPartialCorrectAt = detail.createdAt
        //       acc.correctCountStreak = 0
        //     } else if (correctness === FlashcardCorrectness.INCORRECT) {
        //       acc.wrongCount += 1
        //       acc.lastWrongAt = detail.createdAt
        //       acc.correctCountStreak = 0
        //     }
        //     // update spaced repetition parameters
        //     const updatedRepetition = updateSpacedRepetition({
        //       eFactor: acc.eFactor,
        //       interval: acc.interval,
        //       streak: acc.correctCountStreak,
        //       grade: 1,
        //     })
        //     acc.eFactor = updatedRepetition.eFactor
        //     acc.interval = updatedRepetition.interval
        //     acc.nextDueAt = updatedRepetition.nextDueAt
        //     // update aggregated responses
        //     acc.aggResponses.total += 1
        //     if (correctness === FlashcardCorrectness.CORRECT) {
        //       acc.aggResponses.CORRECT += 1
        //     } else if (correctness === FlashcardCorrectness.PARTIAL) {
        //       acc.aggResponses.PARTIAL += 1
        //     } else if (correctness === FlashcardCorrectness.INCORRECT) {
        //       acc.aggResponses.INCORRECT += 1
        //     }
        //     return acc
        //   },
        //   {
        //     correctCount: 0,
        //     correctCountStreak: 0,
        //     lastCorrectAt: undefined,
        //     partialCorrectCount: 0,
        //     lastPartialCorrectAt: undefined,
        //     wrongCount: 0,
        //     lastWrongAt: undefined,
        //     eFactor: 2.5,
        //     interval: 1,
        //     nextDueAt: undefined,
        //     aggResponses: {
        //       ...emptyInstanceResults,
        //     } as FlashcardResults,
        //   }
        // )
        // // set the aggregated values
        // correctCount = newValues.correctCount
        // correctCountStreak = newValues.correctCountStreak
        // lastCorrectAt = newValues.lastCorrectAt
        // partialCorrectCount = newValues.partialCorrectCount
        // lastPartialCorrectAt = newValues.lastPartialCorrectAt
        // wrongCount = newValues.wrongCount
        // lastWrongAt = newValues.lastWrongAt
        // eFactor = newValues.eFactor
        // interval = newValues.interval
        // nextDueAt = newValues.nextDueAt
        // aggregatedResponses = newValues.aggResponses
      } else if (
        instance.elementType === ElementType.SC ||
        instance.elementType === ElementType.MC ||
        instance.elementType === ElementType.KPRIM
      ) {
        const firstDetail = details[0]
        firstResponse = firstDetail.response as SingleQuestionResponseChoices
        const lastDetail = details[details.length - 1]
        lastResponse = lastDetail.response as SingleQuestionResponseChoices

        // set correctness parameters, trials, timestamps and time spent
        trialsCount = details.length
        lastAnsweredAt = lastDetail.createdAt

        // evaluate first and last answer correctness
        const firstCorrect = evaluateAnswerCorrectness({
          elementData: instance.elementData,
          response: lastResponse,
        })
        const lastCorrect = evaluateAnswerCorrectness({
          elementData: instance.elementData,
          response: lastResponse,
        })
        firstResponseCorrectness =
          firstCorrect === 1
            ? ResponseCorrectness.CORRECT
            : firstCorrect === 0
              ? ResponseCorrectness.WRONG
              : ResponseCorrectness.PARTIAL
        lastResponseCorrectness =
          lastCorrect === 1
            ? ResponseCorrectness.CORRECT
            : firstCorrect === 0
              ? ResponseCorrectness.WRONG
              : ResponseCorrectness.PARTIAL
        averageTimeSpent =
          details.reduce((acc, detail) => acc + detail.timeSpent, 0) /
          details.length

        // TODO: DO AGGREGATION
        const newValues = details.reduce<{
          totalScore: number
          totalPointsAwarded: number
          totalXpAwarded: number
          lastAwardedAt: Date | undefined
          lastXpAwardedAt: Date | undefined
          correctCount: number
          correctCountStreak: number
          lastCorrectAt: Date | undefined
          partialCorrectCount: number
          lastPartialCorrectAt: Date | undefined
          wrongCount: number
          lastWrongAt: Date | undefined
          eFactor: number
          interval: number
          nextDueAt: Date | undefined
          aggResponses: ElementResultsChoices
        }>(
          (acc, detail) => {
            // compute correctness
            const multiplier = instance.options.pointsMultiplier
            const correctness =
              evaluateAnswerCorrectness({
                elementData: instance.elementData,
                response: detail.response,
              }) ?? 0

            // update the score, correctness counters, etc.
            const score = computeSimpleAwardedPoints({
              points: POINTS_PER_INSTANCE,
              pointsPercentage: correctness,
              pointsMultiplier: multiplier,
            })
            const xp = computeAwardedXp({
              pointsPercentage: correctness,
            })

            acc.totalScore += score
            acc.correctCount += correctness === 1 ? 1 : 0
            acc.correctCountStreak =
              correctness === 1 ? acc.correctCountStreak + 1 : 0
            acc.lastCorrectAt =
              correctness === 1 ? detail.createdAt : acc.lastCorrectAt

            // TODO: continue from here onwards
            partialCorrectCount += correctness > 0 && correctness < 1 ? 1 : 0
            lastPartialCorrectAt =
              correctness > 0 && correctness < 1
                ? detail.createdAt
                : lastPartialCorrectAt

            // TODO: REQUIRED UPDATES
            // totalPointsAwarded: number
            // lastAwardedAt: Date | undefined
            // totalXpAwarded: number
            // lastXpAwardedAt: Date | undefined
            // partialCorrectCount: number
            // lastPartialCorrectAt: Date | undefined
            // wrongCount: number
            // lastWrongAt: Date | undefined
            // eFactor: number
            // interval: number
            // nextDueAt: Date | undefined
            // aggResponses: ElementResultsChoices

            return acc
          },
          {
            totalScore: 0,
            totalPointsAwarded: 0,
            totalXpAwarded: 0,
            lastAwardedAt: undefined,
            lastXpAwardedAt: undefined,
            correctCount: 0,
            correctCountStreak: 0,
            lastCorrectAt: undefined,
            partialCorrectCount: 0,
            lastPartialCorrectAt: undefined,
            wrongCount: 0,
            lastWrongAt: undefined,
            eFactor: 2.5,
            interval: 1,
            nextDueAt: undefined,
            aggResponses: {
              ...emptyInstanceResults,
            } as ElementResultsChoices,
          }
        )

        // set the aggregated values
        totalScore = newValues.totalScore
        totalPointsAwarded = newValues.totalPointsAwarded
        totalXpAwarded = newValues.totalXpAwarded
        lastAwardedAt = newValues.lastAwardedAt
        lastXpAwardedAt = newValues.lastXpAwardedAt

        correctCount = newValues.correctCount
        correctCountStreak = newValues.correctCountStreak
        lastCorrectAt = newValues.lastCorrectAt
        partialCorrectCount = newValues.partialCorrectCount
        lastPartialCorrectAt = newValues.lastPartialCorrectAt
        wrongCount = newValues.wrongCount
        lastWrongAt = newValues.lastWrongAt
        eFactor = newValues.eFactor
        interval = newValues.interval
        nextDueAt = newValues.nextDueAt
        aggregatedResponses = newValues.aggResponses
      } else if (instance.elementType === ElementType.NUMERICAL) {
        // TODO
      } else if (instance.elementType === ElementType.FREE_TEXT) {
        // TODO
      }

      // TODO: check if the previous values of the question response content are identical and if so, skip the update
      // TODO: keep in mind here that the values set on practice quizzes and microlearnings differ
    }

    // ! If any updates are required, update responses, details
    // ! and results in a transaction for each element instance
    // TODO: depending on the use in practice quiz or microlearning, only set specific fields on the question response
  }
}

await run()

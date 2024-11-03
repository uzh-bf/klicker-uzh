import {
  computeAwardedXp,
  computeSimpleAwardedPoints,
} from '@klicker-uzh/grading'
import {
  ElementInstance,
  ElementInstanceType,
  ElementType,
  InstanceStatistics,
  PrismaClient,
  QuestionResponse,
  QuestionResponseDetail,
  ResponseCorrectness,
} from '@klicker-uzh/prisma'
import {
  ElementInstanceResults,
  ElementResultsChoices,
  ElementResultsOpen,
  FlashcardCorrectness,
  FlashcardResults,
  SingleQuestionResponse,
  SingleQuestionResponseChoices,
  SingleQuestionResponseFlashcard,
  SingleQuestionResponseValue,
} from '@klicker-uzh/types'
import { getInitialElementResults } from '@klicker-uzh/util'
import dayjs from 'dayjs'
import { createHash } from 'node:crypto'
import { isDeepEqual, prop, sortBy, toLowerCase } from 'remeda'
import {
  evaluateAnswerCorrectness,
  updateSpacedRepetition,
} from '../services/practiceQuizzes'

// TODO: once available, update this script with the helper functions from the stacks service
const POINTS_PER_INSTANCE = 10
const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

// ? Flag for extended logging
const verbose = true

function computeDetailUpdate({
  detail,
  newValues,
}: {
  detail: QuestionResponseDetail
  newValues: {
    score: number
    pointsAwarded: number | undefined
    xpAwarded: number
    timeSpent: number
  }
}) {
  let updateReq = false

  // check if the stored values are correct
  if (verbose) {
    if (
      typeof newValues.score !== 'undefined' &&
      detail.score !== newValues.score
    ) {
      console.log('Score not identical:', detail.score, newValues.score)
    }
    if (
      detail.pointsAwarded !== null &&
      typeof newValues.pointsAwarded !== 'undefined' &&
      detail.pointsAwarded !== newValues.pointsAwarded
    ) {
      console.log(
        'PointsAwarded not identical:',
        detail.pointsAwarded,
        newValues.pointsAwarded
      )
    }
    if (
      typeof newValues.xpAwarded !== 'undefined' &&
      detail.xpAwarded !== newValues.xpAwarded
    ) {
      console.log(
        'XpAwarded not identical:',
        detail.xpAwarded,
        newValues.xpAwarded
      )
    }
    if (
      typeof newValues.timeSpent !== 'undefined' &&
      detail.timeSpent !== newValues.timeSpent
    ) {
      console.log(
        'TimeSpent not identical:',
        detail.timeSpent,
        newValues.timeSpent
      )
    }
  }

  updateReq =
    updateReq ||
    (typeof newValues.score !== 'undefined' && detail.score !== newValues.score)
  updateReq =
    updateReq ||
    (detail.pointsAwarded !== null &&
      typeof newValues.pointsAwarded !== 'undefined' &&
      detail.pointsAwarded !== newValues.pointsAwarded)
  updateReq =
    updateReq ||
    (typeof newValues.xpAwarded !== 'undefined' &&
      detail.xpAwarded !== newValues.xpAwarded)
  updateReq =
    updateReq ||
    (typeof newValues.timeSpent !== 'undefined' &&
      detail.timeSpent !== newValues.timeSpent)

  if (updateReq) {
    if (verbose) {
      console.log('Detail update required')
      console.log('PREVIOUS:')
      console.log(detail)
      console.log('NEW:')
      console.log(newValues)
    }

    return {
      where: {
        id: detail.id,
      },
      data: {
        score: newValues.score,
        pointsAwarded: newValues.pointsAwarded,
        xpAwarded: newValues.xpAwarded,
        timeSpent: newValues.timeSpent,
      },
    }
  } else {
    return undefined
  }
}

function computeResponseUpdate({
  response,
  newValues,
}: {
  response: QuestionResponse
  newValues: {
    trialsCount: number
    totalScore: number
    totalPointsAwarded: number | undefined
    totalXpAwarded: number
    averageTimeSpent: number
    lastAwardedAt: Date | undefined
    lastXpAwardedAt: Date | undefined
    lastAnsweredAt: Date | undefined
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
    firstResponse: SingleQuestionResponse | undefined
    firstResponseCorrectness: ResponseCorrectness | undefined
    lastResponse: SingleQuestionResponse | undefined
    lastResponseCorrectness: ResponseCorrectness | undefined
    aggregatedResponses: ElementInstanceResults
  }
}) {
  let updateReq = false

  if (verbose) {
    if (
      typeof newValues.trialsCount !== 'undefined' &&
      response.trialsCount !== newValues.trialsCount
    ) {
      console.log(
        'trialsCount not identical:',
        response.trialsCount,
        newValues.trialsCount
      )
    }
    if (
      typeof newValues.totalScore !== 'undefined' &&
      response.totalScore !== newValues.totalScore
    ) {
      console.log(
        'totalScore not identical:',
        response.totalScore,
        newValues.totalScore
      )
    }
    if (
      response.totalPointsAwarded !== null &&
      typeof newValues.totalPointsAwarded !== 'undefined' &&
      response.totalPointsAwarded !== newValues.totalPointsAwarded
    ) {
      console.log(
        'totalPointsAwarded not identical:',
        response.totalPointsAwarded,
        newValues.totalPointsAwarded
      )
    }
    if (
      typeof newValues.averageTimeSpent !== 'undefined' &&
      response.averageTimeSpent !== newValues.averageTimeSpent
    ) {
      console.log(
        'averageTimeSpent not identical:',
        response.averageTimeSpent,
        newValues.averageTimeSpent
      )
    }
    if (
      typeof newValues.correctCount !== 'undefined' &&
      response.correctCount !== newValues.correctCount
    ) {
      console.log(
        'correctCount not identical:',
        response.correctCount,
        newValues.correctCount
      )
    }
    if (
      typeof newValues.correctCountStreak !== 'undefined' &&
      response.correctCountStreak !== newValues.correctCountStreak
    ) {
      console.log(
        'correctCountStreak not identical:',
        response.correctCountStreak,
        newValues.correctCountStreak
      )
    }
    if (
      typeof newValues.partialCorrectCount !== 'undefined' &&
      response.partialCorrectCount !== newValues.partialCorrectCount
    ) {
      console.log(
        'partialCorrectCount not identical:',
        response.partialCorrectCount,
        newValues.partialCorrectCount
      )
    }
    if (
      typeof newValues.wrongCount !== 'undefined' &&
      response.wrongCount !== newValues.wrongCount
    ) {
      console.log(
        'wrongCount not identical:',
        response.wrongCount,
        newValues.wrongCount
      )
    }
    if (
      typeof newValues.eFactor !== 'undefined' &&
      response.eFactor !== newValues.eFactor
    ) {
      console.log('eFactor not identical:', response.eFactor, newValues.eFactor)
    }
    if (
      typeof newValues.interval !== 'undefined' &&
      response.interval !== newValues.interval
    ) {
      console.log(
        'interval not identical:',
        response.interval,
        newValues.interval
      )
    }
    if (
      typeof newValues.firstResponse !== 'undefined' &&
      !isDeepEqual(response.firstResponse, newValues.firstResponse)
    ) {
      console.log(
        'firstResponse not identical:',
        response.firstResponse,
        newValues.firstResponse
      )
    }
    if (
      typeof newValues.firstResponseCorrectness !== 'undefined' &&
      response.firstResponseCorrectness !== newValues.firstResponseCorrectness
    ) {
      console.log(
        'firstResponseCorrectness not identical:',
        response.firstResponseCorrectness,
        newValues.firstResponseCorrectness
      )
    }
    if (
      typeof newValues.lastResponse !== 'undefined' &&
      !isDeepEqual(response.lastResponse, newValues.lastResponse)
    ) {
      console.log(
        'lastResponse not identical:',
        response.lastResponse,
        newValues.lastResponse
      )
    }
    if (
      typeof newValues.lastResponseCorrectness !== 'undefined' &&
      response.lastResponseCorrectness !== newValues.lastResponseCorrectness
    ) {
      console.log(
        'lastResponseCorrectness not identical:',
        response.lastResponseCorrectness,
        newValues.lastResponseCorrectness
      )
    }
    if (
      !isDeepEqual(response.aggregatedResponses, newValues.aggregatedResponses)
    ) {
      console.log(
        'aggregatedResponses not identical:',
        response.aggregatedResponses,
        newValues.aggregatedResponses
      )
    }
  }

  updateReq =
    updateReq ||
    (typeof newValues.trialsCount !== 'undefined' &&
      response.trialsCount !== newValues.trialsCount)
  updateReq =
    updateReq ||
    (typeof newValues.totalScore !== 'undefined' &&
      response.totalScore !== newValues.totalScore)
  updateReq =
    updateReq ||
    (response.totalPointsAwarded !== null &&
      typeof newValues.totalPointsAwarded !== 'undefined' &&
      response.totalPointsAwarded !== newValues.totalPointsAwarded)
  updateReq =
    updateReq ||
    (typeof newValues.averageTimeSpent !== 'undefined' &&
      response.averageTimeSpent !== newValues.averageTimeSpent)
  updateReq =
    updateReq ||
    (typeof newValues.correctCount !== 'undefined' &&
      response.correctCount !== newValues.correctCount)
  updateReq =
    updateReq ||
    (typeof newValues.correctCountStreak !== 'undefined' &&
      response.correctCountStreak !== newValues.correctCountStreak)
  updateReq =
    updateReq ||
    (typeof newValues.partialCorrectCount !== 'undefined' &&
      response.partialCorrectCount !== newValues.partialCorrectCount)
  updateReq =
    updateReq ||
    (typeof newValues.wrongCount !== 'undefined' &&
      response.wrongCount !== newValues.wrongCount)
  updateReq =
    updateReq ||
    (typeof newValues.eFactor !== 'undefined' &&
      response.eFactor !== newValues.eFactor)
  updateReq =
    updateReq ||
    (typeof newValues.interval !== 'undefined' &&
      response.interval !== newValues.interval)
  updateReq =
    updateReq ||
    (typeof newValues.firstResponse !== 'undefined' &&
      !isDeepEqual(response.firstResponse, newValues.firstResponse))
  updateReq =
    updateReq ||
    (typeof newValues.firstResponseCorrectness !== 'undefined' &&
      response.firstResponseCorrectness !== newValues.firstResponseCorrectness)
  updateReq =
    updateReq ||
    (typeof newValues.lastResponse !== 'undefined' &&
      !isDeepEqual(response.lastResponse, newValues.lastResponse))
  updateReq =
    updateReq ||
    (typeof newValues.lastResponseCorrectness !== 'undefined' &&
      response.lastResponseCorrectness !== newValues.lastResponseCorrectness)
  updateReq =
    updateReq ||
    !isDeepEqual(response.aggregatedResponses, newValues.aggregatedResponses)

  if (updateReq) {
    if (verbose) {
      console.log('Response update required')
      console.log('PREVIOUS:')
      console.log(response)
      console.log('NEW:')
      console.log(newValues)
    }

    return {
      where: {
        id: response.id,
      },
      data: {
        trialsCount: newValues.trialsCount,
        totalScore: newValues.totalScore,
        totalPointsAwarded: newValues.totalPointsAwarded,
        totalXpAwarded: newValues.totalXpAwarded,
        averageTimeSpent: newValues.averageTimeSpent,
        lastAwardedAt: newValues.lastAwardedAt,
        lastXpAwardedAt: newValues.lastXpAwardedAt,
        lastAnsweredAt: newValues.lastAnsweredAt,
        correctCount: newValues.correctCount,
        correctCountStreak: newValues.correctCountStreak,
        lastCorrectAt: newValues.lastCorrectAt,
        partialCorrectCount: newValues.partialCorrectCount,
        lastPartialCorrectAt: newValues.lastPartialCorrectAt,
        wrongCount: newValues.wrongCount,
        lastWrongAt: newValues.lastWrongAt,
        eFactor: newValues.eFactor,
        interval: newValues.interval,
        nextDueAt: newValues.nextDueAt,
        firstResponse: newValues.firstResponse,
        firstResponseCorrectness: newValues.firstResponseCorrectness,
        lastResponse: newValues.lastResponse,
        lastResponseCorrectness: newValues.lastResponseCorrectness,
        aggregatedResponses: newValues.aggregatedResponses,
      },
    }
  } else {
    return undefined
  }
}

function computeInstanceUpdate({
  instance,
  newValues,
}: {
  instance: ElementInstance & { instanceStatistics: InstanceStatistics }
  newValues: {
    results: ElementInstanceResults
    correctCount: number
    partialCorrectCount: number
    wrongCount: number
    firstCorrectCount: number | undefined
    firstPartialCorrectCount: number | undefined
    firstWrongCount: number | undefined
    lastCorrectCount: number | undefined
    lastPartialCorrectCount: number | undefined
    lastWrongCount: number | undefined
    uniqueParticipantCount: number
    averageTimeSpent: number | undefined
  }
}) {
  const stats = instance.instanceStatistics
  let updateReq = false

  if (instance.type === ElementInstanceType.PRACTICE_QUIZ) {
    if (verbose) {
      if (!isDeepEqual(instance.results, newValues.results)) {
        console.log(
          'Instance results not identical:',
          instance.results,
          newValues.results
        )
      }
      if (stats.correctCount !== newValues.correctCount) {
        console.log(
          'Correct count not identical:',
          stats.correctCount,
          newValues.correctCount
        )
      }
      if (stats.partialCorrectCount !== newValues.partialCorrectCount) {
        console.log(
          'Partial correct count not identical:',
          stats.partialCorrectCount,
          newValues.partialCorrectCount
        )
      }
      if (stats.wrongCount !== newValues.wrongCount) {
        console.log(
          'Wrong count not identical:',
          stats.wrongCount,
          newValues.wrongCount
        )
      }
      if (stats.firstCorrectCount !== newValues.firstCorrectCount) {
        console.log(
          'First correct count not identical:',
          stats.firstCorrectCount,
          newValues.firstCorrectCount
        )
      }
      if (
        stats.firstPartialCorrectCount !== newValues.firstPartialCorrectCount
      ) {
        console.log(
          'First partial correct count not identical:',
          stats.firstPartialCorrectCount,
          newValues.firstPartialCorrectCount
        )
      }
      if (stats.firstWrongCount !== newValues.firstWrongCount) {
        console.log(
          'First wrong count not identical:',
          stats.firstWrongCount,
          newValues.firstWrongCount
        )
      }
      if (stats.lastCorrectCount !== newValues.lastCorrectCount) {
        console.log(
          'Last correct count not identical:',
          stats.lastCorrectCount,
          newValues.lastCorrectCount
        )
      }
      if (stats.lastPartialCorrectCount !== newValues.lastPartialCorrectCount) {
        console.log(
          'Last partial correct count not identical:',
          stats.lastPartialCorrectCount,
          newValues.lastPartialCorrectCount
        )
      }
      if (stats.lastWrongCount !== newValues.lastWrongCount) {
        console.log(
          'Last wrong count not identical:',
          stats.lastWrongCount,
          newValues.lastWrongCount
        )
      }
      if (stats.uniqueParticipantCount !== newValues.uniqueParticipantCount) {
        console.log(
          'Unique participant count not identical:',
          stats.uniqueParticipantCount,
          newValues.uniqueParticipantCount
        )
      }
      if (stats.averageTimeSpent !== newValues.averageTimeSpent) {
        console.log(
          'Average time spent not identical:',
          stats.averageTimeSpent,
          newValues.averageTimeSpent
        )
      }
    }

    updateReq = updateReq || !isDeepEqual(instance.results, newValues.results)
    updateReq =
      updateReq ||
      (typeof newValues.correctCount !== 'undefined' &&
        stats.correctCount !== newValues.correctCount)
    updateReq =
      updateReq ||
      (typeof newValues.partialCorrectCount !== 'undefined' &&
        stats.partialCorrectCount !== newValues.partialCorrectCount)
    updateReq =
      updateReq ||
      (typeof newValues.wrongCount !== 'undefined' &&
        stats.wrongCount !== newValues.wrongCount)
    updateReq =
      updateReq ||
      (typeof newValues.uniqueParticipantCount !== 'undefined' &&
        stats.uniqueParticipantCount !== newValues.uniqueParticipantCount)
    updateReq =
      updateReq ||
      (typeof newValues.averageTimeSpent !== 'undefined' &&
        stats.averageTimeSpent !== newValues.averageTimeSpent)

    if (updateReq) {
      if (verbose) {
        console.log('Microlearning instance update required')
        console.log('PREVIOUS:')
        console.log({ results: instance.results, stats })
        console.log('NEW:')
        console.log({ results: newValues.results, stats: newValues })
      }

      return {
        id: instance.id,
        data: {
          results: newValues.results,
          instanceStatistics: {
            update: {
              correctCount: newValues.correctCount,
              partialCorrectCount: newValues.partialCorrectCount,
              wrongCount: newValues.wrongCount,
              uniqueParticipantCount: newValues.uniqueParticipantCount,
              averageTimeSpent: newValues.averageTimeSpent,
            },
          },
        },
      }
    } else {
      return undefined
    }
  }

  return undefined
}

// ! CAUTION: This script does not update the leaderboard entries of the participants
// ? This script will iterate through all element instances and
// ? update the question responses and question response details
async function run() {
  const prisma = new PrismaClient()
  const MD5 = createHash('md5')
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
      responses: { include: { participation: true } },
      detailResponses: { include: { participant: true } },
      element: true,
      instanceStatistics: true,
    },
  })

  for (const instance of instances) {
    counter += 1
    console.log('PROCESSING INSTANCE', counter, 'OF', instances.length)

    // ! Initialization
    const emptyInstanceResults = getInitialElementResults(instance.element)
    let instanceResults = { ...emptyInstanceResults }

    // ! Response and Result Updates
    const detailUpdates: any[] = []
    const responseUpdates: any[] = []
    const instanceUpdates: any[] = []

    // group responses and details by participant (format: { participantId: { response, detail[] }, ... })
    const participantResponses = instance.responses.reduce<
      Record<
        string,
        {
          response: QuestionResponse
          details: QuestionResponseDetail[]
          participationActive: boolean
        }
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
        participationActive: response.participation?.isActive ?? false,
      }
      return acc
    }, {})

    // track counts on instance level for instance results and statistics update
    let instanceCorrectCount = 0
    let instancePartialCorrectCount = 0
    let instanceWrongCount = 0
    let instanceFirstCorrectCount: number | undefined = undefined
    let instanceFirstPartialCorrectCount: number | undefined = undefined
    let instanceFirstWrongCount: number | undefined = undefined
    let instanceLastCorrectCount: number | undefined = undefined
    let instanceLastPartialCorrectCount: number | undefined = undefined
    let instanceLastWrongCount: number | undefined = undefined

    let instanceUniqueParticipantCount = 0
    let instanceAverageTimeSpent: number | undefined = undefined

    for (const [
      participantId,
      { response, details, participationActive },
    ] of Object.entries(participantResponses)) {
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

      // compute average times
      // (floor required due to the way prisma handles float to int conversion)
      const res = details.reduce<{ avgTime: number; counter: number }>(
        (acc, detail) => {
          acc.avgTime = Math.floor(
            (acc.avgTime * acc.counter + detail.timeSpent) / (acc.counter + 1)
          )
          acc.counter += 1
          return acc
        },
        { avgTime: 0, counter: 0 }
      )
      averageTimeSpent = res.avgTime

      // increase aggregated instance values
      // (floor required due to the way prisma handles float to int conversion)
      instanceUniqueParticipantCount += 1
      instanceAverageTimeSpent = Math.floor(
        ((instanceAverageTimeSpent ?? 0) *
          (instanceUniqueParticipantCount - 1) +
          averageTimeSpent) /
          instanceUniqueParticipantCount
      )

      if (instance.elementType === ElementType.CONTENT) {
        const lastDetail = details[details.length - 1]

        // set correctness parameters, trials, timestamps and time spent
        trialsCount = details.length
        lastAnsweredAt = lastDetail.createdAt
        correctCount = details.length
        correctCountStreak = details.length
        lastCorrectAt = lastDetail.createdAt
        firstResponseCorrectness = ResponseCorrectness.CORRECT
        lastResponseCorrectness = ResponseCorrectness.CORRECT

        // compute updated spaced repetition parameters
        const repetitionParams = details.reduce<{
          streak: number
          eFactor: number
          interval: number
          nextDueAt: Date | undefined
        }>(
          (acc, detail) => {
            acc.streak += 1
            const newValues = updateSpacedRepetition({
              eFactor: acc.eFactor,
              interval: acc.interval,
              streak: acc.streak,
              grade: 1,
            })
            acc.eFactor = newValues.eFactor
            acc.interval = newValues.interval
            acc.nextDueAt = dayjs(detail.createdAt)
              .add(acc.interval, 'day')
              .toDate()
            return acc
          },
          {
            streak: 0,
            eFactor,
            interval,
            nextDueAt,
          }
        )
        eFactor = repetitionParams.eFactor
        interval = repetitionParams.interval
        nextDueAt = repetitionParams.nextDueAt

        // update responses
        firstResponse = { viewed: true }
        lastResponse = { viewed: true }
        aggregatedResponses.total = details.length

        // update instance results
        instanceResults.total += details.length
      } else if (
        instance.elementType === ElementType.FLASHCARD &&
        FlashcardCorrectness.CORRECT in instanceResults &&
        FlashcardCorrectness.PARTIAL in instanceResults &&
        FlashcardCorrectness.INCORRECT in instanceResults
      ) {
        const firstDetail = details[0]
        const lastDetail = details[details.length - 1]
        // set correctness parameters, trials, timestamps and time spent
        trialsCount = details.length
        lastAnsweredAt = lastDetail.createdAt
        firstResponse = firstDetail.response as SingleQuestionResponseFlashcard
        lastResponse = lastDetail.response as SingleQuestionResponseFlashcard
        firstResponseCorrectness =
          firstResponse.correctness === FlashcardCorrectness.CORRECT
            ? ResponseCorrectness.CORRECT
            : firstResponse.correctness === FlashcardCorrectness.PARTIAL
              ? ResponseCorrectness.PARTIAL
              : ResponseCorrectness.WRONG
        lastResponseCorrectness =
          lastResponse.correctness === FlashcardCorrectness.CORRECT
            ? ResponseCorrectness.CORRECT
            : lastResponse.correctness === FlashcardCorrectness.PARTIAL
              ? ResponseCorrectness.PARTIAL
              : ResponseCorrectness.WRONG

        // aggregate over all details to compute the total quantities
        const newValues = details.reduce<{
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
          aggResponses: FlashcardResults
        }>(
          (acc, detail) => {
            const correctness = (
              detail.response as SingleQuestionResponseFlashcard
            ).correctness
            if (correctness === FlashcardCorrectness.CORRECT) {
              acc.correctCount += 1
              acc.correctCountStreak += 1
              acc.lastCorrectAt = detail.createdAt
            } else if (correctness === FlashcardCorrectness.PARTIAL) {
              acc.partialCorrectCount += 1
              acc.lastPartialCorrectAt = detail.createdAt
              acc.correctCountStreak = 0
            } else if (correctness === FlashcardCorrectness.INCORRECT) {
              acc.wrongCount += 1
              acc.lastWrongAt = detail.createdAt
              acc.correctCountStreak = 0
            }

            // update spaced repetition parameters
            const updatedRepetition = updateSpacedRepetition({
              eFactor: acc.eFactor,
              interval: acc.interval,
              streak: acc.correctCountStreak,
              grade:
                correctness === FlashcardCorrectness.CORRECT
                  ? 1
                  : correctness === FlashcardCorrectness.PARTIAL
                    ? 0.5
                    : 0,
            })
            acc.eFactor = updatedRepetition.eFactor
            acc.interval = updatedRepetition.interval
            acc.nextDueAt = dayjs(detail.createdAt)
              .add(acc.interval, 'day')
              .toDate()
            // update aggregated responses
            acc.aggResponses.total += 1
            if (correctness === FlashcardCorrectness.CORRECT) {
              acc.aggResponses.CORRECT += 1
            } else if (correctness === FlashcardCorrectness.PARTIAL) {
              acc.aggResponses.PARTIAL += 1
            } else if (correctness === FlashcardCorrectness.INCORRECT) {
              acc.aggResponses.INCORRECT += 1
            }
            return acc
          },
          {
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
            } as FlashcardResults,
          }
        )

        // set the aggregated values
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

        // update instance results
        instanceResults[FlashcardCorrectness.CORRECT] += correctCount
        instanceResults[FlashcardCorrectness.PARTIAL] += partialCorrectCount
        instanceResults[FlashcardCorrectness.INCORRECT] += wrongCount
        instanceResults.total += trialsCount
      } else if (
        (instance.elementType === ElementType.SC ||
          instance.elementType === ElementType.MC ||
          instance.elementType === ElementType.KPRIM) &&
        'choices' in instanceResults
      ) {
        const multiplier = instance.options.pointsMultiplier
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
          response: firstResponse,
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

            acc.partialCorrectCount +=
              correctness > 0 && correctness < 1 ? 1 : 0
            acc.lastPartialCorrectAt =
              correctness > 0 && correctness < 1
                ? detail.createdAt
                : acc.lastPartialCorrectAt

            acc.wrongCount += correctness === 0 ? 1 : 0
            acc.lastWrongAt =
              correctness === 0 ? detail.createdAt : acc.lastWrongAt

            // check if points and xp are awarded and set attributes
            const newPoints =
              typeof acc.lastAwardedAt !== 'undefined'
                ? dayjs(acc.lastAwardedAt).isBefore(
                    dayjs().subtract(
                      instance.options.resetTimeDays ??
                        POINTS_AWARD_TIMEFRAME_DAYS,
                      'days'
                    )
                  )
                : true
            const newXP =
              typeof acc.lastXpAwardedAt !== 'undefined'
                ? dayjs(acc.lastXpAwardedAt).isBefore(
                    dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
                  )
                : true

            if (newPoints && participationActive) {
              acc.totalPointsAwarded += score
              acc.lastAwardedAt = detail.createdAt
            }
            if (newXP) {
              acc.totalXpAwarded += xp
              acc.lastXpAwardedAt = detail.createdAt
            }

            // update spaced repetition parameters
            const newValues = updateSpacedRepetition({
              eFactor: acc.eFactor,
              interval: acc.interval,
              streak: acc.correctCountStreak,
              grade: correctness,
            })
            acc.eFactor = newValues.eFactor
            acc.interval = newValues.interval
            acc.nextDueAt = dayjs(detail.createdAt)
              .add(acc.interval, 'day')
              .toDate()

            // TODO: replace this through helper function once available
            // update aggregated responses
            acc.aggResponses.choices = detail.response.choices.reduce(
              (acc, ix) => ({
                ...acc,
                [ix]: acc[ix]! + 1,
              }),
              acc.aggResponses.choices
            )
            acc.aggResponses.total = acc.aggResponses.total + 1

            // update instance results
            instanceResults.choices = detail.response.choices.reduce(
              (acc, ix) => ({
                ...acc,
                [ix]: acc[ix]! + 1,
              }),
              (instanceResults as ElementResultsChoices).choices
            )

            // check if update of detail response is required
            const detailUpdate = computeDetailUpdate({
              detail,
              newValues: {
                score,
                pointsAwarded: participationActive ? score : undefined,
                xpAwarded: xp,
                timeSpent: detail.timeSpent,
              },
            })
            if (detailUpdate) {
              detailUpdates.push(detailUpdate)
            }

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
      } else if (
        instance.elementType === ElementType.NUMERICAL &&
        'responses' in instanceResults
      ) {
        const multiplier = instance.options.pointsMultiplier
        const firstDetail = details[0]
        firstResponse = firstDetail.response as SingleQuestionResponseValue
        const lastDetail = details[details.length - 1]
        lastResponse = lastDetail.response as SingleQuestionResponseValue

        // set correctness parameters, trials, timestamps and time spent
        trialsCount = details.length
        lastAnsweredAt = lastDetail.createdAt

        // evaluate first and last answer correctness
        const firstCorrect = evaluateAnswerCorrectness({
          elementData: instance.elementData,
          response: firstResponse,
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
          aggResponses: ElementResultsOpen
        }>(
          (acc, detail) => {
            // compute correctness
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

            acc.partialCorrectCount +=
              correctness > 0 && correctness < 1 ? 1 : 0
            acc.lastPartialCorrectAt =
              correctness > 0 && correctness < 1
                ? detail.createdAt
                : acc.lastPartialCorrectAt

            acc.wrongCount += correctness === 0 ? 1 : 0
            acc.lastWrongAt =
              correctness === 0 ? detail.createdAt : acc.lastWrongAt

            // check if points and xp are awarded and set attributes
            const newPoints =
              typeof acc.lastAwardedAt !== 'undefined'
                ? dayjs(acc.lastAwardedAt).isBefore(
                    dayjs().subtract(
                      instance.options.resetTimeDays ??
                        POINTS_AWARD_TIMEFRAME_DAYS,
                      'days'
                    )
                  )
                : true
            const newXP =
              typeof acc.lastXpAwardedAt !== 'undefined'
                ? dayjs(acc.lastXpAwardedAt).isBefore(
                    dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
                  )
                : true

            if (newPoints && participationActive) {
              acc.totalPointsAwarded += score
              acc.lastAwardedAt = detail.createdAt
            }
            if (newXP) {
              acc.totalXpAwarded += xp
              acc.lastXpAwardedAt = detail.createdAt
            }

            // update spaced repetition parameters
            const newValues = updateSpacedRepetition({
              eFactor: acc.eFactor,
              interval: acc.interval,
              streak: acc.correctCountStreak,
              grade: correctness,
            })
            acc.eFactor = newValues.eFactor
            acc.interval = newValues.interval
            acc.nextDueAt = dayjs(detail.createdAt)
              .add(acc.interval, 'day')
              .toDate()

            // TODO: replace this through helper function once available
            // update aggregated responses
            const value = String(parseFloat(detail.response.value))
            MD5.update(value)
            const hashedValue = MD5.digest('hex')

            if (Object.keys(acc.aggResponses.responses).includes(hashedValue)) {
              acc.aggResponses.responses = {
                ...acc.aggResponses.responses,
                [hashedValue]: {
                  ...acc.aggResponses.responses[hashedValue],
                  count: acc.aggResponses.responses[hashedValue].count + 1,
                },
              }
            } else {
              acc.aggResponses.responses = {
                ...acc.aggResponses.responses,
                [hashedValue]: {
                  value: value,
                  count: 1,
                  correct: correctness === 1,
                },
              }
            }
            acc.aggResponses.total = acc.aggResponses.total + 1

            // update instance results
            if (Object.keys(instanceResults.responses).includes(hashedValue)) {
              instanceResults.responses = {
                ...instanceResults.responses,
                [hashedValue]: {
                  ...instanceResults.responses[hashedValue],
                  count: instanceResults.responses[hashedValue].count + 1,
                },
              }
            } else {
              instanceResults.responses = {
                ...instanceResults.responses,
                [hashedValue]: {
                  value: value,
                  count: 1,
                  correct: correctness === 1,
                },
              }
            }
            instanceResults.total = instanceResults.total + 1

            // check if update of detail response is required
            const detailUpdate = computeDetailUpdate({
              detail,
              newValues: {
                score,
                pointsAwarded: score,
                xpAwarded: xp,
                timeSpent: detail.timeSpent,
              },
            })
            if (detailUpdate) {
              detailUpdates.push(detailUpdate)
            }

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
            } as ElementResultsOpen,
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
      } else if (
        instance.elementType === ElementType.FREE_TEXT &&
        'responses' in instanceResults
      ) {
        const multiplier = instance.options.pointsMultiplier
        const firstDetail = details[0]
        firstResponse = firstDetail.response as SingleQuestionResponseValue
        const lastDetail = details[details.length - 1]
        lastResponse = lastDetail.response as SingleQuestionResponseValue

        // set correctness parameters, trials, timestamps and time spent
        trialsCount = details.length
        lastAnsweredAt = lastDetail.createdAt

        // evaluate first and last answer correctness
        const firstCorrect = evaluateAnswerCorrectness({
          elementData: instance.elementData,
          response: firstResponse,
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
          aggResponses: ElementResultsOpen
        }>(
          (acc, detail) => {
            // compute correctness
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

            acc.partialCorrectCount +=
              correctness > 0 && correctness < 1 ? 1 : 0
            acc.lastPartialCorrectAt =
              correctness > 0 && correctness < 1
                ? detail.createdAt
                : acc.lastPartialCorrectAt

            acc.wrongCount += correctness === 0 ? 1 : 0
            acc.lastWrongAt =
              correctness === 0 ? detail.createdAt : acc.lastWrongAt

            // check if points and xp are awarded and set attributes
            const newPoints =
              typeof acc.lastAwardedAt !== 'undefined'
                ? dayjs(acc.lastAwardedAt).isBefore(
                    dayjs().subtract(
                      instance.options.resetTimeDays ??
                        POINTS_AWARD_TIMEFRAME_DAYS,
                      'days'
                    )
                  )
                : true
            const newXP =
              typeof acc.lastXpAwardedAt !== 'undefined'
                ? dayjs(acc.lastXpAwardedAt).isBefore(
                    dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
                  )
                : true

            if (newPoints && participationActive) {
              acc.totalPointsAwarded += score
              acc.lastAwardedAt = detail.createdAt
            }
            if (newXP) {
              acc.totalXpAwarded += xp
              acc.lastXpAwardedAt = detail.createdAt
            }

            // update spaced repetition parameters
            const newValues = updateSpacedRepetition({
              eFactor: acc.eFactor,
              interval: acc.interval,
              streak: acc.correctCountStreak,
              grade: correctness,
            })
            acc.eFactor = newValues.eFactor
            acc.interval = newValues.interval
            acc.nextDueAt = dayjs(detail.createdAt)
              .add(acc.interval, 'day')
              .toDate()

            // TODO: replace this through helper function once available
            // update aggregated responses
            const value = toLowerCase(detail.response.value.trim())
            MD5.update(value)
            const hashedValue = MD5.digest('hex')

            if (Object.keys(acc.aggResponses.responses).includes(hashedValue)) {
              acc.aggResponses.responses = {
                ...acc.aggResponses.responses,
                [hashedValue]: {
                  ...acc.aggResponses.responses[hashedValue]!,
                  count: acc.aggResponses.responses[hashedValue]!.count + 1,
                },
              }
            } else {
              acc.aggResponses.responses = {
                ...acc.aggResponses.responses,
                [hashedValue]: {
                  value: value,
                  count: 1,
                  correct: correctness === 1,
                },
              }
            }
            acc.aggResponses.total = acc.aggResponses.total + 1

            // update instance results
            if (Object.keys(instanceResults.responses).includes(hashedValue)) {
              instanceResults.responses = {
                ...instanceResults.responses,
                [hashedValue]: {
                  ...instanceResults.responses[hashedValue]!,
                  count: instanceResults.responses[hashedValue]!.count + 1,
                },
              }
            } else {
              instanceResults.responses = {
                ...instanceResults.responses,
                [hashedValue]: {
                  value: value,
                  count: 1,
                  correct: correctness === 1,
                },
              }
            }
            instanceResults.total = instanceResults.total + 1

            // check if update of detail response is required
            const detailUpdate = computeDetailUpdate({
              detail,
              newValues: {
                score,
                pointsAwarded: score,
                xpAwarded: xp,
                timeSpent: detail.timeSpent,
              },
            })
            if (detailUpdate) {
              detailUpdates.push(detailUpdate)
            }

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
            } as ElementResultsOpen,
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
      } else {
        throw new Error(
          `Unsupported element type or missing results for element instance ${instance.id} with type ${instance.elementType}`
        )
      }

      // update question response, if the content is different
      // (if participation is not active, do not update awarded points in any case)
      const responseUpdate = computeResponseUpdate({
        response,
        newValues: {
          trialsCount,
          totalScore,
          totalPointsAwarded: participationActive
            ? totalPointsAwarded
            : undefined,
          totalXpAwarded,
          averageTimeSpent,
          lastAwardedAt: participationActive ? lastAwardedAt : undefined,
          lastXpAwardedAt,
          lastAnsweredAt,
          correctCount,
          correctCountStreak,
          lastCorrectAt,
          partialCorrectCount,
          lastPartialCorrectAt,
          wrongCount,
          lastWrongAt,
          eFactor,
          interval,
          nextDueAt,
          firstResponse,
          firstResponseCorrectness,
          lastResponse,
          lastResponseCorrectness,
          aggregatedResponses,
        },
      })
      if (responseUpdate) {
        responseUpdates.push(responseUpdate)
      }

      // update instance counts
      instanceCorrectCount += correctCount
      instancePartialCorrectCount += partialCorrectCount
      instanceWrongCount += wrongCount

      instanceFirstCorrectCount =
        (instanceFirstCorrectCount ?? 0) +
        (firstResponseCorrectness === ResponseCorrectness.CORRECT ? 1 : 0)
      instanceFirstPartialCorrectCount =
        (instanceFirstPartialCorrectCount ?? 0) +
        (firstResponseCorrectness === ResponseCorrectness.PARTIAL ? 1 : 0)
      instanceFirstWrongCount =
        (instanceFirstWrongCount ?? 0) +
        (firstResponseCorrectness === ResponseCorrectness.WRONG ? 1 : 0)

      instanceLastCorrectCount =
        (instanceLastCorrectCount ?? 0) +
        (lastResponseCorrectness! === ResponseCorrectness.CORRECT ? 1 : 0)
      instanceLastPartialCorrectCount =
        (instanceLastPartialCorrectCount ?? 0) +
        (lastResponseCorrectness! === ResponseCorrectness.PARTIAL ? 1 : 0)
      instanceLastWrongCount =
        (instanceLastWrongCount ?? 0) +
        (lastResponseCorrectness! === ResponseCorrectness.WRONG ? 1 : 0)
    }

    // prepare instance updates if any are required
    const instanceUpdate = computeInstanceUpdate({
      instance: instance as ElementInstance & {
        instanceStatistics: InstanceStatistics
      },
      newValues: {
        results: instanceResults,
        correctCount: instanceCorrectCount,
        partialCorrectCount: instancePartialCorrectCount,
        wrongCount: instanceWrongCount,
        uniqueParticipantCount: instanceUniqueParticipantCount,
        averageTimeSpent: instanceAverageTimeSpent,
        firstCorrectCount: instanceFirstCorrectCount,
        firstPartialCorrectCount: instanceFirstPartialCorrectCount,
        firstWrongCount: instanceFirstWrongCount,
        lastCorrectCount: instanceLastCorrectCount,
        lastPartialCorrectCount: instanceLastPartialCorrectCount,
        lastWrongCount: instanceLastWrongCount,
      },
    })
    if (instanceUpdate) {
      instanceUpdates.push(instanceUpdate)
    }

    // TODO: uncomment this part to apply updates in a single transaction for each element instance
    // ! Execute all updates that are potentially required in a single transaction
    // if (
    //   detailUpdates.length > 0 ||
    //   responseUpdates.length > 0 ||
    //   instanceUpdates.length > 0
    // ) {
    //   await prisma.$transaction([
    //     ...detailUpdates.map((update) =>
    //       prisma.questionResponseDetail.update({
    //         where: { id: update.id },
    //         data: update.data,
    //       })
    //     ),
    //     ...responseUpdates.map((update) =>
    //       prisma.questionResponse.update({
    //         where: { id: update.id },
    //         data: update.data,
    //       })
    //     ),
    //     ...instanceUpdates.map((update) =>
    //       prisma.elementInstance.update({
    //         where: { id: update.id },
    //         data: update.data,
    //       })
    //     ),
    //   ])
    // }
  }
}

await run()

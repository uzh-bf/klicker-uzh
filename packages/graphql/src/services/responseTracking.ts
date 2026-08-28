import * as DB from '@klicker-uzh/prisma/client'
import dayjs from 'dayjs'

const POINTS_AWARD_TIMEFRAME_DAYS = 6
const XP_AWARD_TIMEFRAME_DAYS = 1

interface CombineCorrectnessParamsInput {
  correct: boolean
  partial: boolean
  incorrect: boolean
  existingResponse?: DB.QuestionResponse | null
}

export function combineNewCorrectnessParams({
  correct,
  partial,
  incorrect,
}: CombineCorrectnessParamsInput) {
  return {
    lastAnsweredAt: new Date(),
    correctCount: correct ? 1 : 0,
    correctCountStreak: correct ? 1 : 0,
    lastCorrectAt: correct ? new Date() : undefined,
    partialCorrectCount: partial ? 1 : 0,
    lastPartialCorrectAt: partial ? new Date() : undefined,
    wrongCount: incorrect ? 1 : 0,
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

export function combineCorrectnessParams({
  correct,
  partial,
  incorrect,
  existingResponse,
}: CombineCorrectnessParamsInput) {
  return {
    lastAnsweredAt: new Date(),
    correctCount: {
      increment: correct ? 1 : 0,
    },
    correctCountStreak: {
      increment: correct
        ? 1
        : existingResponse
          ? -existingResponse.correctCountStreak
          : 0,
    },
    lastCorrectAt: correct ? new Date() : undefined,
    partialCorrectCount: {
      increment: partial ? 1 : 0,
    },
    lastPartialCorrectAt: partial ? new Date() : undefined,
    wrongCount: {
      increment: incorrect ? 1 : 0,
    },
    lastWrongAt: incorrect ? new Date() : undefined,
  }
}

export type SpacedRepetitionResult = {
  efactor: number
  interval: number
  nextDueAt: Date
}

export function updateSpacedRepetition({
  eFactor,
  interval,
  streak,
  grade,
}: {
  eFactor: number
  interval: number
  streak: number
  grade: number
}): SpacedRepetitionResult {
  if (grade < 0 || grade > 1) {
    throw new Error('Grade must be between 0 and 1.')
  }

  const scaledGrade = grade * 5
  let newEfactor = Math.max(
    1.3,
    eFactor + (0.1 - (5 - scaledGrade) * (0.08 + (5 - scaledGrade) * 0.02))
  )
  newEfactor = parseFloat(newEfactor.toFixed(2))

  let newInterval: number
  if (scaledGrade < 3) {
    newInterval = 1
  } else if (streak === 1) {
    newInterval = 2
  } else if (streak === 2) {
    newInterval = 6
  } else {
    newInterval = Math.ceil(interval * newEfactor)
  }

  newInterval = Math.min(newInterval, 36500)
  const nextDueAt = dayjs().add(newInterval, 'day').toDate()

  return {
    efactor: newEfactor,
    interval: newInterval,
    nextDueAt,
  }
}

export function computeNewAverageTimes({
  existingInstance,
  existingResponse,
  answerTime,
}: {
  existingInstance: DB.ElementInstance & {
    instanceStatistics: DB.InstanceStatistics | null
  }
  existingResponse: DB.QuestionResponse | null
  answerTime: number
}): { newAverageResponseTime: number; newAverageInstanceTime: number } {
  const existingParticipantCount =
    existingInstance.instanceStatistics!.uniqueParticipantCount
  const existingInstanceTime =
    existingInstance.instanceStatistics!.averageTimeSpent
  const newAverageResponseTime = existingResponse
    ? (existingResponse.averageTimeSpent * existingResponse.trialsCount +
        answerTime) /
      (existingResponse.trialsCount + 1)
    : answerTime
  const newAverageInstanceTime = existingResponse
    ? (existingInstanceTime! * existingParticipantCount -
        existingResponse.averageTimeSpent +
        answerTime) /
      existingParticipantCount
    : ((existingInstanceTime ?? 0) * existingParticipantCount + answerTime) /
      (existingParticipantCount + 1)

  return { newAverageResponseTime, newAverageInstanceTime }
}

export function computeUpdatedInstanceStatistics({
  participation,
  existingResponse,
  newAverageInstanceTime,
  answerCorrect,
  answerPartial,
  answerIncorrect,
  instanceInPracticeQuiz,
}: {
  participation: DB.Participation | null
  existingResponse: DB.QuestionResponse | null
  newAverageInstanceTime?: number
  answerCorrect: boolean
  answerPartial: boolean
  answerIncorrect: boolean
  instanceInPracticeQuiz: boolean
}) {
  return participation
    ? {
        update: {
          uniqueParticipantCount: {
            increment: Number(!existingResponse),
          },
          averageTimeSpent: newAverageInstanceTime ?? 0,
          correctCount: {
            increment: Number(answerCorrect),
          },
          partialCorrectCount: {
            increment: Number(answerPartial),
          },
          wrongCount: {
            increment: Number(answerIncorrect),
          },
          firstCorrectCount: {
            increment: Number(
              answerCorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstPartialCorrectCount: {
            increment: Number(
              answerPartial && !existingResponse && instanceInPracticeQuiz
            ),
          },
          firstWrongCount: {
            increment: Number(
              answerIncorrect && !existingResponse && instanceInPracticeQuiz
            ),
          },
          lastCorrectCount: {
            increment:
              Number(answerCorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.CORRECT
              ),
          },
          lastPartialCorrectCount: {
            increment:
              Number(answerPartial && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.PARTIAL
              ),
          },
          lastWrongCount: {
            increment:
              Number(answerIncorrect && instanceInPracticeQuiz) -
              Number(
                existingResponse?.lastResponseCorrectness ===
                  DB.ResponseCorrectness.WRONG
              ),
          },
        },
      }
    : {
        update: {
          anonymousCorrectCount: {
            increment: Number(answerCorrect),
          },
          anonymousPartialCorrectCount: {
            increment: Number(answerPartial),
          },
          anonymousWrongCount: {
            increment: Number(answerIncorrect),
          },
        },
      }
}

export function computeAwardedPointsAndXP({
  score,
  xp,
  existingResponse,
  participation,
  instance,
}: {
  score: number
  xp: number
  existingResponse: DB.QuestionResponse | null
  participation: DB.Participation | null
  instance: DB.ElementInstance
}): {
  pointsAwarded: number | null
  newPointsFrom: Date | undefined
  lastAwardedAt: Date | undefined
  lastXpAwardedAt: Date
  xpAwarded: number
  newXpFrom: Date
} {
  const participationActive = participation?.isActive ?? false

  if (existingResponse) {
    const pointsOutsideTimeframe =
      !existingResponse.lastAwardedAt ||
      dayjs(existingResponse.lastAwardedAt).isBefore(
        dayjs().subtract(
          instance.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
      )

    let pointsAwarded: number | null
    let lastAwardedAt: Date | undefined
    let newPointsFrom: Date | undefined

    if (participationActive) {
      pointsAwarded = pointsOutsideTimeframe ? score : 0
      lastAwardedAt =
        pointsOutsideTimeframe || !existingResponse.lastAwardedAt
          ? new Date()
          : existingResponse.lastAwardedAt
      newPointsFrom = dayjs(lastAwardedAt)
        .add(
          instance.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    } else {
      pointsAwarded = null
      lastAwardedAt = undefined
      newPointsFrom = undefined
    }

    const xpOutsideTimeframe =
      !existingResponse.lastXpAwardedAt ||
      dayjs(existingResponse.lastXpAwardedAt).isBefore(
        dayjs().subtract(XP_AWARD_TIMEFRAME_DAYS, 'days')
      )

    const xpAwarded = xpOutsideTimeframe ? xp : 0
    const lastXpAwardedAt =
      xpOutsideTimeframe || !existingResponse.lastXpAwardedAt
        ? new Date()
        : existingResponse.lastXpAwardedAt
    const newXpFrom = dayjs(lastXpAwardedAt)
      .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
      .toDate()

    return {
      pointsAwarded,
      newPointsFrom,
      lastAwardedAt,
      xpAwarded,
      newXpFrom,
      lastXpAwardedAt,
    }
  }

  const lastAwardedAt = participationActive ? new Date() : undefined
  const newPointsFrom = participationActive
    ? dayjs(lastAwardedAt)
        .add(
          instance.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
          'days'
        )
        .toDate()
    : undefined
  const newXpFrom = dayjs(lastAwardedAt)
    .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
    .toDate()

  return {
    pointsAwarded: participationActive ? score : null,
    newPointsFrom,
    lastAwardedAt,
    xpAwarded: xp,
    newXpFrom,
    lastXpAwardedAt: new Date(),
  }
}

export function computeAwardOverrideDates({
  pointsAwarded,
  xpAwarded,
  instance,
  lastAwardedAt,
  lastXpAwardedAt,
  newPointsFrom,
  newXpFrom,
}: {
  pointsAwarded: number | null
  xpAwarded: number
  instance: DB.ElementInstance
  lastAwardedAt: Date | undefined
  lastXpAwardedAt: Date
  newPointsFrom: Date | undefined
  newXpFrom: Date
}) {
  if ((pointsAwarded ?? 0) > 0) {
    lastAwardedAt = new Date()
    newPointsFrom = dayjs(lastAwardedAt)
      .add(
        instance.options.resetTimeDays ?? POINTS_AWARD_TIMEFRAME_DAYS,
        'days'
      )
      .toDate()
  }
  if (xpAwarded > 0) {
    lastXpAwardedAt = new Date()
    newXpFrom = dayjs(lastXpAwardedAt)
      .add(XP_AWARD_TIMEFRAME_DAYS, 'days')
      .toDate()
  }

  return { lastAwardedAt, lastXpAwardedAt, newPointsFrom, newXpFrom }
}

import {
  computeAwardedPoints,
  computeAwardedXp,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import type { ResponseInput } from '@klicker-uzh/types'
import type { ChainableCommander } from 'ioredis'
import {
  DEFAULT_CORRECT_POINTS,
  DEFAULT_POINTS,
  MAX_BONUS_POINTS,
  TIME_TO_ZERO_BONUS,
} from './constants.js'

export function updateLeaderboards({
  redisMulti,
  participantId,
  participantRole,
  sessionKey,
  sessionBlockId,
  pointsAwarded,
  xpAwarded,
}: {
  redisMulti: ChainableCommander
  participantId: string
  participantRole: string
  sessionKey: string
  sessionBlockId: string
  pointsAwarded: number
  xpAwarded: number
}) {
  // depending on the participant account type (permanent student account or
  // temporary pseudonym), set the correct points / experience points
  if (participantRole === 'PARTICIPANT') {
    redisMulti.hincrby(
      `${sessionKey}:b:${sessionBlockId}:lb`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(`${sessionKey}:lb`, participantId, pointsAwarded)
    redisMulti.hincrby(`${sessionKey}:xp`, participantId, xpAwarded)
  } else if (participantRole === 'TEMPORARY_PARTICIPANT') {
    // temporary participants are only granted points, xp cannot be collected
    redisMulti.hincrby(
      `${sessionKey}:b:${sessionBlockId}:lbTemporary`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(
      `${sessionKey}:lbTemporary`,
      participantId,
      pointsAwarded
    )
  }
}

interface SharedQuestionPointsParams {
  response: ResponseInput
  instanceInfo: Record<string, string>
  firstResponseReceivedAt?: string
  responseTimestamp: number
  basePoints?: string
  pointsMultiplier?: string
  parsedSolutions: any
}

export function getChoicesQuestionPoints({
  type,
  choiceCount,
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams & {
  type: 'SC' | 'MC' | 'KPRIM'
  choiceCount?: string
}) {
  let pointsPercentage: number | null
  if (type === 'SC') {
    pointsPercentage = gradeQuestionSC({
      responseCount: Number(choiceCount),
      response: response.choices!,
      solution: parsedSolutions,
    })
  } else if (type === 'MC') {
    pointsPercentage = gradeQuestionMC({
      responseCount: Number(choiceCount),
      response: response.choices!,
      solution: parsedSolutions,
    })
  } else {
    pointsPercentage = gradeQuestionKPRIM({
      responseCount: Number(choiceCount),
      response: response.choices!,
      solution: parsedSolutions,
    })
  }
  const pointsAwarded = computeAwardedPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    maxBonus: isNaN(
      parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10)
    )
      ? MAX_BONUS_POINTS
      : parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10),
    timeToZeroBonus: isNaN(
      parseInt(instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS), 10)
    )
      ? TIME_TO_ZERO_BONUS
      : parseInt(
          instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS),
          10
        ),
    defaultPoints: isNaN(
      parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10)
    )
      ? DEFAULT_POINTS
      : parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10),
    defaultCorrectPoints: isNaN(
      parseInt(
        instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
        10
      )
    )
      ? DEFAULT_CORRECT_POINTS
      : parseInt(
          instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
          10
        ),
    pointsPercentage,
    basePoints: basePoints === 'false' ? false : true,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({ pointsPercentage })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

export function getNumericalQuestionPoints({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const exactSolutionsDefined =
    typeof parsedSolutions !== 'undefined' &&
    parsedSolutions.length > 0 &&
    (typeof parsedSolutions[0] === 'number' ||
      typeof parsedSolutions[0] === 'string')

  const pointsPercentage = gradeQuestionNumerical({
    response: Number(response.value),
    solutionRanges: exactSolutionsDefined ? undefined : parsedSolutions,
    exactSolutions: exactSolutionsDefined ? parsedSolutions : undefined,
  })

  const pointsAwarded = computeAwardedPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    getsMaxPoints: parsedSolutions && pointsPercentage === 1,
    maxBonus: isNaN(
      parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10)
    )
      ? MAX_BONUS_POINTS
      : parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10),
    timeToZeroBonus: isNaN(
      parseInt(instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS), 10)
    )
      ? TIME_TO_ZERO_BONUS
      : parseInt(
          instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS),
          10
        ),
    defaultPoints: isNaN(
      parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10)
    )
      ? DEFAULT_POINTS
      : parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10),
    defaultCorrectPoints: isNaN(
      parseInt(
        instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
        10
      )
    )
      ? DEFAULT_CORRECT_POINTS
      : parseInt(
          instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
          10
        ),
    basePoints: basePoints === 'false' ? false : true,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage: pointsPercentage ?? 0,
  })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

export function getFreeTextQuestionPoints({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionFreeText({
    response: response.value!.trim(),
    solutions: parsedSolutions,
  })

  const pointsAwarded = computeAwardedPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    getsMaxPoints: Boolean(pointsPercentage),
    maxBonus: isNaN(
      parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10)
    )
      ? MAX_BONUS_POINTS
      : parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10),
    timeToZeroBonus: isNaN(
      parseInt(instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS), 10)
    )
      ? TIME_TO_ZERO_BONUS
      : parseInt(
          instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS),
          10
        ),
    defaultPoints: isNaN(
      parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10)
    )
      ? DEFAULT_POINTS
      : parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10),
    defaultCorrectPoints: isNaN(
      parseInt(
        instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
        10
      )
    )
      ? DEFAULT_CORRECT_POINTS
      : parseInt(
          instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
          10
        ),
    basePoints: basePoints === 'false' ? false : true,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage: pointsPercentage ?? 0,
  })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

export function getSelectionQuestionPoints({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionSelection({
    numberOfInputs: parseInt(instanceInfo.numberOfInputs!, 10),
    response: response.selection!.filter((r: number) => r !== -1), // filter out skipped response fields
    correctAnswers: parsedSolutions,
  })

  const pointsAwarded = computeAwardedPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    maxBonus: isNaN(
      parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10)
    )
      ? MAX_BONUS_POINTS
      : parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10),
    timeToZeroBonus: isNaN(
      parseInt(instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS), 10)
    )
      ? TIME_TO_ZERO_BONUS
      : parseInt(
          instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS),
          10
        ),
    defaultPoints: isNaN(
      parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10)
    )
      ? DEFAULT_POINTS
      : parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10),
    defaultCorrectPoints: isNaN(
      parseInt(
        instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
        10
      )
    )
      ? DEFAULT_CORRECT_POINTS
      : parseInt(
          instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
          10
        ),
    pointsPercentage,
    basePoints: basePoints === 'false' ? false : true,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage,
  })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

export function getCaseStudyQuestionPoints({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionCaseStudy({
    response: response.assessment!,
    solutions: parsedSolutions,
  })

  const pointsAwarded = computeAwardedPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    maxBonus: isNaN(
      parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10)
    )
      ? MAX_BONUS_POINTS
      : parseInt(instanceInfo.maxBonusPoints ?? String(MAX_BONUS_POINTS), 10),
    timeToZeroBonus: isNaN(
      parseInt(instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS), 10)
    )
      ? TIME_TO_ZERO_BONUS
      : parseInt(
          instanceInfo.timeToZeroBonus ?? String(TIME_TO_ZERO_BONUS),
          10
        ),
    defaultPoints: isNaN(
      parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10)
    )
      ? DEFAULT_POINTS
      : parseInt(instanceInfo.defaultPoints ?? String(DEFAULT_POINTS), 10),
    defaultCorrectPoints: isNaN(
      parseInt(
        instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
        10
      )
    )
      ? DEFAULT_CORRECT_POINTS
      : parseInt(
          instanceInfo.defaultCorrectPoints ?? String(DEFAULT_CORRECT_POINTS),
          10
        ),
    pointsPercentage,
    basePoints: basePoints === 'false' ? false : true,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage,
  })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

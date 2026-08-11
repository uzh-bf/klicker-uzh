import {
  computeAwardedCorrectnessPoints,
  computeAwardedXp,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
} from '@klicker-uzh/grading'
import type { LiveQuizResponseInput } from '@klicker-uzh/types'
import {
  DEFAULT_CORRECT_POINTS,
  DEFAULT_POINTS,
  MAX_BONUS_POINTS,
  TIME_TO_ZERO_BONUS,
} from '../constants.js'
export { validateStudentResponse } from '@klicker-uzh/util'

export function updateLeaderboards({
  redisMulti,
  participantId,
  participantRole,
  liveQuizKey,
  sessionBlockId,
  pointsAwarded,
  xpAwarded,
}: {
  redisMulti: {
    hincrby(key: string, field: string, increment: number): unknown
  }
  participantId: string
  participantRole: string
  liveQuizKey: string
  sessionBlockId: string
  pointsAwarded: number
  xpAwarded: number
}) {
  // depending on the participant account type (permanent student account or
  // temporary pseudonym), set the correct points / experience points
  if (participantRole === 'PARTICIPANT') {
    redisMulti.hincrby(
      `${liveQuizKey}:b:${sessionBlockId}:lb`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(`${liveQuizKey}:lb`, participantId, pointsAwarded)
    redisMulti.hincrby(`${liveQuizKey}:xp`, participantId, xpAwarded)
  } else if (participantRole === 'TEMPORARY_PARTICIPANT') {
    // temporary participants are only granted points, xp cannot be collected
    redisMulti.hincrby(
      `${liveQuizKey}:b:${sessionBlockId}:lbTemporary`,
      participantId,
      pointsAwarded
    )
    redisMulti.hincrby(
      `${liveQuizKey}:lbTemporary`,
      participantId,
      pointsAwarded
    )
  }
}

function getPointsWithDefaults(instanceInfo: Record<string, string>) {
  return {
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
  }
}

interface SharedQuestionPointsParams {
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  firstResponseReceivedAt?: string
  responseTimestamp: number
  basePoints?: string
  pointsMultiplier?: string
  parsedSolutions: any
}

export function getChoicesQuestionPointsDetails({
  type,
  choiceCount,
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
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

  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    pointsPercentage,
    pointsMultiplier,
  })
  const xpAwarded = computeAwardedXp({ pointsPercentage })

  return { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage }
}

export function getNumericalQuestionPointsDetails({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
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

  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    getsMaxPoints: parsedSolutions && pointsPercentage === 1,
    pointsMultiplier,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage: pointsPercentage ?? 0,
  })

  return { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage }
}

export function getFreeTextQuestionPointsDetails({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionFreeText({
    response: response.value!.trim(),
    solutions: parsedSolutions,
  })

  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    getsMaxPoints: Boolean(pointsPercentage),
    pointsMultiplier,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage: pointsPercentage ?? 0,
  })

  return { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage }
}

export function getSelectionQuestionPointsDetails({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionSelection({
    numberOfInputs: parseInt(instanceInfo.numberOfInputs!, 10),
    response: response.selection!.filter(
      (r: number) => r !== -1 && typeof r !== 'undefined' && r !== null
    ), // filter out skipped response fields
    correctAnswers: parsedSolutions,
  })

  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    pointsPercentage,
    pointsMultiplier,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage,
  })

  return { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage }
}

export function getCaseStudyQuestionPointsDetails({
  response,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  pointsMultiplier,
  parsedSolutions,
}: SharedQuestionPointsParams) {
  const pointsPercentage = gradeQuestionCaseStudy({
    response: response.assessment!,
    solutions: parsedSolutions,
  })

  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    pointsPercentage,
    pointsMultiplier,
  })
  const xpAwarded = computeAwardedXp({
    pointsPercentage,
  })

  return { correctnessPoints, bonusPoints, xpAwarded, pointsPercentage }
}

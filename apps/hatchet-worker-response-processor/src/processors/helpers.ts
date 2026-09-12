import {
  computeAwardedCorrectnessPoints,
  computeAwardedPoints,
  computeAwardedXp,
  filterSkippedSelectionResponses,
  gradeQuestionCaseStudy,
  gradeQuestionFreeText,
  gradeQuestionKPRIM,
  gradeQuestionMC,
  gradeQuestionNumerical,
  gradeQuestionSC,
  gradeQuestionSelection,
  resolveNumericalSolutions,
} from '@klicker-uzh/grading'
import type {
  FreeTextRestrictions,
  LiveQuizResponseInput,
  NumericalRestrictions,
} from '@klicker-uzh/types'
import type { ChainableCommander } from 'ioredis'
import {
  DEFAULT_CORRECT_POINTS,
  DEFAULT_POINTS,
  MAX_BONUS_POINTS,
  TIME_TO_ZERO_BONUS,
} from '../constants.js'

export function updateLeaderboards({
  redisMulti,
  participantId,
  participantRole,
  liveQuizKey,
  sessionBlockId,
  pointsAwarded,
  xpAwarded,
}: {
  redisMulti: ChainableCommander
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

export function validateStudentResponse({
  type,
  response,
  restrictions,
}: {
  type:
    | 'SC'
    | 'MC'
    | 'KPRIM'
    | 'NUMERICAL'
    | 'FREE_TEXT'
    | 'SELECTION'
    | 'CASE_STUDY'
    | 'CONTENT'
  response: LiveQuizResponseInput
  restrictions?: NumericalRestrictions | FreeTextRestrictions
}): { valid: boolean; message?: string } {
  if (type === 'SC' || type === 'MC' || type === 'KPRIM') {
    // response should be of format { ix: number, selected: boolean | undefined }[]
    if (
      !Array.isArray(response.choices) ||
      response.choices.length === 0 ||
      !response.choices.every(
        (r) =>
          typeof r.ix === 'number' &&
          (typeof r.selected === 'boolean' || typeof r.selected === 'undefined')
      )
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for choices question ${JSON.stringify(response)}`,
      }
    }

    // for single choice questions, only exactly one choice should be selected
    if (
      type === 'SC' &&
      response.choices.filter((r) => r.selected).length !== 1
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for single choice question ${JSON.stringify(response)}`,
      }
    }

    // for multiple choice questions, at least one choice should be selected
    if (
      type === 'MC' &&
      response.choices.filter((r) => r.selected).length === 0
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for multiple choice question ${JSON.stringify(response)}`,
      }
    }

    // for KPRIM questions, exactly four choices should be provided
    if (type === 'KPRIM' && response.choices.length !== 4) {
      return {
        valid: false,
        message: `Invalid response submitted for KPRIM question ${JSON.stringify(response)}`,
      }
    }

    // if all cases are passed, choices response is considered to be valid
    return { valid: true }
  } else if (type === 'NUMERICAL') {
    // response should be a string and be parseable as a number
    if (
      typeof response.value !== 'string' ||
      !response.value ||
      isNaN(parseFloat(response.value))
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for numerical question ${JSON.stringify(response)}`,
      }
    }

    // if restrictions are defined, check that the parsed number is within the defined bounds
    const parsedResponse = parseFloat(response.value)
    if (
      restrictions &&
      (('min' in restrictions &&
        typeof restrictions.min === 'number' &&
        parsedResponse < restrictions.min) ||
        ('max' in restrictions &&
          typeof restrictions.max === 'number' &&
          parsedResponse > restrictions.max))
    ) {
      return {
        valid: false,
        message: `Numerical response ${parsedResponse} out of bounds for numerical question with restrictions ${JSON.stringify(restrictions)}`,
      }
    }

    return { valid: true }
  } else if (type === 'FREE_TEXT') {
    // response should be a string
    if (!response.value || typeof response.value !== 'string') {
      return {
        valid: false,
        message: `Invalid response submitted for free text question ${JSON.stringify(response)}`,
      }
    }

    // if restrictions are defined, check that the response satisfies them
    const trimmedResponse = response.value.trim()
    if (
      restrictions &&
      'maxLength' in restrictions &&
      typeof restrictions.maxLength === 'number' &&
      trimmedResponse.length > restrictions.maxLength
    ) {
      return {
        valid: false,
        message: `Free text response exceeds maximum length of ${restrictions.maxLength} characters for free text question`,
      }
    }

    return { valid: true }
  } else if (type === 'SELECTION') {
    // response should be an array of numbers
    if (
      !Array.isArray(response.selection) ||
      response.selection.length === 0 ||
      // TODO: re-introduce the following check once the incoming responses are guaranteed to be correct through response-api validation
      // !response.selection.every((r) => typeof r === 'number') ||
      response.selection.filter(
        (r) => r !== -1 && typeof r !== 'undefined' && r !== null
      ).length === 0 // at least one selection must be made (excluding skipped fields with value -1 / undefined / null)
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for selection question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  } else if (type === 'CASE_STUDY') {
    // response should be of the format { [caseId: string]: { [itemId: number]: { [criterionId: string]: number } } }
    if (
      !response.assessment ||
      Object.keys(response.assessment).length === 0 ||
      !Object.values(response.assessment).every(
        (caseObj) =>
          typeof caseObj === 'object' &&
          caseObj !== null &&
          Object.keys(caseObj).length > 0 &&
          Object.values(caseObj).every(
            (itemObj) =>
              typeof itemObj === 'object' &&
              itemObj !== null &&
              Object.keys(itemObj).length > 0 &&
              Object.values(itemObj).every(
                (criterionResponse) => typeof criterionResponse === 'number'
              )
          )
      )
    ) {
      return {
        valid: false,
        message: `Invalid response submitted for case study question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  } else if (type === 'CONTENT') {
    // response should be boolean with value true
    if (!response.viewed) {
      return {
        valid: false,
        message: `Invalid response submitted for content question ${JSON.stringify(response)}`,
      }
    }

    return { valid: true }
  }

  return {
    valid: false,
    message: `Provided invalid question type in answer submission: ${type}`,
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

// ---------------------------------------------------------------------------
// shared grading cores and award finalization for the supported question types
// ---------------------------------------------------------------------------

type SharedScoringParams = {
  pointsPercentage: number | null
  instanceInfo: Record<string, string>
  firstResponseReceivedAt?: string
  responseTimestamp: number
  pointsMultiplier?: string
}

function gradeChoicesResponse({
  type,
  choiceCount,
  response,
  parsedSolutions,
}: {
  type: 'SC' | 'MC' | 'KPRIM'
  choiceCount?: string
  response: LiveQuizResponseInput
  parsedSolutions: any
}): number | null {
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

  return pointsPercentage
}

function gradeNumericalResponse({
  response,
  parsedSolutions,
}: {
  response: LiveQuizResponseInput
  parsedSolutions: any
}): number | null {
  const { exactSolutions, solutionRanges } =
    resolveNumericalSolutions(parsedSolutions)

  return gradeQuestionNumerical({
    response: Number(response.value),
    solutionRanges,
    exactSolutions,
  })
}

function gradeFreeTextResponse({
  response,
  parsedSolutions,
}: {
  response: LiveQuizResponseInput
  parsedSolutions: any
}): number | null {
  return gradeQuestionFreeText({
    response: response.value!.trim(),
    solutions: parsedSolutions,
  })
}

function gradeSelectionResponse({
  response,
  instanceInfo,
  parsedSolutions,
}: {
  response: LiveQuizResponseInput
  instanceInfo: Record<string, string>
  parsedSolutions: any
}): number | null {
  return gradeQuestionSelection({
    numberOfInputs: parseInt(instanceInfo.numberOfInputs!, 10),
    response: filterSkippedSelectionResponses(response.selection!),
    correctAnswers: parsedSolutions,
  })
}

function gradeCaseStudyResponse({
  response,
  parsedSolutions,
}: {
  response: LiveQuizResponseInput
  parsedSolutions: any
}): number | null {
  return gradeQuestionCaseStudy({
    response: response.assessment!,
    solutions: parsedSolutions,
  })
}

// total points for synchronous activities: correctness + bonus + optional
// base points, rounded; the percentage is forwarded to the grading package,
// which awards the maximum on a fully correct answer
function finalizeTotalPoints({
  pointsPercentage,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  basePoints,
  pointsMultiplier,
}: {
  pointsPercentage: number | null
  basePoints?: string
} & SharedScoringParams): {
  pointsAwarded: number
  xpAwarded: number
  pointsPercentage: number | null
} {
  const pointsWithDefaults = getPointsWithDefaults(instanceInfo)
  const pointsAwarded = computeAwardedPoints({
    ...pointsWithDefaults,
    firstResponseReceivedAt,
    responseTimestamp,
    pointsPercentage,
    basePoints: basePoints === 'true' ? true : false,
    pointsMultiplier,
    roundedResult: true,
  })
  const xpAwarded = computeAwardedXp({ pointsPercentage })

  return { pointsAwarded, xpAwarded, pointsPercentage }
}

// correctness/bonus decomposition for assessment activities
function finalizeCorrectnessPoints({
  pointsPercentage,
  instanceInfo,
  firstResponseReceivedAt,
  responseTimestamp,
  pointsMultiplier,
}: SharedScoringParams): {
  correctnessPoints: number
  bonusPoints: number
  xpAwarded: number
  pointsPercentage: number | null
} {
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

/**
 * Whether the answer is fully correct (percentage exactly 1); used by the
 * live-quiz flow to decide whether a response qualifies as the first
 * (bonus-relevant) response of a block for percentage-based question types.
 */
export function isFullyCorrect(pointsPercentage: number | null): boolean {
  return pointsPercentage !== null && pointsPercentage === 1
}

/**
 * Whether a numerical response is gradable at all (solutions defined and a
 * non-zero percentage); used by the live-quiz flow for the first-response
 * bookkeeping of numerical questions.
 */
export function hasGradableNumericalAnswer(
  parsedSolutions: any,
  pointsPercentage: number | null
): boolean {
  return Boolean(parsedSolutions && pointsPercentage)
}

/**
 * Whether a free-text response achieved a non-zero percentage; used by the
 * live-quiz flow for the first-response bookkeeping of free-text questions.
 */
export function hasGradableFreeTextAnswer(
  pointsPercentage: number | null
): boolean {
  return Boolean(pointsPercentage)
}

export function getChoicesQuestionPoints(
  params: SharedQuestionPointsParams & {
    type: 'SC' | 'MC' | 'KPRIM'
    choiceCount?: string
  }
) {
  return finalizeTotalPoints({
    ...params,
    pointsPercentage: gradeChoicesResponse(params),
  })
}

export function getChoicesQuestionPointsDetails(
  params: SharedQuestionPointsParams & {
    type: 'SC' | 'MC' | 'KPRIM'
    choiceCount?: string
  }
) {
  return finalizeCorrectnessPoints({
    ...params,
    pointsPercentage: gradeChoicesResponse(params),
  })
}

export function getNumericalQuestionPoints(params: SharedQuestionPointsParams) {
  return finalizeTotalPoints({
    ...params,
    pointsPercentage: gradeNumericalResponse(params),
  })
}

export function getNumericalQuestionPointsDetails(
  params: SharedQuestionPointsParams
) {
  return finalizeCorrectnessPoints({
    ...params,
    pointsPercentage: gradeNumericalResponse(params),
  })
}

export function getFreeTextQuestionPoints(params: SharedQuestionPointsParams) {
  return finalizeTotalPoints({
    ...params,
    pointsPercentage: gradeFreeTextResponse(params),
  })
}

export function getFreeTextQuestionPointsDetails(
  params: SharedQuestionPointsParams
) {
  return finalizeCorrectnessPoints({
    ...params,
    pointsPercentage: gradeFreeTextResponse(params),
  })
}

export function getSelectionQuestionPoints(params: SharedQuestionPointsParams) {
  return finalizeTotalPoints({
    ...params,
    pointsPercentage: gradeSelectionResponse(params),
  })
}

export function getSelectionQuestionPointsDetails(
  params: SharedQuestionPointsParams
) {
  return finalizeCorrectnessPoints({
    ...params,
    pointsPercentage: gradeSelectionResponse(params),
  })
}

export function getCaseStudyQuestionPoints(params: SharedQuestionPointsParams) {
  return finalizeTotalPoints({
    ...params,
    pointsPercentage: gradeCaseStudyResponse(params),
  })
}

export function getCaseStudyQuestionPointsDetails(
  params: SharedQuestionPointsParams
) {
  return finalizeCorrectnessPoints({
    ...params,
    pointsPercentage: gradeCaseStudyResponse(params),
  })
}

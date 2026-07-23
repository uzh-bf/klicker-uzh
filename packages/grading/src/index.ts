import type {
  CaseStudyCaseResponse,
  CaseStudyCaseSolution,
  CaseStudyResponseObject,
  ChoicesResponse,
  NumericalSolutionRange,
} from '@klicker-uzh/types'
import { isDeepEqual, toLowerCase } from 'remeda'

interface GradeQuestionChoicesArgs {
  responseCount: number
  response: ChoicesResponse[]
  solution: number[]
}

// compute the hamming distance between a string a and string b
function hammingDistance({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  const baseArr = new Array(responseCount).fill(0)

  const selectedChoiceIxs = response
    .filter((choice) => choice.selected)
    .map((choice) => choice.ix)
  const responseArr = baseArr.map((_, ix) =>
    selectedChoiceIxs.includes(ix) ? 1 : 0
  )
  const solutionArr = baseArr.map((_, ix) => (solution.includes(ix) ? 1 : 0))

  let distance = 0
  for (let i = 0; i < responseArr.length; i++) {
    if (responseArr[i] !== solutionArr[i]) distance++
  }
  return distance
}

export function gradeQuestionSC({
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (!solution || solution.length === 0) return null

  const selectedChoiceIxs = response
    .filter((choice) => choice.selected)
    .map((choice) => choice.ix)

  if (isDeepEqual(selectedChoiceIxs, solution)) return 1

  return 0
}

export function gradeQuestionMC({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (!solution || solution.length === 0) return null

  const distance = hammingDistance({
    responseCount,
    response,
    solution,
  })

  const percentageOfWrongAnswers = distance / responseCount

  return Math.max(-2 * percentageOfWrongAnswers + 1, 0)
}

export function gradeQuestionKPRIM({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs): number | null {
  if (solution === null || typeof solution === 'undefined') return null

  const distance = hammingDistance({
    responseCount,
    response,
    solution,
  })

  if (distance === 0) return 1
  if (distance === 1) return 0.5

  return 0
}

interface GradeQuestionNumericalArgs {
  response: number
  solutionRanges?: NumericalSolutionRange[] | null
  exactSolutions?: number[] | null
}

export function gradeQuestionNumerical({
  response,
  solutionRanges,
  exactSolutions,
}: GradeQuestionNumericalArgs): number | null {
  if (!Number.isFinite(response)) return null
  if (!solutionRanges?.length && !exactSolutions?.length) return null

  if (solutionRanges && solutionRanges.length > 0) {
    // TODO: maybe incorporate distance from ranges for partial credit?
    const definedSolutionRanges = solutionRanges.filter(({ min, max }) => {
      return typeof min === 'number' || typeof max === 'number'
    })

    if (definedSolutionRanges.length === 0) return null

    const withinRanges = definedSolutionRanges.map(({ min, max }) => {
      if (typeof min === 'number' && response < min - Number.EPSILON)
        return false
      if (typeof max === 'number' && response > max + Number.EPSILON)
        return false
      return true
    })

    // if the response is within one of the solution ranges
    if (withinRanges.some((match) => match === true)) return 1
  } else if (exactSolutions && exactSolutions.length > 0) {
    const solutionMatches = exactSolutions.map((solution) => {
      const numericalSolution =
        typeof solution === 'number' ? solution : parseFloat(solution)

      return (
        numericalSolution - Number.EPSILON <= response &&
        response <= numericalSolution + Number.EPSILON
      )
    })

    return solutionMatches.some((match) => match === true) ? 1 : 0
  }

  return 0
}

interface GradeQuestionFreeTextArgs {
  response: string
  solutions: string[] | undefined | null
}

export function gradeQuestionFreeText({
  response,
  solutions,
}: GradeQuestionFreeTextArgs): number | null {
  if (!solutions || solutions.length === 0) return null

  const matchingSolutions = solutions.map(
    (solution) => toLowerCase(solution.trim()) === toLowerCase(response.trim())
  )

  if (matchingSolutions.some((match) => match === true)) return 1

  return 0
}

interface GradeQuestionSelectionArgs {
  numberOfInputs: number
  response: number[]
  correctAnswers: number[] | undefined | null
}

export function gradeQuestionSelection({
  numberOfInputs,
  response,
  correctAnswers,
}: GradeQuestionSelectionArgs): number | null {
  if (!correctAnswers || correctAnswers.length === 0 || numberOfInputs === 0)
    return null

  // remove duplicates and validate responses
  const validResponses = [...new Set(response)].filter((answerId) =>
    correctAnswers.includes(answerId)
  )

  return validResponses.length / numberOfInputs
}

interface GradeQuestionCaseStudyArgs {
  response: CaseStudyCaseResponse[] | CaseStudyResponseObject
  solutions?:
    | {
        caseId: string
        itemSolutions: CaseStudyCaseSolution[]
      }[]
    | null
}

export function gradeQuestionCaseStudy({
  response,
  solutions,
}: GradeQuestionCaseStudyArgs): number | null {
  if (!solutions || solutions.length === 0) return null

  // convert response into an object for faster access
  const responseMap = !Array.isArray(response)
    ? response
    : response.reduce<CaseStudyResponseObject>(
        (acc, { caseId, itemResponses }) => {
          acc[caseId] = itemResponses.reduce<CaseStudyResponseObject['']>(
            (acc, { itemId, criterionResponses }) => {
              acc[itemId] = criterionResponses.reduce<
                CaseStudyResponseObject[''][0]
              >((acc, { criterionId, response }) => {
                acc[criterionId] = response
                return acc
              }, {})
              return acc
            },
            {}
          )
          return acc
        },
        {}
      )

  const { totalAssessmentCases, totalCorrectCases } = solutions.reduce<{
    totalAssessmentCases: number
    totalCorrectCases: number
  }>(
    (acc, { caseId, itemSolutions }) => {
      for (const { itemId, criteriaSolutions } of itemSolutions) {
        for (const { criterionId, min, max } of criteriaSolutions) {
          // extract student response for the specific case, item and criterion
          const responseValue = responseMap[caseId]?.[itemId]?.[criterionId]

          // increment counter of total assessment cases
          acc.totalAssessmentCases++

          // if the response value is undefined, the student did not set the corresponding slider
          if (responseValue === undefined) {
            continue
          }

          // check if the submitted response lies within the correct range
          if (
            responseValue >= min - Number.EPSILON &&
            responseValue <= max + Number.EPSILON
          ) {
            acc.totalCorrectCases++
          }
        }
      }

      return acc
    },
    {
      totalAssessmentCases: 0,
      totalCorrectCases: 0,
    }
  )

  return totalAssessmentCases === 0
    ? 0
    : totalCorrectCases / totalAssessmentCases
}

// ! Function to compute the awarded correctness and bonus points in asynchronous activities
interface ComputeAwardedCorrectnessPointsArgs {
  firstResponseReceivedAt?: string | null
  responseTimestamp: number
  maxBonus: number
  timeToZeroBonus?: number
  getsMaxPoints?: boolean
  defaultCorrectPoints?: number
  pointsPercentage?: number | null
  pointsMultiplier?: number | string | null
}
export function computeAwardedCorrectnessPoints({
  firstResponseReceivedAt,
  responseTimestamp,
  maxBonus,
  timeToZeroBonus,
  getsMaxPoints,
  defaultCorrectPoints,
  pointsPercentage,
  pointsMultiplier,
}: ComputeAwardedCorrectnessPointsArgs): {
  correctnessPoints: number
  bonusPoints: number
} {
  const slope = Math.max(maxBonus, 0) / Math.max(timeToZeroBonus ?? 20, 1)

  // time between the first response and the current response (in seconds)
  const responseTiming = Math.max(
    (responseTimestamp - Number(firstResponseReceivedAt ?? responseTimestamp)) /
      1000,
    0
  )

  // intialize the correctness points and bonus points to 0
  let correctnessPoints = 0
  let bonusPoints = 0

  // if the student gets the question right, they get the full points or partial points depending on the question type
  // the students get at most maxBonus points and the bonus declines linearly until it reaches 0 after 40 seconds
  if (pointsPercentage !== null && typeof pointsPercentage !== 'undefined') {
    correctnessPoints +=
      pointsPercentage * Math.max(defaultCorrectPoints ?? 0, 0)
    bonusPoints += Math.max(
      pointsPercentage * (maxBonus - slope * responseTiming),
      0
    )
  } else if (getsMaxPoints) {
    correctnessPoints += Math.max(defaultCorrectPoints ?? 0, 0)
    bonusPoints += Math.max(maxBonus - slope * responseTiming, 0)
  }

  // if a multiplier is defined, apply it to both the correctness points and bonus points
  if (typeof pointsMultiplier !== 'undefined' && pointsMultiplier !== null) {
    const numericMultiplier =
      Number.isNaN(Number(pointsMultiplier)) || Number(pointsMultiplier) < 1
        ? 1
        : Number(pointsMultiplier)
    correctnessPoints *= numericMultiplier
    bonusPoints *= numericMultiplier
  }

  return { correctnessPoints, bonusPoints }
}

// ! Function to compute awarded points for instances in synchronous activities (relying on the previous function)
interface ComputeAwardedPointsArgs {
  firstResponseReceivedAt?: string | null
  responseTimestamp: number
  maxBonus: number
  timeToZeroBonus?: number
  getsMaxPoints?: boolean
  defaultPoints?: number
  defaultCorrectPoints?: number
  pointsPercentage?: number | null
  basePoints: boolean
  pointsMultiplier?: number | string | null
  roundedResult: boolean
}
export function computeAwardedPoints({
  firstResponseReceivedAt,
  responseTimestamp,
  maxBonus,
  timeToZeroBonus,
  getsMaxPoints,
  defaultPoints,
  defaultCorrectPoints,
  pointsPercentage,
  basePoints, // flag if based points should be awarded
  pointsMultiplier,
  roundedResult = false,
}: ComputeAwardedPointsArgs): number {
  // initialize the number of awarded points
  let awardedPoints = 0

  // compute the correctness and bonus points awarded to participants
  const { correctnessPoints, bonusPoints } = computeAwardedCorrectnessPoints({
    firstResponseReceivedAt,
    responseTimestamp,
    maxBonus,
    timeToZeroBonus,
    getsMaxPoints,
    defaultCorrectPoints,
    pointsPercentage,
    pointsMultiplier,
  })

  // add the points awarded for correct answers
  awardedPoints += correctnessPoints + bonusPoints

  // depending on the base points setting, compute the final awarded points
  awardedPoints += basePoints ? Math.max(defaultPoints ?? 0, 0) : 0

  // if desired, round the result to the nearest integer
  return roundedResult ? Math.round(awardedPoints) : awardedPoints
}

// ! Function to compute awarded points for instances in asynchronous activities
interface ComputeSimpleAwardedPointsArgs {
  points: number
  pointsPercentage?: number | null
  pointsMultiplier?: number | null
}

export function computeSimpleAwardedPoints({
  points,
  pointsPercentage,
  pointsMultiplier,
}: ComputeSimpleAwardedPointsArgs): number {
  if (pointsPercentage !== null && typeof pointsPercentage !== 'undefined') {
    return Math.round(points * pointsPercentage * (pointsMultiplier ?? 1))
  }
  return 0
}

interface ComputeAwardedXpArgs {
  pointsPercentage: number | null
}

export function computeAwardedXp({ pointsPercentage }: ComputeAwardedXpArgs) {
  if (pointsPercentage !== null && pointsPercentage === 1) {
    return 10
  }
  return 0
}

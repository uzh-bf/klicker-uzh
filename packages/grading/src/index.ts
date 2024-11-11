import { isDeepEqual, toLowerCase } from 'remeda'

interface GradeQuestionChoicesArgs {
  responseCount: number
  response: number[]
  solution: number[]
}

// compute the hamming distance between a string a and string b
function hammingDistance({
  responseCount,
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  const baseArr = new Array(responseCount).fill(0)

  const responseArr = baseArr.map((_, ix) => (response.includes(ix) ? 1 : 0))
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

  if (isDeepEqual(response, solution)) return 1

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
  if (!solution) return null

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
  solutionRanges: {
    min?: number | null
    max?: number | null
  }[]
}

export function gradeQuestionNumerical({
  response,
  solutionRanges,
}: GradeQuestionNumericalArgs): number | null {
  if (!solutionRanges?.length) return null

  const definedSolutionRanges = solutionRanges.filter(({ min, max }) => {
    return typeof min === 'number' || typeof max === 'number'
  })

  if (definedSolutionRanges.length === 0) return null

  const withinRanges = definedSolutionRanges.map(({ min, max }) => {
    if (min && response < min - Number.EPSILON) return false
    if (max && response > max + Number.EPSILON) return false
    return true
  })

  // if the response is within one of the solution ranges
  if (withinRanges.some((match) => match === true)) return 1

  // TODO: maybe incorporate distance from ranges for partial credit?

  return 0
}

interface GradeQuestionFreeTextArgs {
  response: string
  solutions: string[]
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

interface ComputeAwardedPointsArgs {
  firstResponseReceivedAt: string | null
  responseTimestamp: number
  maxBonus: number
  timeToZeroBonus?: number
  getsMaxPoints?: boolean
  defaultPoints?: number
  defaultCorrectPoints?: number
  pointsPercentage?: number | null
  pointsMultiplier?: number | string | null
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
  pointsMultiplier,
}: ComputeAwardedPointsArgs): number {
  const slope = maxBonus / (timeToZeroBonus ?? 20)

  // default number of points each student gets independent of the correctness of the answer
  let awardedPoints = 0

  // time between the first response and the current response
  let responseTiming =
    (responseTimestamp - Number(firstResponseReceivedAt ?? responseTimestamp)) /
    1000

  // if the student gets the question right, they get the full points or partial points depending on the question type
  // the students get at most maxBonus points and the bonus declines linearly until it reaches 0 after 40 seconds
  if (pointsPercentage !== null && typeof pointsPercentage !== 'undefined') {
    const additionalPoints =
      pointsPercentage * (defaultCorrectPoints ?? 0) +
      Math.max(pointsPercentage * (maxBonus - slope * responseTiming), 0)
    awardedPoints += additionalPoints
  } else if (getsMaxPoints) {
    const additionalPoints =
      (defaultCorrectPoints ?? 0) +
      Math.max(maxBonus - slope * responseTiming, 0)
    awardedPoints += additionalPoints
  }

  if (typeof pointsMultiplier !== 'undefined') {
    awardedPoints *= Number(pointsMultiplier)
  }

  awardedPoints += defaultPoints ?? 0

  return Math.round(awardedPoints)
}

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

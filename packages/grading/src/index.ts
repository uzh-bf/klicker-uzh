import { any, equals } from 'ramda'

interface GradeQuestionChoicesArgs {
  response: number[]
  solution: number[]
}

export function gradeQuestionSC({
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  if (!solution || solution.length === 0) return true

  const isCorrect = equals(response, solution)

  return isCorrect
}

export function gradeQuestionMC({
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  if (!solution || solution.length === 0) return true

  const isCorrect = equals(response, solution)

  return isCorrect
}

export function gradeQuestionKPRIM({
  response,
  solution,
}: GradeQuestionChoicesArgs) {
  if (!solution) return true

  const isCorrect = true

  return isCorrect
}

interface GradeQuestionNumericalArgs {
  response: number
  solutionRanges: {
    min?: number
    max?: number
  }[]
}

export function gradeQuestionNumerical({
  response,
  solutionRanges,
}: GradeQuestionNumericalArgs) {
  if (!solutionRanges || solutionRanges.length === 0) return true

  const withinRanges = solutionRanges.map(({ min, max }) => {
    if (min && response < min) return false
    if (max && response > max) return false
    return true
  })

  const isCorrect = any(Boolean, withinRanges)

  return isCorrect
}

interface GradeQuestionFreeTextArgs {
  response: string
  solutions: string[]
}

export function gradeQuestionFreeText({
  response,
  solutions,
}: GradeQuestionFreeTextArgs) {
  if (!solutions || solutions.length === 0) return true

  const isCorrect = solutions.includes(response)

  return isCorrect
}

import { ElementOptionsInput } from '@klicker-uzh/types'

function validateSelectionOptions(options?: ElementOptionsInput | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    return false
  }

  // number of inputs needs to be specified and valid
  if (
    typeof options.numberOfInputs !== 'number' ||
    options.numberOfInputs === null ||
    options.numberOfInputs < 1
  ) {
    return false
  }

  // answer collection needs to be defined for selection questions
  if (
    typeof options.answerCollection !== 'number' ||
    options.answerCollection === null
  ) {
    return false
  }

  // if sample solution is activated, at the numberOfInputs sample solutions need to be defined
  if (
    options.hasSampleSolution &&
    (!options.correctAnswers ||
      options.correctAnswers.length < options.numberOfInputs)
  ) {
    return false
  }

  return true
}

export default validateSelectionOptions

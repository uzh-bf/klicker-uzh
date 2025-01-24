import { ElementOptionsArgs } from './validateAndProcessElementOptions.js'

function validateSelectionOptions(options?: ElementOptionsArgs | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for selection questions'
    )
    return false
  }

  // number of inputs needs to be specified and valid
  if (
    typeof options.numberOfInputs !== 'number' ||
    options.numberOfInputs === null ||
    options.numberOfInputs < 1
  ) {
    console.error('Number of inputs needs to be specified and valid')
    return false
  }

  // answer collection needs to be defined for selection questions
  if (
    typeof options.answerCollection !== 'number' ||
    options.answerCollection === null
  ) {
    console.error(
      'Answer collection needs to be specified for selection questions'
    )
    return false
  }

  // if sample solution is activated, at the numberOfInputs sample solutions need to be defined
  if (
    options.hasSampleSolution &&
    (!options.correctAnswers ||
      options.correctAnswers.length < options.numberOfInputs)
  ) {
    console.error(
      'Number of sample solutions needs to larger or equal to the number of inputs'
    )
    return false
  }

  return true
}

export default validateSelectionOptions

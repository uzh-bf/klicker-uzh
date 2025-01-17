import { QuestionOptionsArgs } from './validateAndProcessElementOptions.js'

function validateNumericalOptions(options?: QuestionOptionsArgs | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for numerical questions'
    )
    return false
  }

  // if sample solution is enabled, check for solution ranges or exact solutions
  if (options.hasSampleSolution) {
    // either solution ranges or exact solutions need to be defined
    if (!options.solutionRanges && !options.exactSolutions) {
      console.error(
        'At least one of solution ranges or exact solutions needs to be defined'
      )
      return false
    }

    // if solution ranges are chosen, at least one needs to be defined and valid
    const invalidSolutionRange =
      options.solutionRanges &&
      (options.solutionRanges.length === 0 ||
        ((options.solutionRanges[0]?.min === null ||
          typeof options.solutionRanges[0]?.min === 'undefined') &&
          (options.solutionRanges[0]?.max === null ||
            typeof options.solutionRanges[0]?.max === 'undefined')))

    // if exact solutions are chosen, at least one needs to be defined
    const invalidExactSolutions =
      options.exactSolutions &&
      (options.exactSolutions.length === 0 ||
        options.exactSolutions[0] === null ||
        typeof options.exactSolutions[0] === 'undefined')

    if (invalidSolutionRange || invalidExactSolutions) {
      console.error(
        'At least one of solution ranges or exact solutions needs to be defined and valid'
      )
      return false
    }
  }

  return true
}

export default validateNumericalOptions

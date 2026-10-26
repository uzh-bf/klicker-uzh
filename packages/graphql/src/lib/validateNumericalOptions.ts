import { ElementOptionsInput } from '@klicker-uzh/types'

function validateNumericalOptions(options?: ElementOptionsInput | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    return false
  }

  // if sample solution is enabled, check for solution ranges or exact solutions
  if (options.hasSampleSolution) {
    // either solution ranges or exact solutions need to be defined
    if (!options.solutionRanges && !options.exactSolutions) {
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
      return false
    }
  }

  return true
}

export default validateNumericalOptions

import { ElementOptionsInput } from '@klicker-uzh/types'

function validateFreeTextOptions(options?: ElementOptionsInput | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    return false
  }

  // if sample solution is enabled, at least one valid solution is required
  if (
    options.hasSampleSolution &&
    (!options.solutions ||
      options.solutions.length === 0 ||
      options.solutions[0] === '')
  ) {
    return false
  }

  return true
}

export default validateFreeTextOptions

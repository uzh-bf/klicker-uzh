import { ElementOptionsInput } from '@klicker-uzh/types'
import { MAX_RESPONSE_LIMIT } from '@klicker-uzh/util'

function validateFreeTextOptions(options?: ElementOptionsInput | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for free text questions'
    )
    return false
  }

  // if sample solution is enabled, at least one valid solution is required
  if (
    options.hasSampleSolution &&
    (!options.solutions ||
      options.solutions.length === 0 ||
      options.solutions[0] === '')
  ) {
    console.error(
      'At least one solution is required for free text questions with sample solution'
    )
    return false
  }

  // the response limit is optional, but must be a whole number within bounds if set
  if (
    typeof options.responseLimit === 'number' &&
    (!Number.isInteger(options.responseLimit) ||
      options.responseLimit < 1 ||
      options.responseLimit > MAX_RESPONSE_LIMIT)
  ) {
    console.error(
      `The response limit for free text questions must be between 1 and ${MAX_RESPONSE_LIMIT}`
    )
    return false
  }

  return true
}

export default validateFreeTextOptions

import { validateSemanticFreeTextConfig } from '@klicker-uzh/grading'
import type { ElementOptionsInput } from '@klicker-uzh/types'
import { z } from 'zod'

const semanticFreeTextConfigSchema = z.custom(
  (value) => validateSemanticFreeTextConfig(value).length === 0,
  'Invalid semantic free-text configuration'
)

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

  if (
    options.semanticEvaluation != null &&
    !semanticFreeTextConfigSchema.safeParse(options.semanticEvaluation).success
  ) {
    console.error('Semantic free-text configuration is invalid')
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

  return true
}

export default validateFreeTextOptions

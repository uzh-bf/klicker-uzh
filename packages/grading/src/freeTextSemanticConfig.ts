import {
  isFiniteNumber,
  isNonEmptyString,
  isRecord,
  isStringArray,
} from './freeTextSemanticPrimitives.js'
import { validateFreeTextOutcomeBands } from './freeTextSemanticScoring.js'
import { validateFreeTextRubricSchema } from './freeTextSemanticValidation.js'

export function validateSemanticFreeTextConfig(value: unknown): string[] {
  if (!isRecord(value)) return ['semantic evaluation config must be an object']

  const errors: string[] = []
  if (value.contract_version !== '1') {
    errors.push('contract_version must be 1')
  }
  if (value.question_language !== 'en' && value.question_language !== 'de') {
    errors.push('question_language must be en or de')
  }
  if (
    !isFiniteNumber(value.attempt_limit) ||
    !Number.isInteger(value.attempt_limit) ||
    value.attempt_limit < 1 ||
    value.attempt_limit > 10
  ) {
    errors.push('attempt_limit must be an integer from 1 through 10')
  }
  if (typeof value.solution_reveal_enabled !== 'boolean') {
    errors.push('solution_reveal_enabled must be a boolean')
  }
  if (!isStringArray(value.accepted_exact_answers)) {
    errors.push('accepted_exact_answers must be a string array')
  }
  if (
    value.solution_reveal_enabled === true &&
    !isNonEmptyString(value.reference_solution)
  ) {
    errors.push(
      'reference_solution is required when solution reveal is enabled'
    )
  } else if (
    value.reference_solution != null &&
    typeof value.reference_solution !== 'string'
  ) {
    errors.push('reference_solution must be a string')
  }

  errors.push(
    ...validateFreeTextRubricSchema(value.rubric_schema).map((error) => {
      return `rubric_schema: ${error}`
    })
  )
  if (value.outcome_bands != null) {
    errors.push(
      ...validateFreeTextOutcomeBands(value.outcome_bands).map((error) => {
        return `outcome_bands: ${error}`
      })
    )
  }

  return errors
}

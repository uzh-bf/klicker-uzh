import { ElementOptionsInput } from '@klicker-uzh/types'
import validateSharedChoicesFields from './validateSharedChoicesFields.js'

function validateSCOptions(options?: ElementOptionsInput | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // SC only: if sample solution is enabled, exactly one correct answer is allowed
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length !== 1) {
      return false
    }
  }

  return true
}

export default validateSCOptions

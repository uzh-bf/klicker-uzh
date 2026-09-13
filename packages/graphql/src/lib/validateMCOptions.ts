import { ElementOptionsInput } from '@klicker-uzh/types'
import validateSharedChoicesFields from './validateSharedChoicesFields.js'

function validateMCOptions(options?: ElementOptionsInput | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // MC only: if sample solution is enabled, at least one correct answer is required
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length === 0) {
      return false
    }
  }

  return true
}

export default validateMCOptions

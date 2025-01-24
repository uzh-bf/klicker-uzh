import { ElementOptionsArgs } from './validateAndProcessElementOptions.js'
import validateSharedChoicesFields from './validateSharedChoicesFields.js'

function validateMCOptions(options?: ElementOptionsArgs | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // MC only: if sample solution is enabled, at least one correct answer is required
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length === 0) {
      console.error(
        'At least one correct answer is required for MC questions with sample solution'
      )
      return false
    }
  }

  return true
}

export default validateMCOptions

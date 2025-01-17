import { QuestionOptionsArgs } from './validateAndProcessElementOptions.js'
import validateSharedChoicesFields from './validateSharedChoicesFields.js'

function validateSCOptions(options?: QuestionOptionsArgs | null) {
  let valid = validateSharedChoicesFields(options)
  if (!valid) return false

  // SC only: if sample solution is enabled, exactly one correct answer is allowed
  if (options?.hasSampleSolution) {
    const correctAnswers = options.choices!.filter(
      (choice) => choice.correct === true
    )
    if (correctAnswers.length !== 1) {
      console.error(
        'Exactly one correct answer is required for SC questions with sample solution'
      )
      return false
    }
  }

  return true
}

export default validateSCOptions

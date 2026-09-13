import {
  DisplayMode,
  type ElementOptionsInput,
  MAX_LIVE_QUIZ_CHOICES,
} from '@klicker-uzh/types'

function validateSharedChoicesFields(options?: ElementOptionsInput | null) {
  // options and choices therein need to be defined
  if (!options || !options.choices) {
    console.error('Options are required on choices questions')
    return false
  }

  // at least one choice needs to be defined
  if (options.choices.length === 0) {
    console.error('At least one choice is required')
    return false
  }

  if (options.choices.length > MAX_LIVE_QUIZ_CHOICES) {
    console.error(
      `Choices questions may contain at most ${MAX_LIVE_QUIZ_CHOICES} choices`
    )
    return false
  }

  // every choice needs to have a valid ix (number) and value (string) that is non-empty
  if (
    !options.choices.every(
      (choice) =>
        typeof choice.ix === 'number' &&
        typeof choice.value === 'string' &&
        !choice.value.match(/^(<br>(\n)*)$/g) &&
        choice.value !== ''
    )
  ) {
    console.error('Every choice needs to have a valid ix and value')
    return false
  }

  // displaymode needs to be defined and valid
  if (
    typeof options.displayMode === 'undefined' ||
    options.displayMode === null ||
    !Object.values(DisplayMode).includes(options.displayMode)
  ) {
    console.error(
      'Display mode is required for choices questions and needs to be valid'
    )
    return false
  }

  // sample solution and answer feedback flags need to be set
  if (
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null ||
    typeof options.hasAnswerFeedbacks !== 'boolean' ||
    options.hasAnswerFeedbacks === null
  ) {
    console.error('Sample solution and answer feedback flags are required')
    return false
  }

  // if sample solution is enabled, every option needs to be correct or incorrect
  if (
    options.hasSampleSolution &&
    !options.choices.every((choice) => typeof choice.correct === 'boolean')
  ) {
    console.error(
      'Every choice needs to have a correct flag if sample solution is enabled'
    )
    return false
  }

  // if sample solution and answer feedbacks are enabled, every option needs to have a valid answer feedback
  if (
    options.hasSampleSolution &&
    options.hasAnswerFeedbacks &&
    !options.choices.every(
      (choice) =>
        typeof choice.feedback === 'string' &&
        choice.feedback !== '' &&
        !choice.feedback.match(/^(<br>(\n)*)$/g)
    )
  ) {
    console.error(
      'Every choice needs to have a feedback specified if the corresponding flag is set'
    )
    return false
  }

  return true
}

export default validateSharedChoicesFields

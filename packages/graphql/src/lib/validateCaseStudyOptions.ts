import {
  type ElementOptionsInput,
  MAX_LIVE_QUIZ_CASE_STUDY_RESPONSE_ENTRIES,
} from '@klicker-uzh/types'

function validateCaseStudyOptions(options?: ElementOptionsInput | null) {
  // options and hasSampleSolution need to be defined
  if (
    !options ||
    typeof options.hasSampleSolution !== 'boolean' ||
    options.hasSampleSolution === null
  ) {
    console.error(
      'Options and sample solution flag are required for case study questions'
    )
    return false
  }

  // answer collection needs to be defined for case study questions
  if (
    typeof options.answerCollection !== 'number' ||
    options.answerCollection === null
  ) {
    console.error(
      'Answer collection needs to be specified for case study questions'
    )
    return false
  }

  // items for case study need to be defined
  if (!options.collectionItemIds || options.collectionItemIds.length === 0) {
    console.error('Items for case study need to be defined')
    return false
  }

  // criteria need to be defined with all requried fields
  if (!options.criteria || options.criteria.length === 0) {
    console.error('Criteria for case study need to be defined')
    return false
  }

  for (const criterion of options.criteria) {
    if (
      typeof criterion.id !== 'string' ||
      criterion.id === '' ||
      criterion.id === null ||
      typeof criterion.name !== 'string' ||
      criterion.name === '' ||
      criterion.name === null ||
      typeof criterion.order !== 'number' ||
      criterion.order === null ||
      typeof criterion.min !== 'number' ||
      criterion.min === null ||
      typeof criterion.max !== 'number' ||
      criterion.max === null ||
      typeof criterion.step !== 'number' ||
      criterion.step === null
    ) {
      console.error('Criteria need to have a id, title, min, max and step size')
      return false
    }

    if (
      criterion.labels !== null &&
      typeof criterion.labels !== 'undefined' &&
      (criterion.labels.min === '' ||
        criterion.labels.min === null ||
        typeof criterion.labels.min === 'undefined' ||
        criterion.labels.max === '' ||
        criterion.labels.max === null ||
        typeof criterion.labels.max === 'undefined')
    ) {
      console.error('Criteria labels need to have a min and max value')
      return false
    }
  }

  // cases need to be defined with all required fields
  if (!options.cases || options.cases.length === 0) {
    console.error('Cases for case study need to be defined')
    return false
  }

  for (const caseItem of options.cases) {
    if (
      typeof caseItem.title !== 'string' ||
      caseItem.title === '' ||
      caseItem.title === null ||
      typeof caseItem.description !== 'string' ||
      caseItem.description === '' ||
      caseItem.description === null ||
      typeof caseItem.order !== 'number' ||
      caseItem.order === null
    ) {
      console.error('Cases need to have a title and description')
      return false
    }
  }

  const responseEntryCount =
    options.cases.length *
    options.collectionItemIds.length *
    options.criteria.length
  if (responseEntryCount > MAX_LIVE_QUIZ_CASE_STUDY_RESPONSE_ENTRIES) {
    console.error(
      `Case study responses may contain at most ${MAX_LIVE_QUIZ_CASE_STUDY_RESPONSE_ENTRIES} entries`
    )
    return false
  }

  if (options.hasSampleSolution) {
    for (const caseItem of options.cases) {
      const items = options.collectionItemIds
      const criteria = options.criteria
      const criterionIds = criteria.map((criterion) => criterion.id)

      if (
        !caseItem.solutions ||
        Object.keys(caseItem.solutions).length !== items.length ||
        Object.values(caseItem.solutions).some(
          (solutions) =>
            Object.keys(solutions.criteriaSolutions).length !== criteria.length
        )
      ) {
        console.error(
          'All items and criteria need to have well-defined solutions'
        )
        return false
      }

      // solutions need to have a min and max value
      for (const solution of caseItem.solutions) {
        // itemId in solution needs to be valid
        if (!items.includes(solution.itemId)) {
          console.error('Item id in solution is not valid')
          return false
        }

        // check if the solutions are defined for valid criteria only and the values are valid
        for (const criterionSolution of solution.criteriaSolutions) {
          if (!criterionIds.includes(criterionSolution.criterionId)) {
            console.error('Criterion id in solution is not valid')
            return false
          }

          if (
            typeof criterionSolution.min !== 'number' ||
            criterionSolution.min === null ||
            typeof criterionSolution.max !== 'number' ||
            criterionSolution.max === null ||
            criterionSolution.min > criterionSolution.max
          ) {
            console.error('Solution needs to have a min and max value')
            return false
          }
        }
      }
    }
  }

  return true
}

export default validateCaseStudyOptions

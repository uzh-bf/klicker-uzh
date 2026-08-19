import * as DB from '@klicker-uzh/prisma/client'
import type { ElementOptionsInput } from '@klicker-uzh/types'
import validateCaseStudyOptions from './validateCaseStudyOptions.js'
import validateFreeTextOptions from './validateFreeTextOptions.js'
import validateKPRIMOptions from './validateKPRIMOptions.js'
import validateMCOptions from './validateMCOptions.js'
import validateNumericalOptions from './validateNumericalOptions.js'
import validateSCOptions from './validateSCOptions.js'
import validateSelectionOptions from './validateSelectionOptions.js'

// display mode type workaround required for typescript to accept corresponding inputs
function validateAndProcessElementOptions(
  elementType: DB.ElementType,
  options?: ElementOptionsInput | null
) {
  switch (elementType) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM: {
      let valid = false
      if (elementType === DB.ElementType.SC) {
        valid = validateSCOptions(options)
      } else if (elementType === DB.ElementType.MC) {
        valid = validateMCOptions(options)
      } else {
        valid = validateKPRIMOptions(options)
      }

      // if options are not valid, abort processing
      if (!valid || !options) return null

      return {
        displayMode: options.displayMode,
        hasSampleSolution: options.hasSampleSolution,
        hasAnswerFeedbacks:
          options.hasSampleSolution && options.hasAnswerFeedbacks,
        choices: options.choices!.map((choice) => ({
          ...choice,
          correct: options.hasSampleSolution ? choice.correct : undefined,
          feedback:
            options.hasSampleSolution && options.hasAnswerFeedbacks
              ? choice.feedback
              : undefined,
        })),
      }
    }

    case DB.ElementType.NUMERICAL: {
      // if options are not valid, abort processing
      const valid = validateNumericalOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution,
        unit: options.unit ?? undefined,
        accuracy: options.accuracy ?? undefined,
        placeholder: options.placeholder ?? undefined,
        restrictions: {
          min: options.restrictions?.min ?? undefined,
          max: options.restrictions?.max ?? undefined,
        },
        solutionRanges:
          options.hasSampleSolution && options.solutionRanges
            ? options.solutionRanges
            : undefined,
        exactSolutions:
          options.hasSampleSolution && options.exactSolutions
            ? options.exactSolutions
            : undefined,
      }
    }

    case DB.ElementType.FREE_TEXT: {
      // if options are not valid, abort processing
      const valid = validateFreeTextOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution,
        solutions: options.hasSampleSolution ? options.solutions : undefined,
        restrictions: {
          maxLength: options.restrictions?.maxLength ?? undefined,
        },
        semanticEvaluation: options.semanticEvaluation ?? undefined,
      }
    }

    case DB.ElementType.SELECTION: {
      // if options are not valid, abort processing
      const valid = validateSelectionOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution,
        numberOfInputs: options.numberOfInputs,
      }
    }

    case DB.ElementType.CASE_STUDY: {
      // if options are not valid, abort processing
      const valid = validateCaseStudyOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution,
        criteria: options.criteria!.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          order: criterion.order,
          min: criterion.min,
          max: criterion.max,
          step: criterion.step,
          unit: criterion.unit ?? undefined,
          labels: criterion.labels ?? undefined,
        })),
        cases: options.cases!.map((caseItem) => ({
          id: caseItem.id,
          title: caseItem.title,
          description: caseItem.description,
          order: caseItem.order,
          solutions: options.hasSampleSolution ? caseItem.solutions : undefined,
        })),
      }
    }

    default: {
      return {}
    }
  }
}

export default validateAndProcessElementOptions

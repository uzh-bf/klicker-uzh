import * as DB from '@klicker-uzh/prisma/client'
import { DisplayMode } from '@klicker-uzh/types'
import type {
  CaseStudyCase,
  CaseStudyCaseCriterionSolution,
  CaseStudyCaseSolution,
  CaseStudyCriterion,
  CaseStudyCriterionLabels,
  Choice,
  ElementOptions,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsFreeText,
  ElementOptionsInput,
  ElementOptionsNumerical,
  ElementOptionsSelection,
  FreeTextRestrictions,
  NumericalRestrictions,
  NumericalSolutionRange,
} from '@klicker-uzh/types'
import validateCaseStudyOptions from './validateCaseStudyOptions.js'
import validateFreeTextOptions from './validateFreeTextOptions.js'
import validateKPRIMOptions from './validateKPRIMOptions.js'
import validateMCOptions from './validateMCOptions.js'
import validateNumericalOptions from './validateNumericalOptions.js'
import validateSCOptions from './validateSCOptions.js'
import validateSelectionOptions from './validateSelectionOptions.js'

type OptionRecord = Record<string, unknown>

function isRecord(value: unknown): value is OptionRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readRecord(value: unknown, label: string): OptionRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label}`)
  }

  return value
}

function readOptionalBoolean(
  record: OptionRecord,
  key: string
): boolean | undefined {
  const value = record[key]
  if (value === null || typeof value === 'undefined') return undefined
  if (typeof value !== 'boolean') {
    throw new Error(`Invalid boolean option: ${key}`)
  }

  return value
}

function readRequiredNumber(record: OptionRecord, key: string): number {
  const value = record[key]
  if (typeof value !== 'number') {
    throw new Error(`Invalid number option: ${key}`)
  }

  return value
}

function readNullableNumber(
  record: OptionRecord,
  key: string
): number | null | undefined {
  const value = record[key]
  if (value === null || typeof value === 'undefined') return value
  if (typeof value !== 'number') {
    throw new Error(`Invalid number option: ${key}`)
  }

  return value
}

function readOptionalNumber(
  record: OptionRecord,
  key: string
): number | undefined {
  return readNullableNumber(record, key) ?? undefined
}

function readRequiredString(record: OptionRecord, key: string): string {
  const value = record[key]
  if (typeof value !== 'string') {
    throw new Error(`Invalid string option: ${key}`)
  }

  return value
}

function readNullableString(
  record: OptionRecord,
  key: string
): string | null | undefined {
  const value = record[key]
  if (value === null || typeof value === 'undefined') return value
  if (typeof value !== 'string') {
    throw new Error(`Invalid string option: ${key}`)
  }

  return value
}

function readOptionalString(
  record: OptionRecord,
  key: string
): string | undefined {
  return readNullableString(record, key) ?? undefined
}

function readRequiredArray<T>(
  record: OptionRecord,
  key: string,
  parse: (value: unknown) => T
): T[] {
  const value = record[key]
  if (!Array.isArray(value)) {
    throw new Error(`Invalid array option: ${key}`)
  }

  return value.map(parse)
}

function readOptionalArray<T>(
  record: OptionRecord,
  key: string,
  parse: (value: unknown) => T
): T[] | null | undefined {
  const value = record[key]
  if (value === null || typeof value === 'undefined') return value
  if (!Array.isArray(value)) {
    throw new Error(`Invalid array option: ${key}`)
  }

  return value.map(parse)
}

function readDisplayMode(record: OptionRecord): DisplayMode {
  const value = record.displayMode
  if (value === DisplayMode.LIST || value === DisplayMode.GRID) {
    return value
  }

  throw new Error('Invalid display mode option')
}

function parseChoice(value: unknown): Choice {
  const record = readRecord(value, 'choice')
  return {
    ix: readRequiredNumber(record, 'ix'),
    value: readRequiredString(record, 'value'),
    correct: readOptionalBoolean(record, 'correct'),
    feedback: readOptionalString(record, 'feedback'),
  }
}

function parseChoicesOptions(value: unknown): ElementOptionsChoices {
  const record = readRecord(value, 'choices options')
  return {
    displayMode: readDisplayMode(record),
    hasSampleSolution: readOptionalBoolean(record, 'hasSampleSolution'),
    hasAnswerFeedbacks: readOptionalBoolean(record, 'hasAnswerFeedbacks'),
    choices: readRequiredArray(record, 'choices', parseChoice),
  }
}

function parseNumericalRestrictions(
  value: unknown
): NumericalRestrictions | null | undefined {
  if (value === null || typeof value === 'undefined') return value
  const record = readRecord(value, 'numerical restrictions')
  return {
    min: readNullableNumber(record, 'min'),
    max: readNullableNumber(record, 'max'),
  }
}

function parseSolutionRange(value: unknown): NumericalSolutionRange {
  const record = readRecord(value, 'numerical solution range')
  return {
    min: readNullableNumber(record, 'min'),
    max: readNullableNumber(record, 'max'),
  }
}

function parseNumericalOptions(value: unknown): ElementOptionsNumerical {
  const record = readRecord(value, 'numerical options')
  return {
    hasSampleSolution: readOptionalBoolean(record, 'hasSampleSolution'),
    hasAnswerFeedbacks: readOptionalBoolean(record, 'hasAnswerFeedbacks'),
    unit: readNullableString(record, 'unit'),
    accuracy: readNullableNumber(record, 'accuracy'),
    placeholder: readNullableString(record, 'placeholder'),
    restrictions: parseNumericalRestrictions(record.restrictions),
    solutionRanges: readOptionalArray(
      record,
      'solutionRanges',
      parseSolutionRange
    ),
    exactSolutions: readOptionalArray(record, 'exactSolutions', (item) => {
      if (typeof item !== 'number') {
        throw new Error('Invalid numerical exact solution')
      }
      return item
    }),
  }
}

function parseFreeTextRestrictions(
  value: unknown
): FreeTextRestrictions | null | undefined {
  if (value === null || typeof value === 'undefined') return value
  const record = readRecord(value, 'free-text restrictions')
  return {
    maxLength: readNullableNumber(record, 'maxLength'),
  }
}

function parseFreeTextOptions(value: unknown): ElementOptionsFreeText {
  const record = readRecord(value, 'free-text options')
  return {
    hasSampleSolution: readOptionalBoolean(record, 'hasSampleSolution'),
    hasAnswerFeedbacks: readOptionalBoolean(record, 'hasAnswerFeedbacks'),
    restrictions: parseFreeTextRestrictions(record.restrictions),
    solutions: readOptionalArray(record, 'solutions', (item) => {
      if (typeof item !== 'string') {
        throw new Error('Invalid free-text solution')
      }
      return item
    }),
  }
}

function parseSelectionOptions(value: unknown): ElementOptionsSelection {
  const record = readRecord(value, 'selection options')
  return {
    hasSampleSolution: readOptionalBoolean(record, 'hasSampleSolution'),
    hasAnswerFeedbacks: readOptionalBoolean(record, 'hasAnswerFeedbacks'),
    numberOfInputs: readRequiredNumber(record, 'numberOfInputs'),
  }
}

function parseCaseStudyCriterionLabels(
  value: unknown
): CaseStudyCriterionLabels | null | undefined {
  if (value === null || typeof value === 'undefined') return value
  const record = readRecord(value, 'case-study criterion labels')
  return {
    min: readRequiredString(record, 'min'),
    mid: readNullableString(record, 'mid'),
    max: readRequiredString(record, 'max'),
  }
}

function parseCaseStudyCriterion(value: unknown): CaseStudyCriterion {
  const record = readRecord(value, 'case-study criterion')
  return {
    id: readRequiredString(record, 'id'),
    name: readRequiredString(record, 'name'),
    order: readOptionalNumber(record, 'order'),
    min: readRequiredNumber(record, 'min'),
    max: readRequiredNumber(record, 'max'),
    step: readRequiredNumber(record, 'step'),
    unit: readNullableString(record, 'unit'),
    labels: parseCaseStudyCriterionLabels(record.labels),
  }
}

function parseCaseStudyCriterionSolution(
  value: unknown
): CaseStudyCaseCriterionSolution {
  const record = readRecord(value, 'case-study criterion solution')
  return {
    criterionId: readRequiredString(record, 'criterionId'),
    min: readRequiredNumber(record, 'min'),
    max: readRequiredNumber(record, 'max'),
  }
}

function parseCaseStudyCaseSolution(value: unknown): CaseStudyCaseSolution {
  const record = readRecord(value, 'case-study case solution')
  return {
    itemId: readRequiredNumber(record, 'itemId'),
    criteriaSolutions: readRequiredArray(
      record,
      'criteriaSolutions',
      parseCaseStudyCriterionSolution
    ),
  }
}

function parseCaseStudyCase(value: unknown): CaseStudyCase {
  const record = readRecord(value, 'case-study case')
  return {
    id: readRequiredString(record, 'id'),
    title: readRequiredString(record, 'title'),
    description: readRequiredString(record, 'description'),
    order: readOptionalNumber(record, 'order'),
    solutions: readOptionalArray(
      record,
      'solutions',
      parseCaseStudyCaseSolution
    ),
  }
}

function parseCaseStudyOptions(value: unknown): ElementOptionsCaseStudy {
  const record = readRecord(value, 'case-study options')
  return {
    hasSampleSolution: readOptionalBoolean(record, 'hasSampleSolution'),
    hasAnswerFeedbacks: readOptionalBoolean(record, 'hasAnswerFeedbacks'),
    criteria: readRequiredArray(record, 'criteria', parseCaseStudyCriterion),
    cases: readRequiredArray(record, 'cases', parseCaseStudyCase),
  }
}

export function getElementOptions(
  elementType: DB.ElementType,
  options: unknown,
  answerCollectionId: number | null,
  answerCollectionItemIds: number[]
): ElementOptions {
  switch (elementType) {
    case DB.ElementType.SC:
    case DB.ElementType.MC:
    case DB.ElementType.KPRIM:
      return parseChoicesOptions(options)
    case DB.ElementType.NUMERICAL:
      return parseNumericalOptions(options)
    case DB.ElementType.FREE_TEXT:
      return parseFreeTextOptions(options)
    case DB.ElementType.SELECTION:
      if (answerCollectionId === null) {
        throw new Error('Selection element is missing its answer collection')
      }
      return {
        ...parseSelectionOptions(options),
        answerCollection: { id: answerCollectionId, entries: [] },
        answerCollectionSolutionIds: answerCollectionItemIds,
      }
    case DB.ElementType.CASE_STUDY:
      return {
        ...parseCaseStudyOptions(options),
        answerCollectionId: answerCollectionId ?? undefined,
        collectionItemIds: answerCollectionItemIds,
      }
    case DB.ElementType.CONTENT:
    case DB.ElementType.FLASHCARD:
      return {}
    default:
      throw new Error(
        'Invalid element type encountered during option processing'
      )
  }
}

// display mode type workaround required for typescript to accept corresponding inputs
export function validateAndProcessElementOptions(
  elementType: DB.ElementType,
  options?: ElementOptionsInput | null
): ElementOptions | null {
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
      if (!valid || !options?.displayMode || !options.choices) {
        return null
      }

      return {
        displayMode: options.displayMode,
        hasSampleSolution: options.hasSampleSolution ?? undefined,
        hasAnswerFeedbacks:
          options.hasSampleSolution === true &&
          options.hasAnswerFeedbacks === true,
        choices: options.choices.map((choice) => ({
          ...choice,
          correct:
            options.hasSampleSolution === true
              ? (choice.correct ?? undefined)
              : undefined,
          feedback:
            options.hasSampleSolution === true &&
            options.hasAnswerFeedbacks === true
              ? (choice.feedback ?? undefined)
              : undefined,
        })),
      }
    }

    case DB.ElementType.NUMERICAL: {
      const valid = validateNumericalOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution ?? undefined,
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
      const valid = validateFreeTextOptions(options)
      if (!valid || !options) return null

      return {
        hasSampleSolution: options.hasSampleSolution ?? undefined,
        solutions: options.hasSampleSolution ? options.solutions : undefined,
        restrictions: {
          maxLength: options.restrictions?.maxLength ?? undefined,
        },
      }
    }

    case DB.ElementType.SELECTION: {
      const valid = validateSelectionOptions(options)
      if (
        !valid ||
        !options ||
        options.numberOfInputs === null ||
        typeof options.numberOfInputs === 'undefined'
      ) {
        return null
      }

      return {
        hasSampleSolution: options.hasSampleSolution ?? undefined,
        numberOfInputs: options.numberOfInputs,
      }
    }

    case DB.ElementType.CASE_STUDY: {
      const valid = validateCaseStudyOptions(options)
      if (!valid || !options?.criteria || !options.cases) {
        return null
      }

      return {
        hasSampleSolution: options.hasSampleSolution ?? undefined,
        criteria: options.criteria.map((criterion) => ({
          id: criterion.id,
          name: criterion.name,
          order: criterion.order,
          min: criterion.min,
          max: criterion.max,
          step: criterion.step,
          unit: criterion.unit ?? undefined,
          labels: criterion.labels ?? undefined,
        })),
        cases: options.cases.map((caseItem) => ({
          id: caseItem.id,
          title: caseItem.title,
          description: caseItem.description,
          order: caseItem.order,
          solutions: options.hasSampleSolution ? caseItem.solutions : undefined,
        })),
      }
    }

    case DB.ElementType.CONTENT:
    case DB.ElementType.FLASHCARD:
      return {}
  }
}

import {
  ElementFormTypesCaseStudy,
  ElementFormTypesChoices,
  ElementFormTypesContent,
  ElementFormTypesFlashcard,
  ElementFormTypesFreeText,
  ElementFormTypesNumerical,
  ElementFormTypesSelection,
} from './types'

interface PrepareContentArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesContent
}
export function prepareContentArgs({
  elementId,
  isDuplication,
  values,
}: PrepareContentArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareFlashcardArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesFlashcard
}
export function prepareFlashcardArgs({
  elementId,
  isDuplication,
  values,
}: PrepareFlashcardArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation: values.explanation,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareChoicesArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesChoices
}
export function prepareChoicesArgs({
  elementId,
  isDuplication,
  values,
}: PrepareChoicesArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    type: values.type,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      hasAnswerFeedbacks: values.options.hasAnswerFeedbacks,
      displayMode: values.options.displayMode,
      choices: values.options.choices.map((choice, index) => {
        return {
          ix: index,
          value: choice.value!,
          correct: values.options.hasSampleSolution
            ? (choice.correct ?? false)
            : undefined,
          feedback: choice.feedback ?? undefined,
        }
      }),
    },

    tags: values.tags,
  }
}

interface PrepareNumericalArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesNumerical
}
export function prepareNumericalArgs({
  elementId,
  isDuplication,
  values,
}: PrepareNumericalArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      accuracy: values.options.accuracy
        ? parseInt(String(values.options.accuracy))
        : undefined,
      unit: values.options.unit,
      restrictions: {
        min:
          !values.options.restrictions ||
          values.options.restrictions.min === null ||
          typeof values.options.restrictions.min === 'undefined' ||
          values.options.restrictions.min === ''
            ? undefined
            : parseFloat(String(values.options.restrictions.min)),
        max:
          !values.options.restrictions ||
          values.options.restrictions.max === null ||
          typeof values.options.restrictions.max === 'undefined' ||
          values.options.restrictions.max === ''
            ? undefined
            : parseFloat(String(values.options.restrictions.max)),
      },
      solutionRanges:
        values.options.hasSampleSolution &&
        values.options.solutionType === 'range'
          ? values.options.solutionRanges?.map((range) => ({
              min: range.min === '' ? undefined : parseFloat(String(range.min)),
              max: range.max === '' ? undefined : parseFloat(String(range.max)),
            }))
          : undefined,
      exactSolutions:
        values.options.hasSampleSolution &&
        values.options.solutionType === 'exact'
          ? values.options.exactSolutions?.map((solution) => {
              if (typeof solution === 'number') {
                return solution
              }

              const precision = parseInt(String(values.options.accuracy))
              return parseFloat(parseFloat(solution).toFixed(precision))
            })
          : undefined,
    },

    tags: values.tags,
  }
}

interface PrepareFreeTextArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesFreeText
}
export function prepareFreeTextArgs({
  elementId,
  isDuplication,
  values,
}: PrepareFreeTextArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      //   placeholder: values.options.placeholder,
      restrictions: {
        maxLength:
          !values.options.restrictions?.maxLength ||
          !values.options.restrictions?.maxLength ||
          values.options.restrictions.maxLength === ''
            ? undefined
            : parseInt(String(values.options.restrictions.maxLength)),
      },
      solutions: values.options.solutions,
    },

    tags: values.tags,
  }
}

interface PrepareSelectionArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesSelection
}
export function prepareSelectionArgs({
  elementId,
  isDuplication,
  values,
}: PrepareSelectionArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      answerCollection: parseInt(values.options.answerCollection),
      numberOfInputs: parseInt(values.options.numberOfInputs),
      correctAnswers: values.options.correctAnswers,
    },

    tags: values.tags,
  }
}

interface PrepareCaseStudyArgsProps {
  elementId?: number
  isDuplication: boolean
  values: ElementFormTypesCaseStudy
}
export function prepareCaseStudyArgs({
  elementId,
  isDuplication,
  values,
}: PrepareCaseStudyArgsProps) {
  return {
    id: isDuplication ? undefined : elementId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation:
      !values.explanation?.match(/^(<br>(\n)*)$/g) && values.explanation !== ''
        ? values.explanation
        : null,
    pointsMultiplier: parseInt(values.pointsMultiplier),

    options: {
      hasSampleSolution: values.options.hasSampleSolution,
      answerCollection: parseInt(values.options.answerCollection),
      collectionItemIds: values.options.selectedItems,

      criteria: values.options.criteria.map((criterion, index) => ({
        id: criterion.id,
        name: criterion.name,
        order: index,
        min: parseFloat(criterion.min),
        max: parseFloat(criterion.max),
        step: parseFloat(criterion.step),
        unit:
          criterion.unit && criterion.unit !== '' ? criterion.unit : undefined,
      })),

      cases: values.options.cases.map((c, index) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        order: index,
        solutions: Object.entries(c.solutions ?? {}).map(([key, value]) => ({
          itemId: parseInt(key.split('-')[1]),
          criteriaSolutions: Object.entries(value).map(
            ([criterionId, criterionValue]) => ({
              criterionId,
              min: parseFloat(criterionValue.min),
              max: parseFloat(criterionValue.max),
            })
          ),
        })),
      })),
    },

    tags: values.tags,
  }
}

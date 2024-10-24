import {
  ElementFormTypesChoices,
  ElementFormTypesContent,
  ElementFormTypesFlashcard,
  ElementFormTypesFreeText,
  ElementFormTypesNumerical,
} from './types'

interface PrepareContentArgsProps {
  questionId?: number
  isDuplication: boolean
  values: ElementFormTypesContent
}
export function prepareContentArgs({
  questionId,
  isDuplication,
  values,
}: PrepareContentArgsProps) {
  return {
    id: isDuplication ? undefined : questionId,
    name: values.name,
    status: values.status,
    content: values.content,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareFlashcardArgsProps {
  questionId?: number
  isDuplication: boolean
  values: ElementFormTypesFlashcard
}
export function prepareFlashcardArgs({
  questionId,
  isDuplication,
  values,
}: PrepareFlashcardArgsProps) {
  return {
    id: isDuplication ? undefined : questionId,
    name: values.name,
    status: values.status,
    content: values.content,
    explanation: values.explanation,
    pointsMultiplier: parseInt(values.pointsMultiplier),
    tags: values.tags,
  }
}

interface PrepareChoicesArgsProps {
  questionId?: number
  isDuplication: boolean
  values: ElementFormTypesChoices
}
export function prepareChoicesArgs({
  questionId,
  isDuplication,
  values,
}: PrepareChoicesArgsProps) {
  return {
    id: isDuplication ? undefined : questionId,
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
      choices: values.options.choices.map((choice) => {
        return {
          ix: choice.ix,
          value: choice.value!,
          correct: choice.correct,
          feedback: choice.feedback,
        }
      }),
    },
    tags: values.tags,
  }
}

interface PrepareNumericalArgsProps {
  questionId?: number
  isDuplication: boolean
  values: ElementFormTypesNumerical
}
export function prepareNumericalArgs({
  questionId,
  isDuplication,
  values,
}: PrepareNumericalArgsProps) {
  return {
    id: isDuplication ? undefined : questionId,
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
      solutionRanges: values.options.solutionRanges?.map((range) => ({
        min: range.min === '' ? undefined : parseFloat(String(range.min)),
        max: range.max === '' ? undefined : parseFloat(String(range.max)),
      })),
    },
    tags: values.tags,
  }
}

interface PrepareFreeTextArgsProps {
  questionId?: number
  isDuplication: boolean
  values: ElementFormTypesFreeText
}
export function prepareFreeTextArgs({
  questionId,
  isDuplication,
  values,
}: PrepareFreeTextArgsProps) {
  return {
    id: isDuplication ? undefined : questionId,
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

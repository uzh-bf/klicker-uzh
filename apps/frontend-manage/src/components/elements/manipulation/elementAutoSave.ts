import {
  CodeTestVisibility,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect, useState } from 'react'
import { ElementFormTypes } from './types'

type ElementAutoSave = {
  version: 1
  userId: string
  values: ElementFormTypes
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'number')
}

function isNumberOrStringOrNull(value: unknown): boolean {
  return (
    value === null || typeof value === 'number' || typeof value === 'string'
  )
}

function hasOptionalExplanation(value: Record<string, unknown>): boolean {
  return (
    value.explanation === undefined ||
    value.explanation === null ||
    typeof value.explanation === 'string'
  )
}

function hasManualItemShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === 'number' &&
    typeof value.value === 'string'
  )
}

function hasSharedFormShape(value: Record<string, unknown>): value is Record<
  string,
  unknown
> & {
  type: ElementType
  name: string
  status: ElementStatus
  content: string
  basePoints: boolean
  pointsMultiplier: string
} {
  return (
    Object.values(ElementType).includes(value.type as ElementType) &&
    typeof value.name === 'string' &&
    Object.values(ElementStatus).includes(value.status as ElementStatus) &&
    typeof value.content === 'string' &&
    typeof value.basePoints === 'boolean' &&
    typeof value.pointsMultiplier === 'string' &&
    (value.tags === undefined ||
      value.tags === null ||
      isStringArray(value.tags))
  )
}

function hasChoicesOptions(value: unknown): boolean {
  if (
    !isRecord(value) ||
    !Array.isArray(value.choices) ||
    !Object.values(ElementDisplayMode).includes(
      value.displayMode as ElementDisplayMode
    ) ||
    typeof value.hasAnswerFeedbacks !== 'boolean' ||
    typeof value.hasSampleSolution !== 'boolean'
  ) {
    return false
  }

  return value.choices.every(
    (choice) =>
      isRecord(choice) &&
      typeof choice.id === 'string' &&
      (choice.ix === undefined || typeof choice.ix === 'number') &&
      (choice.value === undefined ||
        choice.value === null ||
        typeof choice.value === 'string') &&
      (choice.correct === undefined ||
        choice.correct === null ||
        typeof choice.correct === 'boolean') &&
      (choice.feedback === undefined ||
        choice.feedback === null ||
        typeof choice.feedback === 'string')
  )
}

function hasNumericalOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.accuracy === undefined ||
      value.accuracy === null ||
      typeof value.accuracy === 'number') &&
    (value.unit === undefined ||
      value.unit === null ||
      typeof value.unit === 'string') &&
    (value.restrictions === undefined ||
      value.restrictions === null ||
      (isRecord(value.restrictions) &&
        (value.restrictions.min === undefined ||
          isNumberOrStringOrNull(value.restrictions.min)) &&
        (value.restrictions.max === undefined ||
          isNumberOrStringOrNull(value.restrictions.max)))) &&
    (value.solutionType === undefined ||
      value.solutionType === 'range' ||
      value.solutionType === 'exact') &&
    (value.solutionRanges === undefined ||
      value.solutionRanges === null ||
      (Array.isArray(value.solutionRanges) &&
        value.solutionRanges.every(
          (range) =>
            isRecord(range) &&
            (range.min === undefined || isNumberOrStringOrNull(range.min)) &&
            (range.max === undefined || isNumberOrStringOrNull(range.max))
        ))) &&
    (value.exactSolutions === undefined ||
      value.exactSolutions === null ||
      (Array.isArray(value.exactSolutions) &&
        value.exactSolutions.every(
          (solution) =>
            typeof solution === 'number' || typeof solution === 'string'
        )))
  )
}

function hasFreeTextOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.restrictions === undefined ||
      value.restrictions === null ||
      (isRecord(value.restrictions) &&
        (value.restrictions.maxLength === undefined ||
          isNumberOrStringOrNull(value.restrictions.maxLength)))) &&
    (value.solutions === undefined ||
      value.solutions === null ||
      isStringArray(value.solutions))
  )
}

function hasCodeOptions(value: unknown): boolean {
  if (
    !isRecord(value) ||
    typeof value.starterCode !== 'string' ||
    typeof value.sampleSolution !== 'string' ||
    typeof value.entrypoint !== 'string' ||
    typeof value.hasSampleSolution !== 'boolean' ||
    !Array.isArray(value.testCases)
  ) {
    return false
  }

  return value.testCases.every(
    (testCase) =>
      isRecord(testCase) &&
      typeof testCase.id === 'string' &&
      typeof testCase.name === 'string' &&
      typeof testCase.args === 'string' &&
      typeof testCase.expectedOutput === 'string' &&
      Object.values(CodeTestVisibility).includes(
        testCase.visibility as CodeTestVisibility
      ) &&
      typeof testCase.weight === 'string'
  )
}

function hasSelectionOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    typeof value.numberOfInputs === 'string' &&
    (value.itemSelectionMode === undefined ||
      value.itemSelectionMode === 'existing' ||
      value.itemSelectionMode === 'new') &&
    (value.answerCollection === undefined ||
      typeof value.answerCollection === 'string') &&
    (value.manuallyCreatedItems === undefined ||
      (Array.isArray(value.manuallyCreatedItems) &&
        value.manuallyCreatedItems.every(hasManualItemShape))) &&
    (value.correctAnswers === undefined || isNumberArray(value.correctAnswers))
  )
}

function hasCaseStudySolutionsShape(value: unknown): boolean {
  return (
    isRecord(value) &&
    Object.values(value).every(
      (solution) =>
        isRecord(solution) &&
        Object.values(solution).every(
          (range) =>
            isRecord(range) &&
            typeof range.min === 'string' &&
            typeof range.max === 'string'
        )
    )
  )
}

function hasCaseStudyOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.itemSelectionMode === undefined ||
      value.itemSelectionMode === 'existing' ||
      value.itemSelectionMode === 'new') &&
    (value.answerCollection === undefined ||
      typeof value.answerCollection === 'string') &&
    Array.isArray(value.cases) &&
    value.cases.every(
      (caseItem) =>
        isRecord(caseItem) &&
        typeof caseItem.id === 'string' &&
        typeof caseItem.title === 'string' &&
        typeof caseItem.description === 'string' &&
        (caseItem.solutions === undefined ||
          hasCaseStudySolutionsShape(caseItem.solutions))
    ) &&
    Array.isArray(value.criteria) &&
    value.criteria.every(
      (criterion) =>
        isRecord(criterion) &&
        typeof criterion.id === 'string' &&
        (criterion.mode === 'range' || criterion.mode === 'steps') &&
        typeof criterion.name === 'string' &&
        (criterion.min === undefined || typeof criterion.min === 'number') &&
        (criterion.max === undefined || typeof criterion.max === 'number') &&
        typeof criterion.step === 'string' &&
        (criterion.unit === undefined ||
          criterion.unit === null ||
          typeof criterion.unit === 'string') &&
        (criterion.labels === undefined ||
          criterion.labels === null ||
          (isRecord(criterion.labels) &&
            typeof criterion.labels.min === 'string' &&
            (criterion.labels.mid === undefined ||
              criterion.labels.mid === null ||
              typeof criterion.labels.mid === 'string') &&
            typeof criterion.labels.max === 'string'))
    ) &&
    (value.selectedItems === undefined || isNumberArray(value.selectedItems)) &&
    (value.manuallyCreatedItems === undefined ||
      (Array.isArray(value.manuallyCreatedItems) &&
        value.manuallyCreatedItems.every(hasManualItemShape)))
  )
}

function isElementFormValues(value: unknown): value is ElementFormTypes {
  if (!isRecord(value) || !hasSharedFormShape(value)) {
    return false
  }

  switch (value.type) {
    case ElementType.Content:
      return true
    case ElementType.Flashcard:
      return typeof value.explanation === 'string'
    case ElementType.Sc:
    case ElementType.Mc:
    case ElementType.Kprim:
      return hasOptionalExplanation(value) && hasChoicesOptions(value.options)
    case ElementType.Numerical:
      return hasOptionalExplanation(value) && hasNumericalOptions(value.options)
    case ElementType.FreeText:
      return hasOptionalExplanation(value) && hasFreeTextOptions(value.options)
    case ElementType.Code:
      return hasOptionalExplanation(value) && hasCodeOptions(value.options)
    case ElementType.Selection:
      return hasOptionalExplanation(value) && hasSelectionOptions(value.options)
    case ElementType.CaseStudy:
      return hasOptionalExplanation(value) && hasCaseStudyOptions(value.options)
    default:
      return false
  }
}

export function getElementAutoSaveForUser(
  value: unknown,
  userId: string | undefined
): ElementFormTypes | undefined {
  if (
    !userId ||
    !isRecord(value) ||
    value.version !== 1 ||
    value.userId !== userId ||
    !isElementFormValues(value.values)
  ) {
    return undefined
  }

  return value.values
}

export function parseElementAutoSaveForUser(
  serializedValue: string | null,
  userId: string | undefined
): ElementFormTypes | undefined {
  if (serializedValue === null) {
    return undefined
  }

  try {
    return getElementAutoSaveForUser(JSON.parse(serializedValue), userId)
  } catch {
    return undefined
  }
}

export function useElementAutoSave(
  storageKey: string,
  userId: string | undefined
): {
  autoSavedElement: ElementFormTypes | undefined
  loaded: boolean
  setAutoSavedElement: (value: ElementFormTypes | undefined) => void
} {
  const [state, setState] = useState<{
    storageKey: string
    userId: string | undefined
    value: ElementFormTypes | undefined
  }>()
  const loaded =
    state?.storageKey === storageKey &&
    state.userId === userId &&
    Boolean(userId)

  useEffect(() => {
    if (!userId) {
      setState({ storageKey, userId, value: undefined })
      return
    }

    const serializedValue = localStorage.getItem(storageKey)
    const values = parseElementAutoSaveForUser(serializedValue, userId)

    if (serializedValue !== null && !values) {
      localStorage.removeItem(storageKey)
    }

    setState({ storageKey, userId, value: values })
  }, [storageKey, userId])

  const setAutoSavedElement = useCallback(
    (value: ElementFormTypes | undefined) => {
      const storedValue = userId ? value : undefined

      if (storedValue && userId) {
        const autoSave: ElementAutoSave = {
          version: 1,
          userId,
          values: storedValue,
        }
        localStorage.setItem(storageKey, JSON.stringify(autoSave))
      } else {
        localStorage.removeItem(storageKey)
      }

      setState({ storageKey, userId, value: storedValue })
    },
    [storageKey, userId]
  )

  return {
    autoSavedElement: loaded ? state.value : undefined,
    loaded,
    setAutoSavedElement,
  }
}

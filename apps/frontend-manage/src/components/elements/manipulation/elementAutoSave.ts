import {
  CodeTestVisibility,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect, useState } from 'react'
import { ElementFormTypes } from './types'

export type ElementAutoSave = {
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
    (choice) => isRecord(choice) && typeof choice.id === 'string'
  )
}

function hasNumericalOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.restrictions === undefined ||
      value.restrictions === null ||
      isRecord(value.restrictions)) &&
    (value.solutionRanges === undefined ||
      value.solutionRanges === null ||
      (Array.isArray(value.solutionRanges) &&
        value.solutionRanges.every(isRecord))) &&
    (value.exactSolutions === undefined ||
      value.exactSolutions === null ||
      Array.isArray(value.exactSolutions))
  )
}

function hasFreeTextOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    (value.restrictions === undefined ||
      value.restrictions === null ||
      isRecord(value.restrictions)) &&
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
    (value.manuallyCreatedItems === undefined ||
      Array.isArray(value.manuallyCreatedItems)) &&
    (value.correctAnswers === undefined || Array.isArray(value.correctAnswers))
  )
}

function hasCaseStudyOptions(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.hasSampleSolution === 'boolean' &&
    Array.isArray(value.cases) &&
    value.cases.every(
      (caseItem) =>
        isRecord(caseItem) &&
        typeof caseItem.id === 'string' &&
        typeof caseItem.title === 'string' &&
        typeof caseItem.description === 'string'
    ) &&
    Array.isArray(value.criteria) &&
    value.criteria.every(
      (criterion) =>
        isRecord(criterion) &&
        typeof criterion.id === 'string' &&
        typeof criterion.name === 'string' &&
        typeof criterion.step === 'string'
    ) &&
    (value.selectedItems === undefined || Array.isArray(value.selectedItems)) &&
    (value.manuallyCreatedItems === undefined ||
      Array.isArray(value.manuallyCreatedItems))
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
      return hasChoicesOptions(value.options)
    case ElementType.Numerical:
      return hasNumericalOptions(value.options)
    case ElementType.FreeText:
      return hasFreeTextOptions(value.options)
    case ElementType.Code:
      return hasCodeOptions(value.options)
    case ElementType.Selection:
      return hasSelectionOptions(value.options)
    case ElementType.CaseStudy:
      return hasCaseStudyOptions(value.options)
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
  if (!serializedValue) {
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
  autoSavedElement: ElementAutoSave | undefined
  loaded: boolean
  setAutoSavedElement: (value: ElementAutoSave | undefined) => void
} {
  const [state, setState] = useState<{
    storageKey: string
    userId: string | undefined
    value: ElementAutoSave | undefined
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
    const value = values ? { version: 1 as const, userId, values } : undefined

    if (serializedValue && !value) {
      localStorage.removeItem(storageKey)
    }

    setState({ storageKey, userId, value })
  }, [storageKey, userId])

  const setAutoSavedElement = useCallback(
    (value: ElementAutoSave | undefined) => {
      if (value) {
        localStorage.setItem(storageKey, JSON.stringify(value))
      } else {
        localStorage.removeItem(storageKey)
      }

      setState({ storageKey, userId, value })
    },
    [storageKey, userId]
  )

  return {
    autoSavedElement: loaded ? state.value : undefined,
    loaded,
    setAutoSavedElement,
  }
}

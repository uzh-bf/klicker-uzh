import { nanoid } from 'nanoid'
import { useMemo } from 'react'
import { sort } from 'remeda'
import {
  ElementDisplayMode,
  ElementStatus,
  ElementType,
  type EditableElement,
} from '../../../lib/constants/elementTypes'
import { ElementEditMode } from './ElementEditModal'
import {
  ChoicesElementType,
  ElementFormTypes,
  ElementFormTypesCaseStudySolution,
  ElementFormTypesCaseStudySolutions,
} from './types'

interface UseElementFormInitialValuesProps {
  mode: ElementEditMode
  question?: EditableElement | null
  isDuplication: boolean
}

type ChoiceOption = {
  ix: number
  value?: string | null
  correct?: boolean | null
  feedback?: string | null
}

type NumericalOptions = {
  hasSampleSolution?: boolean | null
  exactSolutions?: (number | string)[] | null
  accuracy?: number | null
  unit?: string | null
  restrictions?: {
    min?: number | string | null
    max?: number | string | null
  } | null
  solutionRanges?:
    | { min?: number | string | null; max?: number | string | null }[]
    | null
}

type CaseStudyCriterion = {
  id: string
  name: string
  min: number
  max: number
  step: number
  unit?: string | null
  labels?: {
    min: string
    mid?: string | null
    max: string
  } | null
}

type CaseStudySolution = {
  itemId: number
  criteriaSolutions: {
    criterionId: string
    min: number
    max: number
  }[]
}

type CaseStudyCase = {
  id: string
  title: string
  description: string
  solutions?: CaseStudySolution[] | null
}

function useElementFormInitialValues({
  mode,
  question,
  isDuplication,
}: UseElementFormInitialValuesProps) {
  return useMemo((): ElementFormTypes | undefined => {
    if (mode === ElementEditMode.CREATE) {
      return {
        type: ElementType.Sc,
        name: '',
        status: ElementStatus.Ready,
        content: '',
        explanation: '',
        tags: [],
        basePoints: true,
        pointsMultiplier: '1',
        options: {
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          displayMode: ElementDisplayMode.List,
          choices: [
            {
              id: nanoid(),
              ix: 0,
              value: undefined,
              correct: false,
              feedback: '',
            },
          ],
        },
      }
    }

    if (!question) {
      return undefined
    }

    const sharedAttributes = {
      name: isDuplication ? `${question.name} (Copy)` : question.name,
      status: question.status,
      content: question.content,
      explanation: question.explanation ?? '',
      tags: question.tags?.map((tag) => tag.name) ?? [],
      basePoints: question.basePoints,
      pointsMultiplier: String(question.pointsMultiplier),
    }

    if (question.__typename === 'ChoicesElement') {
      const options = question.options as {
        hasSampleSolution?: boolean | null
        hasAnswerFeedbacks?: boolean | null
        displayMode: ElementDisplayMode
        choices: ChoiceOption[]
      }

      return {
        ...sharedAttributes,
        type: question.type as ChoicesElementType,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
          hasAnswerFeedbacks: options.hasAnswerFeedbacks ?? false,
          displayMode: options.displayMode,
          choices: sort(
            options.choices.map((choice) => ({
              ...choice,
              id: nanoid(),
            })),
            (a, b) => (a.ix > b.ix ? 1 : -1)
          ),
        },
      }
    } else if (question.__typename === 'NumericalElement') {
      const options = question.options as NumericalOptions

      return {
        ...sharedAttributes,
        type: ElementType.Numerical,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
          solutionType: options.exactSolutions ? 'exact' : 'range',
          accuracy: options.accuracy,
          unit: options.unit,
          restrictions: options.restrictions
            ? {
                min: options.restrictions.min,
                max: options.restrictions.max,
              }
            : undefined,
          solutionRanges: options.solutionRanges
            ? options.solutionRanges.map((range) => ({
                min: range.min,
                max: range.max,
              }))
            : undefined,
          exactSolutions: options.exactSolutions ?? undefined,
        },
      }
    } else if (question.__typename === 'FreeTextElement') {
      const options = question.options as {
        hasSampleSolution?: boolean | null
        restrictions?: { maxLength?: number | string | null } | null
        solutions?: string[] | null
      }

      return {
        ...sharedAttributes,
        type: ElementType.FreeText,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
          restrictions: options.restrictions
            ? {
                maxLength: options.restrictions.maxLength,
              }
            : undefined,
          solutions: options.solutions,
        },
      }
    } else if (question.__typename === 'SelectionElement') {
      const options = question.options as {
        hasSampleSolution?: boolean | null
        numberOfInputs?: number | string | null
        answerCollection?: { id: number } | null
        answerCollectionSolutionIds?: number[] | null
      }

      return {
        ...sharedAttributes,
        type: ElementType.Selection,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
          numberOfInputs: String(options.numberOfInputs),
          answerCollection: options.answerCollection
            ? String(options.answerCollection?.id)
            : '',
          correctAnswers: options.answerCollectionSolutionIds ?? undefined,
        },
      }
    } else if (question.__typename === 'CaseStudyElement') {
      const options = question.options as {
        hasSampleSolution?: boolean | null
        answerCollectionId?: number | null
        collectionItemIds?: number[] | null
        criteria?: CaseStudyCriterion[]
        cases?: CaseStudyCase[]
      }

      return {
        ...sharedAttributes,
        type: ElementType.CaseStudy,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
          itemSelectionMode: 'existing', // manual definition of elements not supported for element editing
          answerCollection: options.answerCollectionId
            ? String(options.answerCollectionId)
            : '',
          selectedItems: options.collectionItemIds ?? [],
          manuallyCreatedItems: [],
          criteria:
            options.criteria?.map((criterion) => ({
              ...criterion,
              mode: criterion.labels ? 'steps' : 'range',
              min: criterion.min,
              max: criterion.max,
              step: String(criterion.step),
            })) ?? [],
          cases:
            options.cases?.map((caseItem) => ({
              id: caseItem.id,
              title: caseItem.title,
              description: caseItem.description,
              solutions: options.hasSampleSolution
                ? caseItem.solutions!.reduce<ElementFormTypesCaseStudySolutions>(
                    (acc, solution) => {
                      const criteriaSolutions =
                        solution.criteriaSolutions.reduce<ElementFormTypesCaseStudySolution>(
                          (acc, sol) => {
                            acc[sol.criterionId] = {
                              min: String(sol.min),
                              max: String(sol.max),
                            }

                            return acc
                          },
                          {}
                        )

                      acc[`itemId-${solution.itemId}`] = criteriaSolutions
                      return acc
                    },
                    {}
                  )
                : undefined,
            })) ?? [],
        },
      }
    } else if (question.__typename === 'FlashcardElement') {
      return {
        ...sharedAttributes,
        type: ElementType.Flashcard,
        explanation: question.explanation ?? '',
      }
    } else if (question.__typename === 'ContentElement') {
      return {
        ...sharedAttributes,
        type: ElementType.Content,
      }
    }

    return undefined
  }, [mode, question, isDuplication])
}

export default useElementFormInitialValues

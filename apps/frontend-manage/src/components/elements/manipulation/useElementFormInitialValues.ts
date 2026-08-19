import {
  Element,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import type { SemanticFreeTextConfig } from '@klicker-uzh/types'
import { nanoid } from 'nanoid'
import { useMemo } from 'react'
import { sort } from 'remeda'
import { ElementEditMode } from './ElementEditModal'
import {
  ElementFormTypes,
  ElementFormTypesCaseStudySolution,
  ElementFormTypesCaseStudySolutions,
} from './types'

interface UseElementFormInitialValuesProps {
  mode: ElementEditMode
  question?: Element | null
  isDuplication: boolean
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
      const options = question.options

      return {
        ...sharedAttributes,
        type: question.type as
          | ElementType.Sc
          | ElementType.Mc
          | ElementType.Kprim,
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
      const options = question.options

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
      const options = question.options

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
          semanticEvaluation:
            (options.semanticEvaluation as SemanticFreeTextConfig | null) ??
            undefined,
        },
      }
    } else if (question.__typename === 'SelectionElement') {
      const options = question.options

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
      const options = question.options

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
            options.cases.map((caseItem) => ({
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

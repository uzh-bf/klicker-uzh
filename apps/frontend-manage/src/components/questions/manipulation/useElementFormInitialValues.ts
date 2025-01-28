import {
  Element,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
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
        status: ElementStatus.Ready,
        type: ElementType.Sc,
        name: '',
        content: '',
        explanation: '',
        tags: [],
        pointsMultiplier: '1',
        options: {
          hasSampleSolution: false,
          hasAnswerFeedbacks: false,
          displayMode: ElementDisplayMode.List,
          choices: [
            {
              id: nanoid(),
              value: undefined,
              correct: false,
              feedback: undefined,
            },
          ],
        },
      }
    }

    if (!question) {
      return undefined
    }

    const sharedAttributes = {
      status: question.status,
      name: isDuplication ? `${question.name} (Copy)` : question.name,
      content: question.content,
      explanation: question.explanation ?? '',
      tags: question.tags?.map((tag) => tag.name) ?? [],
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
          answerCollection: options.answerCollection
            ? String(options.answerCollection.id)
            : '',
          selectedItems: options.collectionItemIds ?? [],
          criteria:
            options.criteria?.map((criterion) => ({
              ...criterion,
              min: String(criterion.min),
              max: String(criterion.max),
              step: String(criterion.step),
            })) ?? [],
          cases:
            options.cases?.map((caseItem) => ({
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

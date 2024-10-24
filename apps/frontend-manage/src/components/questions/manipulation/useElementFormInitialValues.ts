import {
  Element,
  ElementDisplayMode,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'
import { ElementEditMode } from './ElementEditModal'
import { ElementFormTypes } from './types'

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
    if (mode === ElementEditMode.CREATE || !question) {
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
            { ix: 0, value: undefined, correct: false, feedback: undefined },
          ],
        },
      }
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
          choices: options.choices.map((choice) => ({
            ix: choice.ix,
            value: choice.value,
            correct: choice.correct,
            feedback: choice.feedback,
          })),
        },
      }
    } else if (question.__typename === 'NumericalElement') {
      const options = question.options

      return {
        ...sharedAttributes,
        type: ElementType.Numerical,
        options: {
          hasSampleSolution: options.hasSampleSolution ?? false,
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
  }, [question, mode])
}

export default useElementFormInitialValues

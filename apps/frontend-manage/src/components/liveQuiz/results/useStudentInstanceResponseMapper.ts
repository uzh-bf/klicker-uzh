import {
  ElementInstance,
  ElementType,
  GetLiveQuizStudentAssessmentResponsesQuery,
} from '@klicker-uzh/graphql/dist/ops'
import type {
  CaseStudyStudentResponseType,
  ChoicesStudentResponseType,
  InstanceStackStudentResponseType,
  SelectionStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import type { SingleQuestionResponseLiveQuiz } from '@klicker-uzh/types'
import { useCallback } from 'react'

export type LiveQuizStudentBlocks = NonNullable<
  GetLiveQuizStudentAssessmentResponsesQuery['liveQuizStudentAssessmentResponses']
>

export function useStudentInstanceResponseMapper() {
  return useCallback(
    ({
      instance,
      submission,
    }: {
      instance: ElementInstance
      submission: SingleQuestionResponseLiveQuiz
    }): InstanceStackStudentResponseType | null => {
      const elementType = instance.elementType

      if (elementType === ElementType.Flashcard) {
        // ? flashcards are not supported in live quizzes
        return null

        // if (!('correctness' in submission)) return null
        // return {
        //   type: ElementType.Flashcard,
        //   response: submission.correctness,
        //   valid: true,
        // }
      }

      if (elementType === ElementType.Content) {
        if (!('viewed' in submission)) return null
        return {
          type: ElementType.Content,
          response: submission.viewed,
          valid: true,
        }
      }

      if (
        elementType === ElementType.Sc ||
        elementType === ElementType.Mc ||
        elementType === ElementType.Kprim
      ) {
        if (!('choices' in submission) || !submission.choices) return null
        const elementData = instance.elementData
        const responseMap = (
          elementData.__typename === 'ChoicesElementData'
            ? elementData.options.choices
            : []
        ).reduce<ChoicesStudentResponseType>((acc, choice) => {
          const submittedChoice = submission.choices?.find(
            (submitted) => submitted.ix === choice.ix
          )
          acc[choice.ix] = Boolean(submittedChoice?.selected)
          return acc
        }, {})

        return {
          type: elementType,
          response: responseMap,
          valid: true,
        }
      }

      if (elementType === ElementType.Numerical) {
        if (
          !('value' in submission) ||
          typeof submission.value === 'undefined'
        ) {
          return null
        }

        return {
          type: ElementType.Numerical,
          response: String(submission.value),
          valid: true,
        }
      }

      if (elementType === ElementType.FreeText) {
        if (
          !('value' in submission) ||
          typeof submission.value === 'undefined'
        ) {
          return null
        }

        return {
          type: ElementType.FreeText,
          response: String(submission.value),
          valid: true,
        }
      }

      if (elementType === ElementType.Code) {
        if (!('code' in submission) || typeof submission.code !== 'string') {
          return null
        }

        return {
          type: ElementType.Code,
          response: submission.code,
          valid: true,
        }
      }

      if (elementType === ElementType.Selection) {
        if (!('selection' in submission) || !submission.selection) return null

        const response: SelectionStudentResponseType = {}
        submission.selection.forEach((answerId, ix) => {
          if (answerId !== null && typeof answerId !== 'undefined') {
            response[ix] = answerId
          }
        })

        return {
          type: ElementType.Selection,
          response,
          valid: true,
        }
      }

      if (elementType === ElementType.CaseStudy) {
        if (!('assessment' in submission) || !submission.assessment) {
          return null
        }

        return {
          type: ElementType.CaseStudy,
          response: submission.assessment as CaseStudyStudentResponseType,
          valid: true,
        }
      }

      return null
    },
    []
  )
}

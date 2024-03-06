import {
  ChoicesElementData,
  ElementStack,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import React, { useEffect } from 'react'
import { StudentResponseType } from '../StudentElement'

interface UseStudentResponseProps {
  stack: ElementStack
  currentStep: number
  setStudentResponse: React.Dispatch<React.SetStateAction<StudentResponseType>>
  defaultRead?: boolean
}

function useStudentResponse({
  stack,
  currentStep,
  setStudentResponse,
  defaultRead = false,
}: UseStudentResponseProps) {
  useEffect(() => {
    const newStudentResponse =
      stack.elements?.reduce((acc, element) => {
        if (
          element.elementData.type === ElementType.Kprim ||
          element.elementData.type === ElementType.Mc ||
          element.elementData.type === ElementType.Sc
        ) {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: (
                element.elementData as ChoicesElementData
              ).options.choices.reduce((acc, _, ix) => {
                return { ...acc, [ix]: undefined }
              }, {} as Record<number, boolean | undefined>),
              correct: undefined,
              valid: false,
            },
          }
        } else if (element.elementData.type === ElementType.Content) {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: defaultRead ? true : undefined,
              correct: undefined,
              valid: true,
            },
          }
        }
        // default case - valid for FREE_TEXT, NUMERICAL, FLASHCARD elements
        else {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: undefined,
              correct: undefined,
              valid: false,
            },
          }
        }
      }, {} as StudentResponseType) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep, stack.elements])
}

export default useStudentResponse

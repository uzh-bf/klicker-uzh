import type { ElementStack } from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import React, { useEffect } from 'react'
import type { ElementChoicesType, StudentResponseType } from '../StudentElement'

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
        if (element.elementData.__typename === 'ChoicesElementData') {
          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type as ElementChoicesType,
              response: element.elementData.options.choices.reduce(
                (acc, _, ix) => {
                  return { ...acc, [ix]: undefined }
                },
                {} as Record<number, boolean | undefined>
              ),
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

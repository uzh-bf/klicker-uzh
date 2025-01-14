import { ElementType, type ElementStack } from '@klicker-uzh/graphql/dist/ops'
import type { SelectionElementData } from '@klicker-uzh/types'
import React, { useEffect } from 'react'
import getEmptySelectionResponse from 'src/utils/getEmptySelectionResponse'
import type {
  ElementChoicesType,
  StackStudentResponseType,
} from '../StudentElement'

interface UseStudentResponseProps {
  stack: ElementStack
  currentStep: number
  setStudentResponse: React.Dispatch<
    React.SetStateAction<StackStudentResponseType>
  >
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
                (acc, choice) => {
                  return { ...acc, [choice.ix]: undefined }
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
        } else if (element.elementData.type === ElementType.Selection) {
          const emptyResponses = getEmptySelectionResponse({
            numberOfInputs: (element.elementData as SelectionElementData)
              .options.numberOfInputs,
          })

          return {
            ...acc,
            [element.id]: {
              type: element.elementData.type,
              response: emptyResponses,
              correct: undefined,
              valid: false,
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
      }, {} as StackStudentResponseType) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep, stack.elements])
}

export default useStudentResponse

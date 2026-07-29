import { ElementType, type ElementStack } from '@klicker-uzh/graphql/dist/ops'
import type { SelectionElementData } from '@klicker-uzh/types'
import React, { useEffect } from 'react'
import type {
  CaseStudyStudentResponseType,
  ElementChoicesType,
  StackStudentResponseType,
} from '../StudentElement'
import getEmptySelectionResponse from '../utils/getEmptySelectionResponse'

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
      stack.elements?.reduce<StackStudentResponseType>((acc, element) => {
        if (element.elementData.__typename === 'ChoicesElementData') {
          acc[element.id] = {
            type: element.elementData.type as ElementChoicesType,
            response: element.elementData.options.choices.reduce<
              Record<number, boolean | undefined>
            >((acc, choice) => {
              return { ...acc, [choice.ix]: undefined }
            }, {}),
            valid: false,
          }

          return acc
        } else if (element.elementData.__typename === 'ContentElementData') {
          acc[element.id] = {
            type: ElementType.Content,
            response: defaultRead ? true : undefined,
            valid: true,
          }

          return acc
        } else if (element.elementData.__typename === 'SelectionElementData') {
          const emptyResponses = getEmptySelectionResponse({
            numberOfInputs: (element.elementData as SelectionElementData)
              .options.numberOfInputs,
          })

          acc[element.id] = {
            type: ElementType.Selection,
            response: emptyResponses,
            valid: false,
          }
          return acc
        } else if (element.elementData.__typename === 'CaseStudyElementData') {
          const cases = element.elementData.options.cases
          const items = element.elementData.options.items
          const criteria = element.elementData.options.criteria

          // compute the correct empty type by reducing cases, items and criteria
          const emptyResponse = cases.reduce<CaseStudyStudentResponseType>(
            (caseAcc, caseObj) => {
              caseAcc[caseObj.id] = (items ?? []).reduce<
                CaseStudyStudentResponseType['']
              >((itemAcc, item) => {
                itemAcc[item.id] = criteria.reduce<
                  CaseStudyStudentResponseType['']['']
                >((criterionAcc, criterion) => {
                  criterionAcc[criterion.id] = undefined
                  return criterionAcc
                }, {})
                return itemAcc
              }, {})
              return caseAcc
            },
            {}
          )

          acc[element.id] = {
            type: ElementType.CaseStudy,
            response: emptyResponse,
            valid: false,
          }

          return acc
        } else if (element.elementData.__typename === 'CodeElementData') {
          const starterCode = element.elementData.options.starterCode ?? ''
          acc[element.id] = {
            type: ElementType.Code,
            response: starterCode,
            valid: starterCode.length > 0,
          }

          return acc
        } else {
          // default case - valid for FREE_TEXT, NUMERICAL, FLASHCARD elements
          acc[element.id] = {
            type: element.elementData.type,
            response: undefined,
            valid: false,
          }

          return acc
        }
      }, {}) || {}

    setStudentResponse(newStudentResponse)
  }, [currentStep, stack.elements])
}

export default useStudentResponse

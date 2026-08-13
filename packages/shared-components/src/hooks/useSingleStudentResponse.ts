import type { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import React, { useEffect } from 'react'
import type {
  CaseStudyStudentResponseType,
  ElementChoicesType,
  InstanceStackStudentResponseType,
} from '../StudentElement'

function useSingleStudentResponse({
  instance,
  setStudentResponse,
  defaultRead = false,
}: {
  instance?: ElementInstance | null
  setStudentResponse: React.Dispatch<
    React.SetStateAction<InstanceStackStudentResponseType>
  >
  defaultRead?: boolean
}) {
  useEffect(() => {
    if (!instance) {
      return
    }

    if (instance.elementData.__typename === 'ChoicesElementData') {
      setStudentResponse({
        type: instance.elementData.type as ElementChoicesType,
        response: instance.elementData.options.choices.reduce(
          (acc, _, ix) => {
            return { ...acc, [ix]: undefined }
          },
          {} as Record<number, boolean | undefined>
        ),
        valid: false,
      })
    } else if (instance.elementData.__typename === 'ContentElementData') {
      setStudentResponse({
        type: ElementType.Content,
        response: defaultRead ? true : undefined,
        valid: true,
      })
    } else if (instance.elementData.__typename === 'CaseStudyElementData') {
      const cases = instance.elementData.options.cases
      const items = instance.elementData.options.items
      const criteria = instance.elementData.options.criteria

      // compute the correct empty type by reducing cases, items and criteria
      const emptyResponse = cases.reduce<CaseStudyStudentResponseType>(
        (acc, caseObj) => {
          acc[caseObj.id] = (items ?? []).reduce<
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
          return acc
        },
        {}
      )

      setStudentResponse({
        type: ElementType.CaseStudy,
        response: emptyResponse,
        valid: false,
      })
    }
    // default case - valid for FREE_TEXT, NUMERICAL, FLASHCARD elements
    // SELECTION response can be set to undefined -> will be overwritten in SelectionQuestion component
    else {
      setStudentResponse({
        type: instance.elementData.type,
        response: undefined,
        valid: false,
      })
    }
  }, [defaultRead, instance, setStudentResponse])
}

export default useSingleStudentResponse

import type { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { ElementType } from '@klicker-uzh/graphql/dist/ops'
import React, { useEffect } from 'react'
import type {
  CaseStudyStudentResponseType,
  ElementChoicesType,
  InstanceStackStudentResponseType,
} from '../StudentElement'

function getInitialSingleStudentResponse(
  instance?: ElementInstance | null,
  defaultRead = false
): InstanceStackStudentResponseType | null {
  if (!instance) return null

  if (instance.elementData.__typename === 'ChoicesElementData') {
    return {
      type: instance.elementData.type as ElementChoicesType,
      response: instance.elementData.options.choices.reduce(
        (acc, _, ix) => ({ ...acc, [ix]: undefined }),
        {} as Record<number, boolean | undefined>
      ),
      valid: false,
    }
  }
  if (instance.elementData.__typename === 'ContentElementData') {
    return {
      type: ElementType.Content,
      response: defaultRead ? true : undefined,
      valid: true,
    }
  }
  if (instance.elementData.__typename === 'CaseStudyElementData') {
    const { cases, items, criteria } = instance.elementData.options
    const response = cases.reduce<CaseStudyStudentResponseType>(
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

    return { type: ElementType.CaseStudy, response, valid: false }
  }

  return {
    type: instance.elementData.type,
    response: undefined,
    valid: false,
  }
}

function useSingleStudentResponse({
  instance,
  setStudentResponse,
  defaultRead = false,
  resetKey,
}: {
  instance?: ElementInstance | null
  setStudentResponse: React.Dispatch<
    React.SetStateAction<InstanceStackStudentResponseType>
  >
  defaultRead?: boolean
  resetKey?: unknown
}) {
  useEffect(() => {
    const initialResponse = getInitialSingleStudentResponse(
      instance,
      defaultRead
    )
    if (initialResponse) setStudentResponse(initialResponse)
  }, [defaultRead, instance, resetKey, setStudentResponse])
}

export default useSingleStudentResponse

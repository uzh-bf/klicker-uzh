import { useQuery } from '@apollo/client'
import {
  ElementFeedback,
  GetStackElementFeedbacksDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useStackElementFeedbacks({ instanceIds }: { instanceIds: number[] }) {
  const { data: elementFeedbackData } = useQuery(
    GetStackElementFeedbacksDocument,
    {
      variables: {
        instanceIds: instanceIds,
      },
    }
  )

  const mappedElementFeedbacks = useMemo(() => {
    if (!elementFeedbackData || !elementFeedbackData.getStackElementFeedbacks) {
      return {}
    }

    return elementFeedbackData.getStackElementFeedbacks.reduce(
      (acc, feedback) => {
        acc[feedback.elementInstanceId] = feedback
        return acc
      },
      {} as Record<number, ElementFeedback>
    )
  }, [elementFeedbackData])

  return mappedElementFeedbacks
}

export default useStackElementFeedbacks

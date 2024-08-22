import { useQuery } from '@apollo/client'
import {
  ElementFeedback,
  GetStackElementFeedbacksDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useMemo } from 'react'

function useStackElementFeedbacks({
  instanceIds,
  withParticipant,
}: {
  instanceIds: number[]
  withParticipant: boolean
}) {
  const { data: elementFeedbackData } = useQuery(
    GetStackElementFeedbacksDocument,
    {
      variables: {
        instanceIds: instanceIds,
      },
      skip: !withParticipant,
    }
  )

  const mappedElementFeedbacks = useMemo(() => {
    if (
      !withParticipant ||
      !elementFeedbackData ||
      !elementFeedbackData.getStackElementFeedbacks
    ) {
      return {}
    }

    return elementFeedbackData.getStackElementFeedbacks.reduce(
      (acc, feedback) => {
        acc[feedback.elementInstanceId] = feedback
        return acc
      },
      {} as Record<number, ElementFeedback>
    )
  }, [elementFeedbackData, withParticipant])

  return mappedElementFeedbacks
}

export default useStackElementFeedbacks

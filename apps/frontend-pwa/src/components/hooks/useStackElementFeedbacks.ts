import { useMemo } from 'react'
import { trpc } from '../../lib/trpc'

export type StackElementFeedback = {
  id: number
  upvote: boolean
  downvote: boolean
  feedback?: string | null
  elementInstanceId: number
}

function useStackElementFeedbacks({
  instanceIds,
  withParticipant,
}: {
  instanceIds: number[]
  withParticipant: boolean
}) {
  const { data: elementFeedbackData } =
    trpc.participant.stackElementFeedbacks.useQuery(
      {
        instanceIds,
      },
      {
        enabled: withParticipant,
      }
    )

  const mappedElementFeedbacks = useMemo(() => {
    if (!withParticipant || !elementFeedbackData) {
      return {}
    }

    return elementFeedbackData.reduce<Record<number, StackElementFeedback>>(
      (acc, feedback) => {
        acc[feedback.elementInstanceId] = feedback
        return acc
      },
      {}
    )
  }, [elementFeedbackData, withParticipant])

  return mappedElementFeedbacks
}

export default useStackElementFeedbacks

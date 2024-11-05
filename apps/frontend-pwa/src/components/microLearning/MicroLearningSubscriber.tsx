import {
  MicroLearning,
  MicroLearningEndedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface MicroLearningSubscriberProps {
  activityId: string
  subscribeToMore: any
  setEndedMicroLearning: Dispatch<SetStateAction<boolean>>
}

function MicroLearningSubscriber({
  activityId,
  subscribeToMore,
  setEndedMicroLearning,
}: MicroLearningSubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: MicroLearningEndedDocument,
      variables: { activityId },
      updateQuery: (
        prev: { microLearning: MicroLearning },
        {
          subscriptionData,
        }: {
          subscriptionData: {
            data: { microLearningEnded: MicroLearning }
          }
        }
      ): { microLearning: MicroLearning } => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended microlearning
        setEndedMicroLearning(true)

        // update the values returned by the course overview data query
        const updatedMicroLearning = {
          ...prev.microLearning,
          ...subscriptionData.data.microLearningEnded,
        }

        return { microLearning: updatedMicroLearning }
      },
    })
  }, [activityId, subscribeToMore])

  return null
}

export default MicroLearningSubscriber

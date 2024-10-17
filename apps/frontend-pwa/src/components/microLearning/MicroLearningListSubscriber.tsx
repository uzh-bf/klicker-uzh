import {
  Course,
  MicroLearning,
  MicroLearningEndedDocument,
  Participation,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface MicroLearningListSubscriberProps {
  activityId: string
  subscribeToMore: any
  setEndedMicroLearning: Dispatch<SetStateAction<string | undefined>>
}

function MicroLearningListSubscriber({
  activityId,
  subscribeToMore,
  setEndedMicroLearning,
}: MicroLearningListSubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: MicroLearningEndedDocument,
      variables: { activityId },
      updateQuery: (
        prev: { participations: Participation[] },
        {
          subscriptionData,
        }: {
          subscriptionData: {
            data: { microLearningEnded: MicroLearning }
          }
        }
      ): { participations: Participation[] } => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended microlearning
        setEndedMicroLearning(
          subscriptionData.data.microLearningEnded.displayName
        )

        // update the values returned by the course overview data query
        const updatedParticipations: Participation[] = prev.participations.map(
          (participation) => {
            const microLearningIds = participation.course?.microLearnings?.map(
              (ml) => ml.id
            )
            if (microLearningIds?.includes(activityId)) {
              return {
                ...participation,
                course: {
                  ...participation.course,
                  microLearnings:
                    participation.course?.microLearnings
                      ?.map((ml) => {
                        if (ml.id === activityId) {
                          return undefined
                        }
                        return ml
                      })
                      .filter((ml) => typeof ml !== 'undefined') ?? [],
                } as Course,
              }
            }
            return participation
          }
        )

        return { participations: updatedParticipations }
      },
    })
  }, [activityId, subscribeToMore])

  return null
}

export default MicroLearningListSubscriber

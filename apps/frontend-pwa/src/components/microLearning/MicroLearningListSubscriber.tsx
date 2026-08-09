import { SubscribeToMoreOptions } from '@apollo/client'
import {
  Course,
  MicroLearning,
  MicroLearningEndedDocument,
  Participation,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

function MicroLearningListSubscriber({
  activityId,
  subscribeToMore,
}: {
  activityId: string
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}) {
  const t = useTranslations()

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
        toast({
          type: 'success',
          message: t('pwa.courses.microLearningEndedToast', {
            activityName: subscriptionData.data.microLearningEnded.displayName,
          }),
          options: { duration: 10000 },
        })

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
  }, [activityId, subscribeToMore, t])

  return null
}

export default MicroLearningListSubscriber

import { SubscribeToMoreOptions } from '@apollo/client'
import {
  MicroLearning,
  MicroLearningEndedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface MicroLearningSubscriberProps {
  activityId: string
  microLearningName: string
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function MicroLearningSubscriber({
  activityId,
  microLearningName,
  subscribeToMore,
}: MicroLearningSubscriberProps) {
  const t = useTranslations()

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
        toast({
          type: 'warning',
          message: t('pwa.courses.microLearningEndedToast', {
            activityName: microLearningName,
          }),
          options: { duration: 10000 },
        })

        // update the values returned by the course overview data query
        const updatedMicroLearning = {
          ...prev.microLearning,
          ...subscriptionData.data.microLearningEnded,
        }

        return { microLearning: updatedMicroLearning }
      },
    })
  }, [activityId, microLearningName, subscribeToMore, t])

  return null
}

export default MicroLearningSubscriber

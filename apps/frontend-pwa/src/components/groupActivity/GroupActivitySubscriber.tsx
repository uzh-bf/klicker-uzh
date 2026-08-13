import { SubscribeToMoreOptions } from '@apollo/client'
import {
  GroupActivity,
  GroupActivityDetails,
  SingleGroupActivityEndedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface GroupActivitySubscriberProps {
  activityId: string
  groupActivityName: string
  setActivityEnded: Dispatch<SetStateAction<boolean>>
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function GroupActivitySubscriber({
  activityId,
  groupActivityName,
  setActivityEnded,
  subscribeToMore,
}: GroupActivitySubscriberProps) {
  const t = useTranslations()

  useEffect(() => {
    subscribeToMore({
      document: SingleGroupActivityEndedDocument,
      variables: { activityId },
      updateQuery: (
        prev: { groupActivityDetails: GroupActivityDetails },
        {
          subscriptionData,
        }: {
          subscriptionData: {
            data: { singleGroupActivityEnded: GroupActivity }
          }
        }
      ) => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended group activity
        setActivityEnded(true)
        toast({
          type: 'warning',
          message: t('pwa.groupActivity.groupActivityEnded', {
            activityName: groupActivityName,
          }),
          options: { duration: 10000 },
        })

        // update the values returned by the course overview data query
        const updatedActivity = {
          ...prev.groupActivityDetails,
          status: subscriptionData.data.singleGroupActivityEnded.status,
        }
        return { groupActivityDetails: updatedActivity }
      },
    })
  }, [activityId, groupActivityName, setActivityEnded, subscribeToMore, t])

  return null
}

export default GroupActivitySubscriber

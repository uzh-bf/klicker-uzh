import {
  GroupActivity,
  GroupActivityDetails,
  SingleGroupActivityEndedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface GroupActivitySubscriberProps {
  activityId: string
  subscribeToMore: any
  setEndedGroupActivity: Dispatch<SetStateAction<boolean>>
}

function GroupActivitySubscriber({
  activityId,
  subscribeToMore,
  setEndedGroupActivity,
}: GroupActivitySubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: SingleGroupActivityEndedDocument,
      variables: { activityId },
      updateQuery: (
        prev: GroupActivityDetails,
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
        setEndedGroupActivity(true)

        // update the values returned by the course overview data query
        return {
          ...prev,
          status: subscriptionData.data.singleGroupActivityEnded.status,
        }
      },
    })
  }, [activityId, subscribeToMore])

  return null
}

export default GroupActivitySubscriber

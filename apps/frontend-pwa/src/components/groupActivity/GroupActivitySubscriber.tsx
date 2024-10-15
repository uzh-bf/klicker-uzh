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
        setEndedGroupActivity(true)

        // update the values returned by the course overview data query
        const updatedActivity = {
          ...prev.groupActivityDetails,
          status: subscriptionData.data.singleGroupActivityEnded.status,
        }
        return { groupActivityDetails: updatedActivity }
      },
    })
  }, [activityId, subscribeToMore])

  return null
}

export default GroupActivitySubscriber

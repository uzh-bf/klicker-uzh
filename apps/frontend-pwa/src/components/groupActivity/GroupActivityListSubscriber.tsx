import {
  GroupActivity,
  GroupActivityEndedDocument,
  GroupActivityStartedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface GroupActivityListSubscriberProps {
  courseId: string
  subscribeToMore: any
  setEndedGroupActivity: Dispatch<SetStateAction<string | undefined>>
  setStartedGroupActivity: Dispatch<SetStateAction<string | undefined>>
}

function GroupActivityListSubscriber({
  courseId,
  subscribeToMore,
  setEndedGroupActivity,
  setStartedGroupActivity,
}: GroupActivityListSubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: GroupActivityEndedDocument,
      variables: { courseId },
      updateQuery: (
        prev: { groupActivities: GroupActivity[] },
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { groupActivityEnded: GroupActivity } }
        }
      ): { groupActivities: GroupActivity[] } => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended group activity
        const updatedActivity = subscriptionData.data.groupActivityEnded
        setEndedGroupActivity(updatedActivity.displayName)

        // update the values returned by the course group activity data query
        const updatedQueryContent = prev.groupActivities.map((activity) =>
          activity.id === updatedActivity.id ? updatedActivity : activity
        )

        return { groupActivities: updatedQueryContent }
      },
    })

    subscribeToMore({
      document: GroupActivityStartedDocument,
      variables: { courseId },
      updateQuery: (
        prev: { groupActivities: GroupActivity[] },
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { groupActivityStarted: GroupActivity } }
        }
      ): { groupActivities: GroupActivity[] } => {
        if (!subscriptionData.data) return prev

        // required saveguard since the subscription is somehow triggered twice
        if (
          prev.groupActivities.some(
            (activity) =>
              activity.id === subscriptionData.data.groupActivityStarted.id
          )
        ) {
          return prev
        }

        // trigger toast for ended group activity
        const newActivity = subscriptionData.data.groupActivityStarted
        setStartedGroupActivity(newActivity.displayName)

        // update the values returned by the course overview data query
        const updatedQueryContent = [newActivity, ...prev.groupActivities]
        return { groupActivities: updatedQueryContent }
      },
    })
  }, [courseId, subscribeToMore])

  return null
}

export default GroupActivityListSubscriber

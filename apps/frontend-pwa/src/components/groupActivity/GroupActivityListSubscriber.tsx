import {
  GroupActivity,
  GroupActivityEndedDocument,
  ParticipantLearningData,
} from '@klicker-uzh/graphql/dist/ops'
import { Dispatch, SetStateAction, useEffect } from 'react'

interface GroupActivityListSubscriberProps {
  courseId: string
  subscribeToMore: any
  setEndedGroupActivity: Dispatch<SetStateAction<string | undefined>>
}

function GroupActivityListSubscriber({
  courseId,
  subscribeToMore,
  setEndedGroupActivity,
}: GroupActivityListSubscriberProps) {
  useEffect(() => {
    subscribeToMore({
      document: GroupActivityEndedDocument,
      variables: { courseId },
      updateQuery: (
        prev: ParticipantLearningData,
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { groupActivityEnded: GroupActivity } }
        }
      ) => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended group activity
        setEndedGroupActivity(subscriptionData.data.groupActivityEnded.id)

        // update the values returned by the course overview data query
        return {
          ...prev,
          course: {
            ...prev.course,
            groupActivities: prev.course?.groupActivities?.map((activity) =>
              activity.id === subscriptionData.data.groupActivityEnded.id
                ? {
                    ...subscriptionData.data.groupActivityEnded,
                  }
                : activity
            ),
          },
        }
      },
    })
  }, [courseId, subscribeToMore])

  return null
}

export default GroupActivityListSubscriber

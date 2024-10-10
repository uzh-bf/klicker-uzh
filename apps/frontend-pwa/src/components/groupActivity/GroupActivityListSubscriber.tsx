import {
  GroupActivity,
  GroupActivityEndedDocument,
  ParticipantLearningData,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'

interface GroupActivityListSubscriberProps {
  courseId: string
  subscribeToMore: any
}

function GroupActivityListSubscriber({
  courseId,
  subscribeToMore,
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

  return <div></div>
}

export default GroupActivityListSubscriber

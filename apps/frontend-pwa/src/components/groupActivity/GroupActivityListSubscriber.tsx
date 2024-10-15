import {
  GroupActivity,
  GroupActivityEndedDocument,
  GroupActivityStartedDocument,
  ParticipantLearningData,
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
        prev: ParticipantLearningData,
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { groupActivityEnded: GroupActivity } }
        }
      ) => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended group activity
        const updatedActivity = subscriptionData.data.groupActivityEnded
        setEndedGroupActivity(updatedActivity.displayName)

        // update the values returned by the course overview data query
        const updatedCourse = Object.assign({}, prev, {
          course: Object.assign({}, prev.course, {
            groupActivities: prev.course?.groupActivities?.map((activity) =>
              activity.id === updatedActivity.id
                ? { ...updatedActivity }
                : activity
            ),
          }),
        })

        return updatedCourse
      },
    })

    subscribeToMore({
      document: GroupActivityStartedDocument,
      variables: { courseId },
      updateQuery: (
        prev: ParticipantLearningData,
        {
          subscriptionData,
        }: {
          subscriptionData: { data: { groupActivityStarted: GroupActivity } }
        }
      ) => {
        if (!subscriptionData.data) return prev

        // trigger toast for ended group activity
        const newActivity = subscriptionData.data.groupActivityStarted
        setStartedGroupActivity(newActivity.displayName)

        // update the values returned by the course overview data query
        return Object.assign({}, prev, {
          course: Object.assign({}, prev.course ?? {}, {
            groupActivities: [
              newActivity,
              ...(prev.course?.groupActivities ?? []),
            ],
          }),
        })
      },
    })
  }, [courseId, subscribeToMore])

  return null
}

export default GroupActivityListSubscriber

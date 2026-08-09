import { SubscribeToMoreOptions } from '@apollo/client'
import {
  GroupActivity,
  GroupActivityEndedDocument,
  GroupActivityStartedDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

interface GroupActivityListSubscriberProps {
  courseId: string
  subscribeToMore: (doc: SubscribeToMoreOptions) => any
}

function GroupActivityListSubscriber({
  courseId,
  subscribeToMore,
}: GroupActivityListSubscriberProps) {
  const t = useTranslations()

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
        toast({
          type: 'warning',
          message: t('pwa.courses.groupActivityEndedToast', {
            activityName: updatedActivity.displayName,
          }),
          options: { duration: 10000 },
        })

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
        toast({
          type: 'success',
          message: t('pwa.courses.groupActivityStartedToast', {
            activityName: newActivity.displayName,
          }),
          options: { duration: 10000 },
        })

        // update the values returned by the course overview data query
        const updatedQueryContent = [newActivity, ...prev.groupActivities]
        return { groupActivities: updatedQueryContent }
      },
    })
  }, [courseId, subscribeToMore, t])

  return null
}

export default GroupActivityListSubscriber

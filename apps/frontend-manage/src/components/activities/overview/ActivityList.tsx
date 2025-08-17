import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import ActivityListEntry from './ActivityListEntry'

function ActivityList({
  activities,
  noActivities,
  hideActivityType = false,
  highlightedActivity,
  selectedActivities,
  openActivityDetailsId,
  setSelectedActivities,
  refetchActivities,
}: {
  activities: ActivityInfo[]
  noActivities: boolean
  hideActivityType?: boolean
  highlightedActivity: string | null
  selectedActivities?: Record<string, ActivityInfo>
  openActivityDetailsId?: string
  setSelectedActivities?: Dispatch<SetStateAction<Record<string, ActivityInfo>>>
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const router = useRouter()

  if (noActivities) {
    return (
      <UserNotification
        data={{ cy: 'no-activities-message' }}
        className={{ root: 'text-base' }}
      >
        {t.rich('manage.activities.noActivitiesAvailable', {
          link: (text) => (
            <Link
              href="/"
              className="text-primary-100 hover:text-primary-100 underline"
            >
              {text}
            </Link>
          ),
        })}
      </UserNotification>
    )
  }

  if (activities.length === 0) {
    return (
      <UserNotification
        data={{ cy: 'no-activities-filtered-message' }}
        className={{ root: 'text-base' }}
      >
        {t('manage.activities.noActivitiesForFilters')}
      </UserNotification>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {activities.map((activity) => (
        <ActivityListEntry
          key={`activity-list-entry-${activity.id}`}
          activity={activity}
          highlighted={
            router.query?.highlight
              ? (router.query.highlight as string) === activity.id
              : undefined
          }
          hideType={hideActivityType}
          checked={selectedActivities && !!selectedActivities[activity.id]}
          detailsOpen={
            typeof openActivityDetailsId !== 'undefined'
              ? openActivityDetailsId === activity.id
              : undefined
          }
          onCheck={
            setSelectedActivities
              ? () =>
                  setSelectedActivities((prev) => {
                    const next = { ...prev }
                    if (next[activity.id]) {
                      delete next[activity.id]
                    } else {
                      next[activity.id] = activity
                    }
                    return next
                  })
              : undefined
          }
          highlightedActivity={highlightedActivity}
          refetchActivities={refetchActivities}
        />
      ))}
    </div>
  )
}

export default ActivityList

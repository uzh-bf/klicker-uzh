import { ActivityInfo } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Dispatch, SetStateAction } from 'react'
import ActivityListEntry from './ActivityListEntry'

function ActivityList({
  filtersActive,
  activities,
  noActivities,
  hideActivityType = false,
  highlightedActivity,
  selectedActivities,
  setSelectedActivities,
  handleFilterReset,
  refetchActivities,
}: {
  filtersActive: boolean
  activities: ActivityInfo[]
  noActivities: boolean
  hideActivityType?: boolean
  highlightedActivity: string | null
  selectedActivities?: Record<string, ActivityInfo>
  setSelectedActivities?: Dispatch<SetStateAction<Record<string, ActivityInfo>>>
  handleFilterReset?: () => void
  refetchActivities?: () => Promise<void>
}) {
  const t = useTranslations()
  const router = useRouter()

  if (noActivities) {
    return (
      <UserNotification
        data={{ cy: 'no-activities-message' }}
        className={{ root: 'ml-6.5' }}
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

  return (
    <div className="flex flex-col gap-2">
      {filtersActive && (
        <UserNotification type="warning" className={{ root: 'ml-6.5' }}>
          {activities.length === 0 &&
            t('manage.activities.noActivitiesWarning')}{' '}
          {t.rich('manage.activities.activeFiltersWarning', {
            reset: (text) => (
              <button
                type="button"
                className="cursor-pointer border-0 bg-transparent p-0 font-bold underline"
                onClick={handleFilterReset}
              >
                {text}
              </button>
            ),
          })}
        </UserNotification>
      )}
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

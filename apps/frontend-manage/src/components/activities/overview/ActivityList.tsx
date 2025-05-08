import { faClock, faSquareCheck } from '@fortawesome/free-regular-svg-icons'
import {
  faCheck,
  faFilePen,
  faPencil,
  faPlay,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ActivityInfo, PublicationStatus } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ActivityListEntry from './ActivityListEntry'

function ActivityList({
  activities,
  noActivities,
}: {
  activities: ActivityInfo[]
  noActivities: boolean
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
    <>
      <div className="border-uzh-grey-60 flex flex-row flex-wrap items-center justify-end gap-y-1.5 space-x-5 pb-1.5 text-sm">
        <div className="flex h-4 flex-row items-center gap-2">
          <FontAwesomeIcon icon={faPencil} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Draft}.statusLabel`)}</div>
        </div>
        <div className="flex h-4 flex-row items-center gap-2 text-orange-600">
          <FontAwesomeIcon icon={faClock} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Scheduled}.statusLabel`)}</div>
        </div>
        <div className="flex h-4 flex-row items-center gap-2 text-green-700">
          <FontAwesomeIcon icon={faPlay} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Published}.statusLabel`)}</div>
        </div>
        <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
          <FontAwesomeIcon icon={faCheck} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Ended}.statusLabel`)}</div>
        </div>
        <div className="flex h-4 flex-row items-center gap-2 text-gray-500">
          <FontAwesomeIcon icon={faSquareCheck} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Graded}.statusLabel`)}</div>
        </div>
        <div className="flex h-4 flex-row items-center gap-2 text-red-700">
          <FontAwesomeIcon icon={faFilePen} className="h-4 w-4" />
          <div>{t(`shared.${PublicationStatus.Template}.statusLabel`)}</div>
        </div>
      </div>
      <div className="border-uzh-grey-60 border-t-2">
        {activities.map((activity) => (
          <ActivityListEntry
            key={`activity-list-entry-${activity.id}`}
            activity={activity}
            highlighted={
              router.query?.highlight
                ? (router.query.highlight as string) === activity.id
                : undefined
            }
          />
        ))}
      </div>
    </>
  )
}

export default ActivityList

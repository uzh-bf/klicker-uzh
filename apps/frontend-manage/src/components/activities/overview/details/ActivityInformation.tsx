import {
  ActivityDetails,
  ActivityType,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ActivityReviewStatus from '../ActivityReviewStatus'

function ActivityInformation({
  details,
  activityType,
  activityReviewStatus,
}: {
  details: ActivityDetails
  activityType: ActivityType
  activityReviewStatus: ReviewStatus
}) {
  const t = useTranslations()

  return (
    <UserNotification
      className={{ root: 'w-full text-base lg:w-2/3', content: 'w-full' }}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <span className="font-bold">
          {t('manage.activities.activityInformation')}
        </span>
        <ActivityReviewStatus reviewStatus={activityReviewStatus} />
      </div>
      <div className="mt-1 flex flex-col gap-0.5 text-sm">
        {[
          {
            label: t('manage.activityWizard.name'),
            value: details.name,
          },
          {
            label: t('manage.activityWizard.displayName'),
            value: details.displayName,
          },
          {
            label: t('manage.activities.activityType'),
            value: t(`shared.types.${activityType}`),
          },
          ...(details.arePointsAwarded
            ? [
                {
                  label: t('manage.activities.activityMultiplier'),
                  value: `${details.pointsMultiplier}x`,
                },
              ]
            : []),
        ].map(({ label, value }) => (
          <div key={label}>
            <span className="font-bold">{label}:</span> {value}
          </div>
        ))}
      </div>
    </UserNotification>
  )
}

export default ActivityInformation

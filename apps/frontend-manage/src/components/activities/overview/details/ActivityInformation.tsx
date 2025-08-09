import { ActivityDetails, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityInformation({
  details,
  activityType,
}: {
  details: ActivityDetails
  activityType: ActivityType
}) {
  const t = useTranslations()

  return (
    <UserNotification className={{ root: 'w-full text-base lg:w-2/3' }}>
      <div className="font-bold">
        {t('manage.activities.activityInformation')}
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

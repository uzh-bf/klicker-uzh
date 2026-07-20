import {
  faArrowRight,
  faCheckSquare,
  faXmarkSquare,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ActivityDetails,
  ActivityType,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import ActivityReviewStatus from '../ActivityReviewStatus'

function BooleanIcon({ value }: { value: boolean }) {
  return (
    <FontAwesomeIcon
      icon={value ? faCheckSquare : faXmarkSquare}
      className={twMerge(
        'ml-1',
        value ? 'text-uzh-darkgreen-100' : 'text-red-600'
      )}
    />
  )
}

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
      className={{ root: 'w-full text-base', content: 'w-full' }}
    >
      <div className="flex flex-row items-center justify-between gap-4">
        <span className="font-bold">
          {t('manage.activities.activityInformation')}
        </span>
        <ActivityReviewStatus reviewStatus={activityReviewStatus} />
      </div>
      <div className="mt-1 grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
        <div className="flex flex-col gap-0.5">
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
            {
              label: t('shared.generic.owner'),
              value: details.ownerEmail
                ? `${details.ownerShortname} (${details.ownerEmail})`
                : details.ownerShortname,
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="font-bold">{label}:</span> {value}
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-0.5">
          {[
            {
              label: t('shared.generic.gamification'),
              value: <BooleanIcon value={details.isGamificationEnabled} />,
            },
            ...(details.arePointsAwarded
              ? [
                  {
                    label: t('manage.activities.activityMultiplier'),
                    value: `${details.pointsMultiplier}x`,
                  },
                ]
              : []),
            {
              label: t('shared.generic.assessment'),
              value: <BooleanIcon value={details.isAssessmentEnabled} />,
            },
            {
              label: t('shared.generic.pinProtected'),
              value: (
                <span className="space-x-1.5">
                  <BooleanIcon value={details.isPinProtected} />

                  {details.pinCode && (
                    <>
                      <FontAwesomeIcon icon={faArrowRight} className="mx-1" />
                      <span className="text-uzh-red-100 font-bold">
                        {details.pinCode}
                      </span>
                    </>
                  )}
                </span>
              ),
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="font-bold">{label}:</span> {value}
            </div>
          ))}
        </div>
      </div>
    </UserNotification>
  )
}

export default ActivityInformation

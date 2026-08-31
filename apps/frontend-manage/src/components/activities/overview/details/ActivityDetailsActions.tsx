import { faList, faMessage } from '@fortawesome/free-solid-svg-icons'
import { ActivityDetails, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { Dispatch, SetStateAction } from 'react'
import ActivityReviewButton from './ActivityReviewButton'

function ActivityDetailsActions({
  details,
  activityType,
  isReviewed,
  readOnly,
  setSelectedInstanceId,
}: {
  details: ActivityDetails
  activityType: ActivityType
  isReviewed: boolean
  readOnly: boolean
  setSelectedInstanceId: Dispatch<SetStateAction<number | null>>
}) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div className="flex w-full flex-row flex-wrap justify-end gap-1.5">
      <Button
        className={{ root: 'h-7 text-sm' }}
        onClick={() => setSelectedInstanceId(null)}
      >
        <Button.Icon icon={faMessage} />
        <Button.Label>{t('shared.comments.viewComments')}</Button.Label>
      </Button>

      {/* course admins should have the possibility to set an activity's status to reviewed or unset it */}
      {details.isActivityReviewer && !readOnly && (
        <ActivityReviewButton
          activityId={details.id}
          activityType={activityType}
          courseId={details.courseId}
          isReviewed={isReviewed}
        />
      )}

      {/* activity admins can open contained elements in library
      -> with less than admin permissions only a selection might be visible, which could be confusing */}
      {details.isActivityManager && (
        <Button
          className={{ root: 'h-7 text-sm' }}
          onClick={() =>
            router.push({
              pathname: '/',
              query: {
                ...(details.courseId
                  ? { filterByCourse: details.courseId }
                  : {}),
                filterByActivity: details.id,
              },
            })
          }
        >
          <Button.Icon icon={faList} />
          <Button.Label>
            {t('manage.activities.openElementsInLibrary')}
          </Button.Label>
        </Button>
      )}
    </div>
  )
}

export default ActivityDetailsActions

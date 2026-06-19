import { faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { ActivityType } from '../../../../lib/constants/activityEnums'
import { trpc, type RouterInputs } from '../../../../lib/trpc'

function ActivityReviewButton({
  activityId,
  activityType,
  courseId,
  isReviewed,
}: {
  activityId: string
  activityType: ActivityType
  courseId?: string | null
  isReviewed: boolean
}) {
  const t = useTranslations()
  const utils = trpc.useUtils()
  const detailsInput: RouterInputs['activity']['details'] = {
    activityId,
    activityType:
      activityType as RouterInputs['activity']['details']['activityType'],
  }
  const setActivityReviewStatus = trpc.activity.setReviewStatus.useMutation()

  return (
    <Button
      disabled={setActivityReviewStatus.isLoading}
      className={{ root: 'h-7 text-sm' }}
      data={{ cy: 'activity-review-button' }}
      onClick={async () => {
        const res = await setActivityReviewStatus.mutateAsync({
          activityId,
          activityType:
            activityType as RouterInputs['activity']['setReviewStatus']['activityType'],
          isReviewed: !isReviewed,
        })

        if (res.reviewStatus) {
          if (courseId) {
            await utils.course.detail.invalidate({ courseId })
          }

          await utils.activity.details.invalidate(detailsInput)
          toast({
            type: 'success',
            message: t('manage.activities.reviewStatusUpdated'),
          })
        } else {
          toast({
            type: 'error',
            message: t('manage.activities.reviewStatusUpdateFailed'),
          })
        }
      }}
    >
      <Button.Icon icon={isReviewed ? faX : faCheckDouble} />
      <Button.Label>
        {isReviewed
          ? t('manage.activities.resetReview')
          : t('manage.activities.reviewCompleted')}
      </Button.Label>
    </Button>
  )
}

export default ActivityReviewButton

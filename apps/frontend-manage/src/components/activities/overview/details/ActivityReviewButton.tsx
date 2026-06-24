import { faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
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
  const [refreshingReviewStatus, setRefreshingReviewStatus] = useState(false)
  const setActivityReviewStatus = trpc.activity.setReviewStatus.useMutation()
  const updatingReviewStatus =
    setActivityReviewStatus.isLoading || refreshingReviewStatus

  return (
    <Button
      disabled={updatingReviewStatus}
      loading={updatingReviewStatus}
      className={{ root: 'h-7 text-sm' }}
      data={{ cy: 'activity-review-button' }}
      onClick={async () => {
        if (updatingReviewStatus) return
        setRefreshingReviewStatus(true)

        try {
          const res = await setActivityReviewStatus.mutateAsync({
            activityId,
            activityType:
              activityType as RouterInputs['activity']['setReviewStatus']['activityType'],
            isReviewed: !isReviewed,
          })

          if (res.reviewStatus) {
            try {
              await Promise.all([
                courseId
                  ? utils.course.detail.invalidate({ courseId })
                  : undefined,
                utils.activity.details.invalidate(detailsInput),
              ])
            } catch (error) {
              console.error(error)
              toast({
                type: 'error',
                message: t('shared.generic.systemError'),
              })
              return
            }
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
        } catch (error) {
          console.error(error)
          toast({
            type: 'error',
            message: t('manage.activities.reviewStatusUpdateFailed'),
          })
        } finally {
          setRefreshingReviewStatus(false)
        }
      }}
    >
      <Button.Icon
        icon={isReviewed ? faX : faCheckDouble}
        loading={updatingReviewStatus}
      />
      <Button.Label>
        {isReviewed
          ? t('manage.activities.resetReview')
          : t('manage.activities.reviewCompleted')}
      </Button.Label>
    </Button>
  )
}

export default ActivityReviewButton

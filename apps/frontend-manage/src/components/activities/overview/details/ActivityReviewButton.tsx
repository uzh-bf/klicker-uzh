import { useMutation } from '@apollo/client'
import { faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  GetActivityDetailsDocument,
  GetSingleCourseDocument,
  SetActivityReviewStatusDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityReviewButton({
  activityId,
  activityType,
  courseId,
  isReviewed,
  refetchActivities,
}: {
  activityId: string
  activityType: ActivityType
  courseId?: string | null
  isReviewed: boolean
  refetchActivities?: () => void
}) {
  const t = useTranslations()
  const [setActivityReviewStatus, { loading: settingReviewedStatus }] =
    useMutation(SetActivityReviewStatusDocument)

  return (
    <Button
      disabled={settingReviewedStatus}
      className={{ root: 'h-7' }}
      data={{ cy: 'activity-review-button' }}
      onClick={async () => {
        const { data: res } = await setActivityReviewStatus({
          variables: { activityId, activityType, isReviewed: !isReviewed },
          update: (cache, { data: res }) => {
            if (!res?.setActivityReviewStatus || !courseId) return

            // update activity details query
            cache.updateQuery(
              {
                query: GetActivityDetailsDocument,
                variables: { activityId, activityType },
              },
              (queryData) => {
                if (!queryData?.activityDetails || !res.setActivityReviewStatus)
                  return null

                return {
                  activityDetails: {
                    ...queryData.activityDetails,
                    reviewStatus: res.setActivityReviewStatus,
                  },
                }
              }
            )

            // update course overview query
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId },
              },
              (queryData) => {
                if (!queryData?.course) return null

                const activityKey:
                  | 'liveQuizzesInfo'
                  | 'practiceQuizzesInfo'
                  | 'microLearningsInfo'
                  | 'groupActivitiesInfo' =
                  activityType === ActivityType.LiveQuiz
                    ? 'liveQuizzesInfo'
                    : activityType === ActivityType.PracticeQuiz
                      ? 'practiceQuizzesInfo'
                      : activityType === ActivityType.MicroLearning
                        ? 'microLearningsInfo'
                        : 'groupActivitiesInfo'

                const updatedActivities =
                  queryData.course?.[activityKey]?.map((act) =>
                    act.id === activityId
                      ? {
                          ...act,
                          reviewStatus: res.setActivityReviewStatus,
                        }
                      : act
                  ) ?? []

                return {
                  course: {
                    ...queryData.course,
                    [activityKey]: updatedActivities,
                  },
                }
              }
            )
          },
        })

        if (res?.setActivityReviewStatus) {
          refetchActivities?.()
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

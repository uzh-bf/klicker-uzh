import { useMutation } from '@apollo/client'
import { faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityInfo,
  ActivityType,
  GetSingleCourseDocument,
  SetActivityReviewStatusDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityReviewButton({
  activity,
  isReviewed,
  refetchActivities,
}: {
  activity: ActivityInfo
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
          variables: {
            activityId: activity.id,
            activityType: activity.type,
            isReviewed: !isReviewed,
          },
          update: (cache, { data: res }) => {
            if (!res?.setActivityReviewStatus || !activity.courseId) return

            // update course overview query
            cache.updateQuery(
              {
                query: GetSingleCourseDocument,
                variables: { courseId: activity.courseId },
              },
              (queryData) => {
                if (!queryData?.course) return null

                const activityKey:
                  | 'liveQuizzesInfo'
                  | 'practiceQuizzesInfo'
                  | 'microLearningsInfo'
                  | 'groupActivitiesInfo' =
                  activity.type === ActivityType.LiveQuiz
                    ? 'liveQuizzesInfo'
                    : activity.type === ActivityType.PracticeQuiz
                      ? 'practiceQuizzesInfo'
                      : activity.type === ActivityType.MicroLearning
                        ? 'microLearningsInfo'
                        : 'groupActivitiesInfo'

                const updatedActivities =
                  queryData.course?.[activityKey]?.map((act) =>
                    act.id === activity.id
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

import { useApolloClient } from '@apollo/client'
import { faCheckDouble, faX } from '@fortawesome/free-solid-svg-icons'
import {
  ActivityType,
  GetSingleCourseDocument,
  ReviewStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
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
  const apolloClient = useApolloClient()
  const detailsInput: RouterInputs['activity']['details'] = {
    activityId,
    activityType:
      activityType as unknown as RouterInputs['activity']['details']['activityType'],
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
            activityType as unknown as RouterInputs['activity']['setReviewStatus']['activityType'],
          isReviewed: !isReviewed,
        })

        if (res.reviewStatus) {
          // Keep the Apollo course cache coherent until course details move to tRPC.
          if (courseId) {
            apolloClient.cache.updateQuery(
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
                          reviewStatus: res.reviewStatus as ReviewStatus,
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

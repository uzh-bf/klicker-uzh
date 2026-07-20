import { useMutation } from '@apollo/client'
import {
  GetCourseOverviewDataDocument,
  LeaveRandomCourseGroupPoolDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function PoolNotification({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const [leaveRandomCourseGroupPool, { loading }] = useMutation(
    LeaveRandomCourseGroupPoolDocument,
    {
      variables: { courseId },
      update: (cache, { data }) => {
        // verify that the pool was left successfully
        if (!data?.leaveRandomCourseGroupPool) return

        // update the course overview data accordingly
        cache.updateQuery(
          { query: GetCourseOverviewDataDocument, variables: { courseId } },
          (qData) => {
            if (!qData?.getCourseOverviewData) return qData

            return {
              ...qData,
              getCourseOverviewData: {
                ...qData.getCourseOverviewData,
                inRandomGroupPool: false,
              },
            }
          }
        )
      },
    }
  )

  return (
    <div className="flex flex-col items-end gap-2">
      <UserNotification
        type="info"
        message={t('pwa.courses.inRandomGroupPool')}
        className={{ root: 'w-full' }}
      />
      <Button
        destructive
        disabled={loading}
        onClick={async () => await leaveRandomCourseGroupPool()}
        data={{ cy: 'leave-random-group-pool' }}
      >
        {t('pwa.courses.leaveRandomGroupPool')}
      </Button>
    </div>
  )
}

export default PoolNotification

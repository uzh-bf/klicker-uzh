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
        if ((data?.leaveRandomCourseGroupPool ?? false) !== true) return
        const CourseOverviewData = cache.readQuery({
          query: GetCourseOverviewDataDocument,
          variables: { courseId: courseId },
        })
        if (!CourseOverviewData) return
        cache.writeQuery({
          query: GetCourseOverviewDataDocument,
          variables: { courseId: courseId },
          data: {
            getCourseOverviewData: {
              id: courseId,
              ...CourseOverviewData.getCourseOverviewData,
              inRandomGroupPool: false,
            },
          },
        })
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
        onClick={async () => await leaveRandomCourseGroupPool()}
        loading={loading}
      >
        {t('pwa.courses.leaveRandomGroupPool')}
      </Button>
    </div>
  )
}

export default PoolNotification

import { useMutation } from '@apollo/client'
import { LeaveRandomCourseGroupPoolDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function PoolNotification({
  courseId,
  onCourseOverviewChanged,
}: {
  courseId: string
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const [leaveRandomCourseGroupPool, { loading }] = useMutation(
    LeaveRandomCourseGroupPoolDocument
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
        onClick={async () => {
          const result = await leaveRandomCourseGroupPool({
            variables: { courseId },
          })
          if (result.data?.leaveRandomCourseGroupPool) {
            await onCourseOverviewChanged?.()
          }
        }}
        data={{ cy: 'leave-random-group-pool' }}
      >
        {t('pwa.courses.leaveRandomGroupPool')}
      </Button>
    </div>
  )
}

export default PoolNotification

import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'

function PoolNotification({
  courseId,
  onCourseOverviewChanged,
}: {
  courseId: string
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const leaveRandomCourseGroupPool =
    trpc.participant.leaveRandomCourseGroupPool.useMutation()

  return (
    <div className="flex flex-col items-end gap-2">
      <UserNotification
        type="info"
        message={t('pwa.courses.inRandomGroupPool')}
        className={{ root: 'w-full' }}
      />
      <Button
        destructive
        disabled={leaveRandomCourseGroupPool.isLoading}
        onClick={async () => {
          const result = await leaveRandomCourseGroupPool.mutateAsync({
            courseId,
          })
          if (result) {
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

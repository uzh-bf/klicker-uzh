import { Button, UserNotification, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../../lib/trpc'

function PoolNotification({
  courseId,
  onCourseOverviewChanged,
}: {
  courseId: string
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const [overviewRefreshing, setOverviewRefreshing] = useState(false)
  const leaveRandomCourseGroupPool =
    trpc.participant.leaveRandomCourseGroupPool.useMutation()
  const leavingPool = leaveRandomCourseGroupPool.isLoading || overviewRefreshing

  return (
    <div className="flex flex-col items-end gap-2">
      <UserNotification
        type="info"
        message={t('pwa.courses.inRandomGroupPool')}
        className={{ root: 'w-full' }}
      />
      <Button
        destructive
        disabled={leavingPool}
        loading={leavingPool}
        onClick={async () => {
          try {
            setOverviewRefreshing(true)
            const result = await leaveRandomCourseGroupPool.mutateAsync({
              courseId,
            })
            if (result) {
              await Promise.resolve(onCourseOverviewChanged?.())
              return
            }
          } catch (error) {
            console.error(error)
          } finally {
            setOverviewRefreshing(false)
          }

          toast({
            type: 'error',
            message: t('shared.generic.systemError'),
            options: { duration: 5000 },
          })
        }}
        data={{ cy: 'leave-random-group-pool' }}
      >
        {t('pwa.courses.leaveRandomGroupPool')}
      </Button>
    </div>
  )
}

export default PoolNotification

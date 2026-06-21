import { Button, UserNotification, toast } from '@uzh-bf/design-system'
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
        loading={leaveRandomCourseGroupPool.isLoading}
        onClick={async () => {
          try {
            const result = await leaveRandomCourseGroupPool.mutateAsync({
              courseId,
            })
            if (result) {
              void Promise.resolve(onCourseOverviewChanged?.()).catch(
                (error) => {
                  console.error(error)
                  toast({
                    type: 'error',
                    message: t('shared.generic.systemError'),
                    options: { duration: 5000 },
                  })
                }
              )
              return
            }
          } catch (error) {
            console.error(error)
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

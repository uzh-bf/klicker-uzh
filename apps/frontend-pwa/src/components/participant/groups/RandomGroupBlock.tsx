import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { trpc } from '../../../lib/trpc'
import GroupAction from './GroupAction'

function RandomGroupBlock({
  courseId,
  onCourseOverviewChanged,
}: {
  courseId: string
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const [overviewRefreshing, setOverviewRefreshing] = useState(false)
  const joinRandomCourseGroupPool =
    trpc.participant.joinRandomCourseGroupPool.useMutation()

  return (
    <GroupAction
      buttonMode
      title={t('pwa.courses.randomGroup')}
      icon={faShuffle}
      onClick={async () => {
        try {
          setOverviewRefreshing(true)
          const result = await joinRandomCourseGroupPool.mutateAsync({
            courseId,
          })
          if (result) {
            await Promise.resolve(onCourseOverviewChanged?.()).catch(
              console.error
            )
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
      explanation={t('pwa.courses.createJoinRandomGroup')}
      data={{ cy: 'enter-random-group-pool' }}
      loading={joinRandomCourseGroupPool.isLoading || overviewRefreshing}
    />
  )
}

export default RandomGroupBlock

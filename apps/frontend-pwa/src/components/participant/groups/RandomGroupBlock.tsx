import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { useTranslations } from 'next-intl'
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
  const joinRandomCourseGroupPool =
    trpc.participant.joinRandomCourseGroupPool.useMutation()

  return (
    <GroupAction
      buttonMode
      title={t('pwa.courses.randomGroup')}
      icon={faShuffle}
      onClick={async () => {
        const result = await joinRandomCourseGroupPool.mutateAsync({ courseId })
        if (result) {
          await onCourseOverviewChanged?.()
        }
      }}
      explanation={t('pwa.courses.createJoinRandomGroup')}
      data={{ cy: 'enter-random-group-pool' }}
      loading={joinRandomCourseGroupPool.isLoading}
    />
  )
}

export default RandomGroupBlock

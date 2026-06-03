import { useMutation } from '@apollo/client'
import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import { JoinRandomCourseGroupPoolDocument } from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import GroupAction from './GroupAction'

function RandomGroupBlock({
  courseId,
  onCourseOverviewChanged,
}: {
  courseId: string
  onCourseOverviewChanged?: () => void | Promise<void>
}) {
  const t = useTranslations()
  const [joinRandomCourseGroupPool, { loading }] = useMutation(
    JoinRandomCourseGroupPoolDocument
  )

  return (
    <GroupAction
      buttonMode
      title={t('pwa.courses.randomGroup')}
      icon={faShuffle}
      onClick={async () => {
        const result = await joinRandomCourseGroupPool({
          variables: { courseId },
        })
        if (result.data?.joinRandomCourseGroupPool) {
          await onCourseOverviewChanged?.()
        }
      }}
      explanation={t('pwa.courses.createJoinRandomGroup')}
      data={{ cy: 'enter-random-group-pool' }}
      loading={loading}
    />
  )
}

export default RandomGroupBlock

import { useMutation } from '@apollo/client'
import { faShuffle } from '@fortawesome/free-solid-svg-icons'
import {
  GetCourseOverviewDataDocument,
  JoinRandomCourseGroupPoolDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import GroupAction from './GroupAction'

function RandomGroupBlock({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const [joinRandomCourseGroupPool, { loading }] = useMutation(
    JoinRandomCourseGroupPoolDocument,
    {
      variables: { courseId },
      update: (cache, { data }) => {
        // verify that the pool was joined successfully
        if (!data?.joinRandomCourseGroupPool) return

        // update the course overview data accordingly
        cache.updateQuery(
          { query: GetCourseOverviewDataDocument, variables: { courseId } },
          (qData) => {
            if (!qData?.getCourseOverviewData) return qData

            return {
              ...qData,
              getCourseOverviewData: {
                ...qData.getCourseOverviewData,
                inRandomGroupPool: true,
              },
            }
          }
        )
      },
    }
  )

  return (
    <GroupAction
      buttonMode
      title={t('pwa.courses.randomGroup')}
      icon={faShuffle}
      onClick={async () => await joinRandomCourseGroupPool()}
      explanation={t('pwa.courses.createJoinRandomGroup')}
      data={{ cy: 'enter-random-group-pool' }}
      loading={loading}
    />
  )
}

export default RandomGroupBlock

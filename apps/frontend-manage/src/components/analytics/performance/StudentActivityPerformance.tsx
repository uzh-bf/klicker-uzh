import { useQuery } from '@apollo/client'
import {
  GetCourseActivitiesDocument,
  ParticipantActivityPerformances,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'

function StudentActivityPerformance({
  courseId,
  performances,
}: {
  courseId: string
  performances: ParticipantActivityPerformances[]
}) {
  const t = useTranslations()
  const { loading, data } = useQuery(GetCourseActivitiesDocument, {
    variables: { courseId },
    skip: !courseId,
  })
  const course = data?.getCourseActivities

  // TODO: extract the data processing to a separate custom hook
  // TODO: implement data processing where the user can choose which activities to include in the table
  const tableData = useMemo(() => {
    if (loading || !course) {
      return []
    }
  }, [])

  if (loading || !data) {
    return <Loader />
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.studentActivityPerformance')}</H2>
      {performances.length > 0 ? (
        <div className="flex flex-col gap-2">CONTENT</div>
      ) : (
        <UserNotification
          type="info"
          message={t('manage.analytics.noStudentActivityPerformanceData')}
        />
      )}
    </div>
  )
}

export default StudentActivityPerformance

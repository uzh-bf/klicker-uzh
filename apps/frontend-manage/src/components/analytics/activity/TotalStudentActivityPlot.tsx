import { ParticipantCourseActivity } from '@klicker-uzh/graphql/dist/ops'
import { H2 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

interface TotalStudentActivityPlotProps {
  participantActivity: ParticipantCourseActivity[]
}

function TotalStudentActivityPlot({
  participantActivity,
}: TotalStudentActivityPlotProps) {
  const t = useTranslations()

  // TODO: remove
  console.log(participantActivity)

  return (
    <div className="border-uzh-grey-80 mb-3 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.overallStudentActivity')}</H2>
      GRAPH
    </div>
  )
}

export default TotalStudentActivityPlot

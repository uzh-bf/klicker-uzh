import { useSuspenseQuery } from '@apollo/client'
import { GetStudentAssessmentResultsDocument } from '@klicker-uzh/graphql/dist/ops'
import { ActivityType } from '@klicker-uzh/types'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AssessmentResultsList from './AssessmentResultsList'

function SuspendedAssessmentResults({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const { data } = useSuspenseQuery(GetStudentAssessmentResultsDocument, {
    variables: { courseId },
  })

  if (!data.studentAssessmentResults) {
    return <div>{t('pwa.assessment.failedToLoadActivityResults')}</div>
  }

  const liveQuizzes = data.studentAssessmentResults.liveQuizzes
  const practiceQuizzes = data.studentAssessmentResults.practiceQuizzes
  const microLearnings = data.studentAssessmentResults.microLearnings
  const groupActivities = data.studentAssessmentResults.groupActivities

  return (
    <div>
      <div className="mb-4 text-sm md:mb-6 md:text-base">
        {t('pwa.assessment.activityResultsDescription')}
      </div>
      <div>
        <H3>{t('shared.generic.liveQuizzes')}</H3>
        {liveQuizzes.length > 0 ? (
          <AssessmentResultsList
            results={liveQuizzes}
            type={ActivityType.LIVE_QUIZ}
          />
        ) : (
          <div>{t('pwa.assessment.noCompletedLiveQuizzesYet')}</div>
        )}
      </div>
      {practiceQuizzes.length > 0 && (
        <div>
          <H3>{t('shared.generic.practiceQuizzes')}</H3>
          <AssessmentResultsList
            results={practiceQuizzes}
            type={ActivityType.PRACTICE_QUIZ}
          />
        </div>
      )}
      {microLearnings.length > 0 && (
        <div>
          <H3>{t('shared.generic.microlearnings')}</H3>
          <AssessmentResultsList
            results={microLearnings}
            type={ActivityType.MICRO_LEARNING}
          />
        </div>
      )}
      {groupActivities.length > 0 && (
        <div>
          <H3>{t('shared.generic.groupActivities')}</H3>
          <AssessmentResultsList
            results={groupActivities}
            type={ActivityType.GROUP_ACTIVITY}
          />
        </div>
      )}
    </div>
  )
}

export default SuspendedAssessmentResults

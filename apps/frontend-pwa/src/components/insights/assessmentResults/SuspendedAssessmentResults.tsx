import Loader from '@klicker-uzh/shared-components/src/Loader'
import { ActivityType } from '@klicker-uzh/types'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { trpc } from '../../../lib/trpc'
import AssessmentResultsList from './AssessmentResultsList'

function SuspendedAssessmentResults({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const { data, error, isLoading } =
    trpc.participant.studentAssessmentResults.useQuery(
      { courseId },
      { retry: false }
    )

  const assessmentResults = data?.studentAssessmentResults

  if (isLoading && !assessmentResults) return <Loader />

  if (error && !assessmentResults) {
    return (
      <UserNotification
        type="error"
        message={t('pwa.assessment.failedToLoadActivityResults')}
      />
    )
  }

  if (!assessmentResults) {
    return (
      <UserNotification
        type="warning"
        message={t('pwa.assessment.failedToLoadActivityResults')}
      />
    )
  }

  const liveQuizzes = assessmentResults.liveQuizzes
  const practiceQuizzes = assessmentResults.practiceQuizzes
  const microLearnings = assessmentResults.microLearnings
  const groupActivities = assessmentResults.groupActivities

  return (
    <div>
      {error ? (
        <UserNotification
          type="error"
          message={t('pwa.assessment.failedToLoadActivityResults')}
        />
      ) : null}
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

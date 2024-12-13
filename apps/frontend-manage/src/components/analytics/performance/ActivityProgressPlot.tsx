import { ActivityProgress, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { H2, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function ActivityProgressPlot({
  activityProgresses,
}: {
  activityProgresses: ActivityProgress[]
}) {
  const t = useTranslations()
  const pqProgresses = activityProgresses.filter(
    (progress) => progress.activityType === ActivityType.PracticeQuiz
  )
  const mlProgresses = activityProgresses.filter(
    (progress) => progress.activityType === ActivityType.MicroLearning
  )

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.asynchronousActivityProgress')}</H2>
      <div className="flex flex-col gap-6">
        {pqProgresses.length > 0 && (
          <div>
            <H4>{t('shared.generic.practiceQuizzes')}</H4>
            {pqProgresses.map((progress, idx) => (
              <div key={`activity-progress-pq-${idx}`}>
                {progress.activityName}
              </div>
            ))}
          </div>
        )}
        {mlProgresses.length > 0 && (
          <div>
            <H4>{t('shared.generic.microlearnings')}</H4>
            {mlProgresses.map((progress, idx) => (
              <div key={`activity-progress-ml-${idx}`}>
                {progress.activityName}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityProgressPlot

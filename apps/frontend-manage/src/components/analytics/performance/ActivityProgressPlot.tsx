import { ActivityProgress, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { H2, H4, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import StackedProgress from './StackedProgress'

function ActivityProgressPlot({
  activityProgresses,
  participants,
}: {
  activityProgresses: ActivityProgress[]
  participants: number
}) {
  const t = useTranslations()
  const pqProgresses = activityProgresses.filter(
    (progress) => progress.activityType === ActivityType.PracticeQuiz
  )
  const mlProgresses = activityProgresses.filter(
    (progress) => progress.activityType === ActivityType.MicroLearning
  )

  const chartColors = {
    started: '#4ade80',
    completed: '#15803d',
    repeated: '#064e3b',
  }

  const ProgressLegend = () => (
    <div className="ml-auto flex flex-row gap-4 pt-1">
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: chartColors.started,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.started')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: chartColors.completed,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.completed')}</span>
      </div>
      <div className="flex items-center gap-2">
        <span
          style={{
            width: 16,
            height: 16,
            background: chartColors.repeated,
            display: 'inline-block',
            borderRadius: 2,
          }}
        />
        <span>{t('manage.analytics.repeated')}</span>
      </div>
    </div>
  )

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <H2>{t('manage.analytics.asynchronousActivityProgress')}</H2>
      {pqProgresses.length > 0 || mlProgresses.length > 0 ? (
        <div className="flex flex-col gap-6">
          {pqProgresses.length > 0 && (
            <div>
              <div className="relative flex flex-row">
                <H4>{t('shared.generic.practiceQuizzes')}</H4>
                <ProgressLegend />
              </div>
              {pqProgresses.map((progress, idx) => (
                <StackedProgress
                  key={`activity-progress-pq-${progress.activityId}`}
                  progress={progress}
                  participants={participants}
                  colors={chartColors}
                  showScale={idx === pqProgresses.length - 1}
                />
              ))}
            </div>
          )}
          {mlProgresses.length > 0 && (
            <div>
              <div className="relative flex flex-row">
                <H4>{t('shared.generic.microlearnings')}</H4>
                <ProgressLegend />
              </div>
              {mlProgresses.map((progress, idx) => (
                <StackedProgress
                  key={`activity-progress-ml-${progress.activityId}`}
                  progress={progress}
                  participants={participants}
                  colors={chartColors}
                  showScale={idx === mlProgresses.length - 1}
                />
              ))}
            </div>
          )}
        </div>
      ) : (
        <UserNotification
          message={t('manage.analytics.noAsynchronousActivityProgressData')}
          type="info"
        />
      )}
    </div>
  )
}

export default ActivityProgressPlot

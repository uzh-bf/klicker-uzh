import { ActivityProgress, ActivityType } from '@klicker-uzh/graphql/dist/ops'
import { H2, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { Legend } from 'recharts'
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

  // required for tailwind styles to be included: text-[#4ade80] text-[#15803d] text-[#064e3b]
  const chartColors = {
    started: '#4ade80',
    completed: '#15803d',
    repeated: '#064e3b',
  }

  return (
    <div className="border-uzh-grey-80 rounded-xl border border-solid p-3">
      <div className="relative">
        <H2>{t('manage.analytics.asynchronousActivityProgress')}</H2>
        <Legend
          payload={[
            {
              value: t('manage.analytics.started'),
              color: chartColors.started,
              type: 'rect',
            },
            {
              value: t('manage.analytics.completed'),
              color: chartColors.completed,
              type: 'rect',
            },
            {
              value: t('manage.analytics.repeated'),
              color: chartColors.repeated,
              type: 'rect',
            },
          ]}
          wrapperStyle={{ bottom: 0, right: 0 }}
        />
      </div>
      <div className="flex flex-col gap-6">
        {pqProgresses.length > 0 && (
          <div>
            <H4>{t('shared.generic.practiceQuizzes')}</H4>
            {pqProgresses.map((progress, idx) => (
              <StackedProgress
                key={`activity-progress-pq-${idx}`}
                progress={progress}
                participants={participants}
                colors={chartColors}
              />
            ))}
          </div>
        )}
        {mlProgresses.length > 0 && (
          <div>
            <H4>{t('shared.generic.microlearnings')}</H4>
            {mlProgresses.map((progress, idx) => (
              <StackedProgress
                key={`activity-progress-ml-${idx}`}
                progress={progress}
                participants={participants}
                colors={chartColors}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ActivityProgressPlot

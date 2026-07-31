import {
  ActivityQuizAnalytics,
  ActivityType,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ErrorRatesLegend from '../performance/ErrorRatesLegend'
import CircularPerformancePlot from './CircularPerformancePlot'

function ActivityAnalyticsCharts({
  activityName,
  activityType,
  analytics,
  colors,
  className,
}: {
  activityName: string
  activityType: ActivityType
  analytics?: ActivityQuizAnalytics | null
  colors: {
    correct: string
    partial: string
    incorrect: string
  }
  className?: string
}) {
  const t = useTranslations()

  if (!analytics) {
    return (
      <UserNotification
        className={{ root: className }}
        type="info"
        message={t('manage.analytics.learningAnalyticsSuppressed')}
      />
    )
  }

  return (
    <div className={className}>
      <div>
        {t.rich('manage.analytics.effectiveSampleSize', {
          effectiveN: analytics.participantCount,
          b: (children) => <span className="font-bold">{children}</span>,
        })}
      </div>
      <hr className="my-2 w-full border-t border-solid border-gray-300" />
      <div>
        {t.rich('manage.analytics.totalAnsweredElements', {
          activityName: activityName,
          number: analytics.numberOfAnswers,
          b: (children) => <span className="font-bold">{children}</span>,
        })}
      </div>
      <hr className="my-2 w-full border-t border-solid border-gray-300" />
      <div>
        {t.rich('manage.analytics.averageTimeSpentActivity', {
          min: Math.floor(analytics.averageTimeSpent / 60),
          sec: Math.floor(analytics.averageTimeSpent % 60)
            .toString()
            .padStart(2, '0'),
          b: (children) => <span className="font-bold">{children}</span>,
        })}
      </div>
      <hr className="my-2 w-full border-t border-solid border-gray-300" />
      <div>
        <div className="relative flex flex-row flex-wrap justify-between">
          <H3>{t('manage.analytics.successRates')}</H3>
          <ErrorRatesLegend colors={colors} />
        </div>
        {activityType === ActivityType.MicroLearning ? (
          <UserNotification type="info">
            {t('manage.analytics.microLearningOneSubmissionHint')}
          </UserNotification>
        ) : null}
        <div className="flex h-80 w-full flex-row">
          <CircularPerformancePlot
            title={t('manage.analytics.total')}
            rates={{
              correctRate: analytics.totalCorrectRate,
              partialRate: analytics.totalPartialRate,
              incorrectRate: analytics.totalErrorRate,
            }}
            colors={colors}
          />
          {activityType !== ActivityType.MicroLearning ? (
            <>
              <CircularPerformancePlot
                title={t('manage.analytics.firstAttempt')}
                rates={{
                  correctRate: analytics.firstCorrectRate ?? 0,
                  partialRate: analytics.firstPartialRate ?? 0,
                  incorrectRate: analytics.firstErrorRate ?? 0,
                }}
                colors={colors}
              />
              <CircularPerformancePlot
                title={t('manage.analytics.lastAttempts')}
                rates={{
                  correctRate: analytics.lastCorrectRate ?? 0,
                  partialRate: analytics.lastPartialRate ?? 0,
                  incorrectRate: analytics.lastErrorRate ?? 0,
                }}
                colors={colors}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

export default ActivityAnalyticsCharts

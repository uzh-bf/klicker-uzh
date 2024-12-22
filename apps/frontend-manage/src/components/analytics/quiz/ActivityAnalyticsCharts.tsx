import { ActivityQuizAnalytics } from '@klicker-uzh/graphql/dist/ops'
import { H3 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import ErrorRatesLegend from '../performance/ErrorRatesLegend'
import CircularPerformancePlot from './CircularPerformancePlot'

function ActivityAnalyticsCharts({
  activityName,
  analytics,
  colors,
  className,
}: {
  activityName: string
  analytics?: ActivityQuizAnalytics | null
  colors: {
    correct: string
    partial: string
    incorrect: string
  }
  className?: string
}) {
  const t = useTranslations()

  return (
    <div className={className}>
      <div>
        {t.rich('manage.analytics.totalAnsweredElements', {
          activityName: activityName,
          number: analytics?.numberOfAnswers,
          b: (children) => <span className="font-bold">{children}</span>,
        })}
      </div>
      <hr className="my-2 w-full border-t border-solid border-gray-300" />
      <div>
        {t.rich('manage.analytics.averageTimeSpentActivity', {
          min: Math.floor((analytics?.averageTimeSpent ?? 0) / 60),
          sec: Math.floor((analytics?.averageTimeSpent ?? 0) % 60),
          b: (children) => <span className="font-bold">{children}</span>,
        })}
      </div>
      <hr className="my-2 w-full border-t border-solid border-gray-300" />
      <div>
        <div className="relative">
          <H3>{t('manage.analytics.successRates')}</H3>
          <ErrorRatesLegend colors={colors} />
        </div>
        <div className="flex h-80 w-full flex-row">
          <CircularPerformancePlot
            title={t('manage.analytics.total')}
            rates={{
              correctRate: analytics?.totalCorrectRate ?? 0,
              partialRate: analytics?.totalPartialRate ?? 0,
              incorrectRate: analytics?.totalErrorRate ?? 0,
            }}
            colors={colors}
          />
          {/* // TODO: only show first and last attempt, if they are well-defined (= not for microlearnings) */}
          <CircularPerformancePlot
            title={t('manage.analytics.firstAttempt')}
            rates={{
              correctRate: analytics?.firstCorrectRate ?? 0,
              partialRate: analytics?.firstPartialRate ?? 0,
              incorrectRate: analytics?.firstErrorRate ?? 0,
            }}
            colors={colors}
          />
          <CircularPerformancePlot
            title={t('manage.analytics.lastAttempts')}
            rates={{
              correctRate: analytics?.lastCorrectRate ?? 0,
              partialRate: analytics?.lastPartialRate ?? 0,
              incorrectRate: analytics?.lastErrorRate ?? 0,
            }}
            colors={colors}
          />
        </div>
      </div>
    </div>
  )
}

export default ActivityAnalyticsCharts

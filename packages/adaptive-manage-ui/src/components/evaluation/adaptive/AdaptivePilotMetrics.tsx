import AdaptiveAttemptBoxPlot from './AdaptiveAttemptBoxPlot'
import AdaptiveItemOverview from './AdaptiveItemOverview'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type {
  AdaptiveItemDiagnostic,
  AdaptivePilotMetrics as AdaptivePilotMetricsData,
} from './types'

function AdaptivePilotMetrics({
  practiceQuizId,
  metrics,
  items,
}: {
  practiceQuizId: string
  metrics: AdaptivePilotMetricsData
  items: AdaptiveItemDiagnostic[]
}) {
  const t = useTranslations()

  return (
    <section
      className="border-t border-gray-200 py-6"
      data-cy="adaptive-evaluation-pilot-metrics"
    >
      <H3>{t('manage.evaluation.adaptive.pilot.title')}</H3>
      <p className="mb-4 max-w-4xl text-sm text-gray-600">
        {t('manage.evaluation.adaptive.pilot.description')}
      </p>
      {metrics.suppressed ? (
        <UserNotification
          type="info"
          message={t('manage.evaluation.adaptive.suppression.pilot')}
          className={{ root: 'mb-4' }}
          data={{ cy: 'adaptive-evaluation-pilot-suppressed' }}
        />
      ) : null}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <AdaptiveAttemptBoxPlot distribution={metrics.questionCountBoxPlot} />
        <AdaptiveAttemptBoxPlot
          distribution={metrics.completionTimeBoxPlot}
          duration
        />
      </div>

      <AdaptiveItemOverview practiceQuizId={practiceQuizId} items={items} />
    </section>
  )
}

export default AdaptivePilotMetrics

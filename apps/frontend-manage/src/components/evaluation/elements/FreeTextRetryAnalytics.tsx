import type { FreeTextActivityEvaluationData } from '@klicker-uzh/graphql/dist/ops'
import { useFormatter, useTranslations } from 'next-intl'

function FreeTextRetryAnalytics({
  analytics,
}: {
  analytics: NonNullable<FreeTextActivityEvaluationData['retryAnalytics']>
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const formatPercent = (value: number) =>
    formatter.number(value, {
      style: 'percent',
      maximumFractionDigits: 1,
    })
  const formatNumber = (value: number) =>
    formatter.number(value, { maximumFractionDigits: 1 })

  const summary = [
    {
      label: t('manage.evaluation.semanticCycles'),
      value: analytics.cycleCount,
    },
    {
      label: t('manage.evaluation.semanticAttemptsUsed'),
      value: analytics.totalAttempts,
    },
    {
      label: t('manage.evaluation.semanticAverageAttempts'),
      value: formatNumber(analytics.averageAttempts),
    },
    {
      label: t('manage.evaluation.semanticSuccessRate'),
      value: formatPercent(analytics.successRate),
    },
    {
      label: t('manage.evaluation.semanticRevealRate'),
      value: formatPercent(analytics.revealRate),
    },
    {
      label: t('manage.evaluation.semanticUnavailable'),
      value: analytics.unavailableCount,
    },
  ]

  return (
    <section
      className="mx-4 mt-3 rounded-md border border-gray-300 bg-gray-50 p-3"
      data-cy="free-text-retry-analytics"
    >
      <div>
        <h3 className="font-semibold">
          {t('manage.evaluation.semanticRetryAnalytics')}
        </h3>
        <p className="text-sm text-gray-600">
          {t('manage.evaluation.semanticRetryAnalyticsDescription')}
        </p>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map((item) => (
          <div
            key={item.label}
            className="rounded border border-gray-200 bg-white p-2"
          >
            <div className="text-xs text-gray-600">{item.label}</div>
            <div className="text-lg font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-lg text-left text-sm">
          <thead>
            <tr className="border-b border-gray-300">
              <th className="py-1 pr-3">
                {t('manage.evaluation.semanticOutcomeMoment')}
              </th>
              <th className="px-3 py-1">
                {t('manage.elements.semanticIncorrect')}
              </th>
              <th className="px-3 py-1">
                {t('manage.elements.semanticPartial')}
              </th>
              <th className="px-3 py-1">
                {t('manage.elements.semanticCorrect')}
              </th>
            </tr>
          </thead>
          <tbody>
            {[
              {
                label: t('manage.evaluation.semanticFirstOutcome'),
                values: analytics.first,
              },
              {
                label: t('manage.evaluation.semanticBestOutcome'),
                values: analytics.best,
              },
            ].map((row) => (
              <tr key={row.label} className="border-b border-gray-200">
                <th className="py-1 pr-3 font-medium">{row.label}</th>
                <td className="px-3 py-1">{row.values.incorrect}</td>
                <td className="px-3 py-1">{row.values.partial}</td>
                <td className="px-3 py-1">{row.values.correct}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export default FreeTextRetryAnalytics

import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  AdaptiveItemDiagnostic,
  AdaptivePilotMetrics as AdaptivePilotMetricsData,
} from './types'

function AdaptivePilotMetrics({
  metrics,
  items,
}: {
  metrics: AdaptivePilotMetricsData
  items: AdaptiveItemDiagnostic[]
}) {
  const t = useTranslations()
  const hidden = t('manage.evaluation.adaptive.suppressedValue')
  const formatNumber = (value: number | null | undefined, suffix = '') =>
    value == null ? hidden : `${value.toFixed(1)}${suffix}`
  const formatRate = (value: number | null | undefined) =>
    value == null ? hidden : `${(value * 100).toFixed(1)}%`

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
      {metrics.responseCountMismatchDetected ? (
        <UserNotification
          type="warning"
          message={t('manage.evaluation.adaptive.pilot.responseCountMismatch')}
          className={{ root: 'mb-3' }}
          data={{ cy: 'adaptive-evaluation-response-mismatch' }}
        />
      ) : null}
      {metrics.durationMissingDetected ? (
        <UserNotification
          type="warning"
          message={t('manage.evaluation.adaptive.pilot.durationMissing')}
          className={{ root: 'mb-3' }}
          data={{ cy: 'adaptive-evaluation-duration-missing' }}
        />
      ) : null}

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-5">
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.medianQuestions')}
          value={formatNumber(metrics.medianQuestionCount)}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.p95Questions')}
          value={formatNumber(metrics.p95QuestionCount)}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.medianDuration')}
          value={formatNumber(metrics.medianElapsedSeconds, ' s')}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.p95Duration')}
          value={formatNumber(metrics.p95ElapsedSeconds, ' s')}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.nearBoundaryRate')}
          value={formatRate(metrics.nearBoundaryRate)}
        />
      </dl>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[64rem] table-fixed text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-700">
            <tr>
              <th className="w-52 px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.item')}
              </th>
              <th className="w-64 px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.competence')}
              </th>
              <th className="w-28 px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.level')}
              </th>
              <th className="px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.responses')}
              </th>
              <th className="px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.exposure')}
              </th>
              <th className="px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.observed')}
              </th>
              <th className="px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.expected')}
              </th>
              <th className="px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.residual')}
              </th>
              <th className="w-32 px-2 py-2">
                {t('manage.evaluation.adaptive.pilot.flags')}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.poolItemId}
                className="border-b border-gray-200 align-top"
                data-cy={`adaptive-item-diagnostic-${item.poolItemId}`}
              >
                <td className="break-words px-2 py-2 font-medium">
                  {item.elementName}
                </td>
                <td className="break-words px-2 py-2 text-gray-700">
                  {item.nodeNamePath.join(' / ')}
                </td>
                <td className="px-2 py-2">{item.levelLabel}</td>
                <td className="px-2 py-2 tabular-nums">
                  {item.responseCount ?? hidden}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(item.exposureRate)}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(item.observedCorrectRate)}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(item.expectedCorrectRate)}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatNumber(item.residual)}
                </td>
                <td className="px-2 py-2">
                  <DiagnosticFlags item={item} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function PilotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="mt-1 font-semibold tabular-nums">{value}</dd>
    </div>
  )
}

function DiagnosticFlags({ item }: { item: AdaptiveItemDiagnostic }) {
  const t = useTranslations()
  const flags = [
    item.highExposure
      ? t('manage.evaluation.adaptive.pilot.highExposure')
      : null,
    item.misfitFlag ? t('manage.evaluation.adaptive.pilot.reviewFit') : null,
  ].filter((value): value is string => Boolean(value))

  return flags.length > 0 ? (
    <span className="font-medium text-red-700">{flags.join(', ')}</span>
  ) : (
    <span className="text-gray-500">
      {t('manage.evaluation.adaptive.pilot.noFlags')}
    </span>
  )
}

export default AdaptivePilotMetrics

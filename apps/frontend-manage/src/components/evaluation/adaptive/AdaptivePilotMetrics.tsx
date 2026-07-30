import {
  AdaptivePracticeQuizPrivacyField,
  AdaptivePracticeQuizPrivacySuppressionReason,
} from '@klicker-uzh/graphql/dist/ops'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
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
  const formatter = useFormatter()
  const hidden = t('manage.evaluation.adaptive.suppressedValue')
  const unavailable = (
    field: AdaptivePracticeQuizPrivacyField,
    suppressions = metrics.suppressions
  ) => {
    const suppression = suppressions.find((entry) => entry.field === field)
    return !suppression ||
      suppression.reason ===
        AdaptivePracticeQuizPrivacySuppressionReason.MinimumResponses
      ? t('manage.evaluation.adaptive.notEnoughData')
      : hidden
  }
  const formatNumber = (
    value: number | null | undefined,
    field: AdaptivePracticeQuizPrivacyField,
    suppressions = metrics.suppressions
  ) =>
    value == null
      ? unavailable(field, suppressions)
      : formatter.number(value, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
  const formatDuration = (
    value: number | null | undefined,
    field: AdaptivePracticeQuizPrivacyField
  ) =>
    value == null
      ? unavailable(field)
      : formatter.number(value, {
          style: 'unit',
          unit: 'second',
          unitDisplay: 'short',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
  const formatRate = (
    value: number | null | undefined,
    field: AdaptivePracticeQuizPrivacyField,
    suppressions = metrics.suppressions
  ) =>
    value == null
      ? unavailable(field, suppressions)
      : formatter.number(value, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })
  const formatStatus = (
    value: boolean | null | undefined,
    field: AdaptivePracticeQuizPrivacyField
  ) =>
    value == null
      ? unavailable(field)
      : value
        ? t('manage.evaluation.adaptive.pilot.issueDetected')
        : t('manage.evaluation.adaptive.pilot.noIssue')

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

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4 xl:grid-cols-7">
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.medianQuestions')}
          dataCy="adaptive-pilot-median-questions"
          value={formatNumber(
            metrics.medianQuestionCount,
            AdaptivePracticeQuizPrivacyField.QuestionCountPercentiles
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.p95Questions')}
          dataCy="adaptive-pilot-p95-questions"
          value={formatNumber(
            metrics.p95QuestionCount,
            AdaptivePracticeQuizPrivacyField.QuestionCountPercentiles
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.medianDuration')}
          dataCy="adaptive-pilot-median-duration"
          value={formatDuration(
            metrics.medianElapsedSeconds,
            AdaptivePracticeQuizPrivacyField.DurationPercentiles
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.p95Duration')}
          dataCy="adaptive-pilot-p95-duration"
          value={formatDuration(
            metrics.p95ElapsedSeconds,
            AdaptivePracticeQuizPrivacyField.DurationPercentiles
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.nearBoundaryRate')}
          dataCy="adaptive-pilot-near-boundary-rate"
          value={formatRate(
            metrics.nearBoundaryRate,
            AdaptivePracticeQuizPrivacyField.NearBoundary
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.responseIntegrity')}
          dataCy="adaptive-pilot-response-integrity"
          value={formatStatus(
            metrics.responseCountMismatchDetected,
            AdaptivePracticeQuizPrivacyField.ResponseCountMismatch
          )}
        />
        <PilotMetric
          label={t('manage.evaluation.adaptive.pilot.durationCompleteness')}
          dataCy="adaptive-pilot-duration-completeness"
          value={formatStatus(
            metrics.durationMissingDetected,
            AdaptivePracticeQuizPrivacyField.DurationMissing
          )}
        />
      </dl>

      <div className="divide-y divide-gray-200 md:hidden">
        {items.map((item) => (
          <article
            key={item.poolItemId}
            className="py-4 first:pt-0"
            data-cy={`adaptive-item-diagnostic-mobile-${item.poolItemId}`}
          >
            <div className="break-words font-medium">{item.elementName}</div>
            <div className="mt-1 break-words text-sm text-gray-700">
              {item.nodeNamePath.join(' / ')}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.level')}
                value={item.levelLabel}
              />
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.responses')}
                value={String(
                  item.responseCount ??
                    unavailable(
                      AdaptivePracticeQuizPrivacyField.ItemExposure,
                      item.suppressions
                    )
                )}
              />
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.exposure')}
                value={formatRate(
                  item.exposureRate,
                  AdaptivePracticeQuizPrivacyField.ItemExposure,
                  item.suppressions
                )}
              />
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.observed')}
                value={formatRate(
                  item.observedCorrectRate,
                  AdaptivePracticeQuizPrivacyField.ItemAccuracy,
                  item.suppressions
                )}
              />
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.expected')}
                value={formatRate(
                  item.expectedCorrectRate,
                  AdaptivePracticeQuizPrivacyField.ItemAccuracy,
                  item.suppressions
                )}
              />
              <PilotMetric
                label={t('manage.evaluation.adaptive.pilot.residual')}
                value={formatNumber(
                  item.residual,
                  AdaptivePracticeQuizPrivacyField.ItemResidual,
                  item.suppressions
                )}
              />
            </dl>
            <div className="mt-3 text-sm">
              <div className="mb-1 text-xs text-gray-600">
                {t('manage.evaluation.adaptive.pilot.flags')}
              </div>
              <DiagnosticFlags item={item} />
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
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
                  {item.responseCount ??
                    unavailable(
                      AdaptivePracticeQuizPrivacyField.ItemExposure,
                      item.suppressions
                    )}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(
                    item.exposureRate,
                    AdaptivePracticeQuizPrivacyField.ItemExposure,
                    item.suppressions
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(
                    item.observedCorrectRate,
                    AdaptivePracticeQuizPrivacyField.ItemAccuracy,
                    item.suppressions
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatRate(
                    item.expectedCorrectRate,
                    AdaptivePracticeQuizPrivacyField.ItemAccuracy,
                    item.suppressions
                  )}
                </td>
                <td className="px-2 py-2 tabular-nums">
                  {formatNumber(
                    item.residual,
                    AdaptivePracticeQuizPrivacyField.ItemResidual,
                    item.suppressions
                  )}
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

function PilotMetric({
  label,
  value,
  dataCy,
}: {
  label: string
  value: string
  dataCy?: string
}) {
  return (
    <div data-cy={dataCy}>
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
  const unavailable = new Set<string>()
  if (item.highExposure == null) {
    unavailable.add(t('manage.evaluation.adaptive.suppressedValue'))
  }
  if (item.misfitFlag == null) {
    const residualSuppression = item.suppressions.find(
      ({ field }) => field === AdaptivePracticeQuizPrivacyField.ItemResidual
    )
    unavailable.add(
      residualSuppression?.reason ===
        AdaptivePracticeQuizPrivacySuppressionReason.MinimumResponses
        ? t('manage.evaluation.adaptive.pilot.notEnoughResponses')
        : t('manage.evaluation.adaptive.suppressedValue')
    )
  }

  if (flags.length === 0 && unavailable.size === 0) {
    return (
      <span className="text-gray-500">
        {t('manage.evaluation.adaptive.pilot.noFlags')}
      </span>
    )
  }

  return (
    <div className="space-y-1">
      {flags.length > 0 ? (
        <div className="font-medium text-red-700">{flags.join(', ')}</div>
      ) : null}
      {Array.from(unavailable).map((value) => (
        <div key={value} className="text-gray-500">
          {value}
        </div>
      ))}
    </div>
  )
}

export default AdaptivePilotMetrics

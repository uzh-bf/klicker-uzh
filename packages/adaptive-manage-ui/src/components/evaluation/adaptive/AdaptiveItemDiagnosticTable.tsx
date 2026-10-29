import AdaptiveItemPreview from './AdaptiveItemPreview'
import {
  AdaptivePracticeQuizPrivacyField,
  AdaptivePracticeQuizPrivacySuppressionReason,
} from '@klicker-uzh/graphql/dist/ops'
import { Tooltip } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import type { AdaptiveItemDiagnostic } from './types'

function AdaptiveItemDiagnosticTable({
  practiceQuizId,
  items,
}: {
  practiceQuizId: string
  items: AdaptiveItemDiagnostic[]
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const hidden = t('manage.evaluation.adaptive.suppressedValue')
  const unavailable = (
    field: AdaptivePracticeQuizPrivacyField,
    suppressions: AdaptiveItemDiagnostic['suppressions']
  ) => {
    const suppression = suppressions.find((entry) => entry.field === field)
    return !suppression ||
      suppression.reason ===
        AdaptivePracticeQuizPrivacySuppressionReason.MinimumResponses
      ? t('manage.evaluation.adaptive.notEnoughData')
      : hidden
  }
  const formatRate = (
    value: number | null | undefined,
    field: AdaptivePracticeQuizPrivacyField,
    suppressions: AdaptiveItemDiagnostic['suppressions']
  ) =>
    value == null
      ? unavailable(field, suppressions)
      : formatter.number(value, {
          style: 'percent',
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })

  return (
    <>
      <div className="divide-y divide-gray-200 md:hidden">
        {items.map((item) => (
          <article
            key={item.poolItemId}
            className="py-4 first:pt-0"
            data-cy={`adaptive-item-diagnostic-mobile-${item.poolItemId}`}
          >
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 break-words font-medium">
                {item.elementName}
              </span>
              <AdaptiveItemPreview
                practiceQuizId={practiceQuizId}
                poolItemId={item.poolItemId}
                name={item.elementName}
              />
            </div>
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
            </dl>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
          <thead className="bg-gray-50 text-xs text-gray-700">
            <tr>
              <th className="w-64 px-2 py-2">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.item'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-item"
                  >
                    {t('manage.evaluation.adaptive.pilot.item')}
                  </span>
                </Tooltip>
              </th>
              <th className="w-64 px-2 py-2">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.competence'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-competence"
                  >
                    {t('manage.evaluation.adaptive.pilot.competence')}
                  </span>
                </Tooltip>
              </th>
              <th className="w-28 px-2 py-2">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.level'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-level"
                  >
                    {t('manage.evaluation.adaptive.pilot.level')}
                  </span>
                </Tooltip>
              </th>
              <th className="px-2 py-2 text-right">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.responses'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-responses"
                  >
                    {t('manage.evaluation.adaptive.pilot.responses')}
                  </span>
                </Tooltip>
              </th>
              <th className="px-2 py-2 text-right">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.exposure'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-exposure"
                  >
                    {t('manage.evaluation.adaptive.pilot.exposure')}
                  </span>
                </Tooltip>
              </th>
              <th className="px-2 py-2 text-right">
                <Tooltip
                  tooltip={t(
                    'manage.evaluation.adaptive.pilot.columnHelp.observed'
                  )}
                >
                  <span
                    className="cursor-help text-left underline decoration-dotted underline-offset-4"
                    data-cy="adaptive-column-help-observed"
                  >
                    {t('manage.evaluation.adaptive.pilot.observed')}
                  </span>
                </Tooltip>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.poolItemId}
                className="border-b border-gray-200 align-middle"
                data-cy={`adaptive-item-diagnostic-${item.poolItemId}`}
              >
                <td className="break-words px-2 py-2 font-medium">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1">{item.elementName}</span>
                    <AdaptiveItemPreview
                      practiceQuizId={practiceQuizId}
                      poolItemId={item.poolItemId}
                      name={item.elementName}
                    />
                  </div>
                </td>
                <td className="break-words px-2 py-2 text-gray-700">
                  {item.nodeNamePath.join(' / ')}
                </td>
                <td className="px-2 py-2">{item.levelLabel}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {item.responseCount ??
                    unavailable(
                      AdaptivePracticeQuizPrivacyField.ItemExposure,
                      item.suppressions
                    )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatRate(
                    item.exposureRate,
                    AdaptivePracticeQuizPrivacyField.ItemExposure,
                    item.suppressions
                  )}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {formatRate(
                    item.observedCorrectRate,
                    AdaptivePracticeQuizPrivacyField.ItemAccuracy,
                    item.suppressions
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
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

export default AdaptiveItemDiagnosticTable

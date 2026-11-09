import { useTranslations } from 'next-intl'
import type { DryRunAgreement } from './adaptiveDryRunChart'
import { percent } from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.chart'

// Counts of the green, amber and red results next to the chart and table.
function AdaptiveDryRunAgreement({
  agreement,
}: {
  agreement: DryRunAgreement
}) {
  const t = useTranslations()
  const rows = [
    ['bg-green-600', t(`${KEY}.legend.right`), agreement.exact],
    ['bg-amber-500', t(`${KEY}.legend.oneOff`), agreement.oneOff],
    ['bg-red-600', t(`${KEY}.legend.moreOff`), agreement.moreOff],
    ...(agreement.notReported > 0
      ? ([
          [
            'bg-gray-400',
            t('manage.evaluation.adaptive.dryRuns.result.notReported'),
            agreement.notReported,
          ],
        ] as const)
      : []),
  ] as const

  return (
    <div
      className="rounded border border-gray-200 p-3 text-sm lg:w-56 lg:shrink-0"
      data-cy="adaptive-dry-run-agreement"
    >
      <div className="mb-2 text-xs font-semibold text-gray-700">
        {t(`${KEY}.agreementTitle`, { count: agreement.total })}
      </div>
      <ul className="space-y-1.5">
        {rows.map(([tone, label, count]) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${tone}`}
            />
            <span className="flex-1 text-gray-700">{label}</span>
            <span className="tabular-nums font-semibold">{count}</span>
            <span className="w-10 text-right tabular-nums text-gray-500">
              {agreement.total > 0 ? percent(count / agreement.total) : '–'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default AdaptiveDryRunAgreement

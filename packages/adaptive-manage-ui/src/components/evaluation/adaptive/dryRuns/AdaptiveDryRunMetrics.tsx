import { useTranslations } from 'next-intl'
import { type DryRunSummary, percent } from './adaptiveDryRunTypes'

function Tile({
  label,
  value,
  hint,
  cy,
}: {
  label: string
  value: string
  hint?: string
  cy: string
}) {
  return (
    <div className="rounded border border-gray-200 px-3 py-2" data-cy={cy}>
      <div className="text-xs text-gray-600">{label}</div>
      <div className="text-xl font-semibold tabular-nums">{value}</div>
      {hint ? <div className="text-xs text-gray-500">{hint}</div> : null}
    </div>
  )
}

export const formatBias = (bias: number) =>
  `${bias > 0 ? '+' : bias < 0 ? '−' : '±'}${Math.abs(bias).toFixed(2)}`

function AdaptiveDryRunMetrics({ summary }: { summary: DryRunSummary }) {
  const t = useTranslations()
  const { metrics, questions } = summary
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
      <Tile
        label={t('manage.evaluation.adaptive.dryRuns.result.exact')}
        value={percent(metrics.exactShare)}
        cy="adaptive-dry-run-metric-exact"
      />
      <Tile
        label={t('manage.evaluation.adaptive.dryRuns.result.withinOne')}
        value={percent(metrics.withinOneShare)}
        cy="adaptive-dry-run-metric-within-one"
      />
      <Tile
        label={t('manage.evaluation.adaptive.dryRuns.result.bias')}
        value={formatBias(metrics.bias)}
        hint={t('manage.evaluation.adaptive.dryRuns.result.biasHint')}
        cy="adaptive-dry-run-metric-bias"
      />
      <Tile
        label={t('manage.evaluation.adaptive.dryRuns.result.questions')}
        value={questions.mean.toFixed(1)}
        hint={t('manage.evaluation.adaptive.dryRuns.result.questionsHint', {
          median: questions.median,
          max: questions.max,
        })}
        cy="adaptive-dry-run-metric-questions"
      />
      <Tile
        label={t('manage.evaluation.adaptive.dryRuns.result.determined')}
        value={percent(metrics.determinedShare)}
        cy="adaptive-dry-run-metric-determined"
      />
    </div>
  )
}

export default AdaptiveDryRunMetrics

import { Label } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type DryRunSummary, percent } from './adaptiveDryRunTypes'

const R = 'manage.evaluation.adaptive.dryRuns.result'

function Tile({
  label,
  tooltip,
  value,
  hint,
  cy,
}: {
  label: string
  tooltip: string
  value: string
  hint?: string
  cy: string
}) {
  return (
    <div className="rounded border border-gray-200 px-3 py-2" data-cy={cy}>
      <Label
        label={label}
        tooltip={tooltip}
        showTooltipSymbol
        tooltipSymbolSize="sm"
        className={{
          root: 'text-xs font-normal text-gray-600',
          tooltip: 'max-w-80 text-sm',
        }}
      />
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
        label={t(`${R}.exact`)}
        tooltip={t(`${R}.exactTooltip`)}
        value={percent(metrics.exactShare)}
        cy="adaptive-dry-run-metric-exact"
      />
      <Tile
        label={t(`${R}.withinOne`)}
        tooltip={t(`${R}.withinOneTooltip`)}
        value={percent(metrics.withinOneShare)}
        cy="adaptive-dry-run-metric-within-one"
      />
      <Tile
        label={t(`${R}.bias`)}
        tooltip={t(`${R}.biasTooltip`)}
        value={formatBias(metrics.bias)}
        hint={t(`${R}.biasHint`)}
        cy="adaptive-dry-run-metric-bias"
      />
      <Tile
        label={t(`${R}.questions`)}
        tooltip={t(`${R}.questionsTooltip`)}
        value={questions.mean.toFixed(1)}
        hint={t(`${R}.questionsHint`, {
          median: questions.median,
          max: questions.max,
        })}
        cy="adaptive-dry-run-metric-questions"
      />
      <Tile
        label={t(`${R}.determined`)}
        tooltip={t(`${R}.determinedTooltip`)}
        value={percent(metrics.determinedShare)}
        cy="adaptive-dry-run-metric-determined"
      />
    </div>
  )
}

export default AdaptiveDryRunMetrics

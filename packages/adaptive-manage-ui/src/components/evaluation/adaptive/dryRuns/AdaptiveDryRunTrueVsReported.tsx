import { Label } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import {
  type DryRunChartScale,
  type DryRunLevelsSelection,
  dryRunChartPoints,
  dryRunChartScale,
  dryRunOverallPoints,
} from './adaptiveDryRunChart'
import type {
  DryRun,
  DryRunStudent,
  DryRunWorkspace,
} from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.chart'
const WIDTH = 640
const HEIGHT = 440
const LEFT = 64
const RIGHT = 8
const TOP = 8
const BOTTOM = 64

const pointTone = (difference: number) =>
  difference === 0
    ? 'fill-green-600'
    : Math.abs(difference) === 1
      ? 'fill-amber-500'
      : 'fill-red-600'

function axes(scale: DryRunChartScale) {
  const span = scale.max - scale.min
  return {
    x: (theta: number) =>
      LEFT + ((theta - scale.min) / span) * (WIDTH - LEFT - RIGHT),
    y: (theta: number) =>
      TOP + ((scale.max - theta) / span) * (HEIGHT - TOP - BOTTOM),
  }
}

// The students of a run: true ability (x) against the estimate (y), overall
// (one dot per student) or per competence. The horizontal bands are the levels the run reported; a dot
// inside the green box of its column got its true level.
function AdaptiveDryRunTrueVsReported({
  run,
  students,
  workspace,
  selection,
  onSelectStudent,
}: {
  run: DryRun
  students: DryRunStudent[] | null
  workspace: DryRunWorkspace
  selection: DryRunLevelsSelection
  onSelectStudent: (index: number) => void
}) {
  const t = useTranslations()
  const scale = dryRunChartScale(workspace, run)
  if (!scale) return null
  const { x, y } = axes(scale)
  const label = (id: number) =>
    workspace.levels.find((level) => level.id === id)?.label ?? `#${id}`
  const competenceName = (id: number) =>
    workspace.competences.find((competence) => competence.nodeId === id)
      ?.name ?? `#${id}`
  const points = !students
    ? []
    : selection === 'OVERALL'
      ? dryRunOverallPoints(students, scale)
      : dryRunChartPoints(students, workspace.levels, scale).filter(
          (point) => selection === 'POOLED' || point.nodeId === selection
        )
  const realistic = run.spec.answerModel === 'REALISTIC'
  const clamp = (theta: number) =>
    Math.min(Math.max(theta, scale.min), scale.max)

  return (
    <figure
      className="rounded border border-gray-200 p-3"
      data-cy="adaptive-dry-run-true-vs-reported"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <figcaption>
            <Label
              label={t(`${KEY}.title`)}
              tooltip={`${t(`${KEY}.hint`)} ${realistic ? t(`${KEY}.hintRealistic`) : t(`${KEY}.hintIdeal`)}${selection === 'OVERALL' ? ` ${t(`${KEY}.hintOverall`)}` : ''}`}
              showTooltipSymbol
              tooltipSymbolSize="sm"
              className={{
                root: 'text-sm font-semibold',
                tooltip: 'max-w-96 text-sm font-normal',
              }}
            />
          </figcaption>
          <p className="text-xs text-gray-600">{t(`${KEY}.clickHint`)}</p>
        </div>
      </div>
      {students ? (
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="mt-2 w-full max-w-4xl"
          role="img"
          aria-label={t(`${KEY}.title`)}
        >
          {scale.levels.map((level, index) => (
            <g key={`band-${level.id}`}>
              <rect
                x={LEFT}
                width={WIDTH - LEFT - RIGHT}
                y={y(level.upper)}
                height={y(level.lower) - y(level.upper)}
                className={index % 2 ? 'fill-gray-50' : 'fill-white'}
              />
              <text
                x={LEFT - 4}
                y={(y(level.upper) + y(level.lower)) / 2}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-600 text-[9px]"
              >
                {level.label}
              </text>
            </g>
          ))}
          {scale.levels.map((level) => (
            <g key={`true-${level.id}`}>
              <rect
                x={x(clamp(level.trueLower))}
                width={x(clamp(level.trueUpper)) - x(clamp(level.trueLower))}
                y={y(level.upper)}
                height={y(level.lower) - y(level.upper)}
                className="fill-green-100"
              />
              <line
                x1={x(clamp(level.trueLower))}
                x2={x(clamp(level.trueLower))}
                y1={TOP}
                y2={HEIGHT - BOTTOM}
                className="stroke-gray-200"
              />
              <text
                transform={`translate(${x(clamp((level.trueLower + level.trueUpper) / 2))} ${HEIGHT - BOTTOM + 6}) rotate(-45)`}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-gray-600 text-[9px]"
              >
                {level.label}
              </text>
            </g>
          ))}
          {points.map((point) => (
            // biome-ignore lint/a11y/useSemanticElements: an SVG point cannot be a native button; it keeps button semantics and keyboard access.
            <circle
              key={`${point.index}-${point.nodeId}`}
              cx={x(clamp(point.trueTheta))}
              cy={y(clamp(point.theta))}
              r={2.8}
              className={`${pointTone(point.difference)} cursor-pointer opacity-75 hover:opacity-100`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectStudent(point.index)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ')
                  onSelectStudent(point.index)
              }}
              data-cy={`adaptive-dry-run-chart-point-${point.index}-${point.nodeId}`}
            >
              <title>
                {t(`${KEY}.point`, {
                  index: point.index,
                  competence:
                    selection === 'OVERALL'
                      ? t(`${KEY}.overall`)
                      : competenceName(point.nodeId),
                  trueLevel: label(point.trueLevelId),
                  reported: label(point.reportedLevelId),
                })}
              </title>
            </circle>
          ))}
          <text
            x={(LEFT + WIDTH - RIGHT) / 2}
            y={HEIGHT - 4}
            textAnchor="middle"
            className="fill-gray-700 text-[10px] font-semibold"
          >
            {t(`${KEY}.xAxis`)}
          </text>
          <text
            transform={`translate(10 ${(TOP + HEIGHT - BOTTOM) / 2}) rotate(-90)`}
            textAnchor="middle"
            className="fill-gray-700 text-[10px] font-semibold"
          >
            {t(`${KEY}.yAxis`)}
          </text>
        </svg>
      ) : (
        <p className="mt-2 text-xs text-gray-500">{t(`${KEY}.loading`)}</p>
      )}
      <div className="mt-1 flex flex-wrap gap-3 text-xs text-gray-700">
        {(
          [
            ['bg-green-600', 'right'],
            ['bg-amber-500', 'oneOff'],
            ['bg-red-600', 'moreOff'],
          ] as const
        ).map(([tone, key]) => (
          <span key={key} className="flex items-center gap-1">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${tone}`} />
            {t(`${KEY}.legend.${key}`)}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-2.5 w-4 bg-green-100" />
          {t(`${KEY}.legend.zone`)}
        </span>
      </div>
    </figure>
  )
}

export default AdaptiveDryRunTrueVsReported

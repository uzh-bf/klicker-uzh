import { useFormatter, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import {
  type DryRunChartScale,
  dryRunChartScale,
  dryRunMastery,
  dryRunTrueTheta,
  dryRunWithinOneChance,
} from './adaptiveDryRunChart'
import {
  type DryRun,
  type DryRunStudent,
  type DryRunWorkspace,
  dryRunMasteryFrom,
} from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.chart.student'
const WIDTH = 600
// The estimate's θ badge sits above the level box; its line runs down from
// the badge through the box.
const BADGE_HEIGHT = 12
const LABEL_Y = 9
const BAND_TOP = 20
const BASELINE = BAND_TOP + 46
const ROW = BASELINE + 9
const PEAK = BASELINE - 15
const AXIS = 34

// Outline of a normal curve around `mean` (sd `sd`) between `from` and `to`,
// closed along the baseline so it can be filled.
function curvePath(
  mean: number,
  sd: number,
  from: number,
  to: number,
  x: (theta: number) => number
) {
  if (to <= from) return ''
  const steps = 48
  const points = Array.from({ length: steps + 1 }, (_, step) => {
    const theta = from + ((to - from) * step) / steps
    const height = PEAK * Math.exp(-0.5 * ((theta - mean) / sd) ** 2)
    return `${x(theta).toFixed(1)},${(BASELINE - height).toFixed(1)}`
  })
  return `M${x(from).toFixed(1)},${BASELINE} L${points.join(' L')} L${x(to).toFixed(1)},${BASELINE} Z`
}

const verdictTone = (difference: number) =>
  difference === 0
    ? 'text-green-700'
    : Math.abs(difference) === 1
      ? 'text-amber-700'
      : 'text-red-700'

function Columns({
  scale,
  x,
  height,
}: {
  scale: DryRunChartScale
  x: (theta: number) => number
  height: number
}) {
  return scale.levels.map((level, index) => (
    <rect
      key={level.id}
      x={x(level.lower)}
      width={x(level.upper) - x(level.lower)}
      y={0}
      height={height}
      className={index % 2 ? 'fill-gray-50' : 'fill-white'}
    />
  ))
}

// One student, one row per competence: the reported level (blue column), the
// true level (green bar below; the triangle is the exact simulated ability)
// and a curve of where the student probably is. The blue part of the curve
// is the chance that the reported level is exactly right; the text on the
// right says the same in words.

function AdaptiveDryRunStudentLevels({
  run,
  student,
  workspace,
}: {
  run: DryRun
  student: DryRunStudent
  workspace: DryRunWorkspace
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const num = (value: number) =>
    formatter.number(value, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  const scale = dryRunChartScale(workspace, run)
  if (!scale) return null
  const clamp = (theta: number) =>
    Math.min(Math.max(theta, scale.min), scale.max)
  const x = (theta: number) =>
    ((clamp(theta) - scale.min) / (scale.max - scale.min)) * WIDTH
  const rows = workspace.competences.map((competence) => {
    const truth = student.trueLevels.find(
      ({ nodeId }) => nodeId === competence.nodeId
    )
    const estimate = student.competences.find(
      ({ nodeId }) => nodeId === competence.nodeId
    )
    const trueLevel = scale.levels.find(({ id }) => id === truth?.levelId)
    const reported = scale.levels.find(({ id }) => id === estimate?.levelId)
    return {
      competence,
      estimate,
      trueLevel,
      reported,
      // Exact true ability: the simulated one of realistic students, the
      // middle of the true level for ideal ones (who answer it half right).
      trueTheta: truth ? dryRunTrueTheta(scale, truth) : null,
      withinOne: estimate ? dryRunWithinOneChance(scale, estimate) : null,
      mastery: estimate ? dryRunMastery(workspace, run, estimate) : null,
      difference:
        trueLevel && reported ? reported.order - trueLevel.order : null,
    }
  })

  return (
    <figure data-cy="adaptive-dry-run-student-levels">
      <figcaption className="text-xs font-semibold text-gray-700">
        {t(`${KEY}.title`)}
      </figcaption>
      <p className="text-xs text-gray-600">{t(`${KEY}.hint`)}</p>
      <div className="mt-2 grid max-w-5xl grid-cols-[7rem_minmax(0,1fr)_12rem] items-center gap-x-3">
        {rows.map(
          ({
            competence,
            estimate,
            trueLevel,
            reported,
            trueTheta,
            withinOne,
            mastery,
            difference,
          }) => {
            const theta = estimate?.theta ?? null
            const sd = estimate?.standardError ?? null
            return (
              <div
                key={competence.nodeId}
                className="contents"
                data-cy={`adaptive-dry-run-student-levels-${competence.nodeId}`}
              >
                <div
                  className="truncate text-right text-xs font-medium text-gray-800"
                  title={competence.name}
                >
                  {competence.name}
                </div>
                <svg
                  viewBox={`0 0 ${WIDTH} ${ROW}`}
                  className="block w-full border-b border-gray-200"
                  role="img"
                  aria-label={competence.name}
                >
                  <Columns scale={scale} x={x} height={ROW} />
                  {reported ? (
                    <rect
                      x={x(reported.lower)}
                      width={x(reported.upper) - x(reported.lower)}
                      y={BAND_TOP}
                      height={BASELINE - BAND_TOP}
                      fillOpacity={0.08}
                      className="fill-primary-100 stroke-primary-100"
                      strokeWidth={1.5}
                    >
                      <title>
                        {t(`${KEY}.reported`, { level: reported.label })}
                      </title>
                    </rect>
                  ) : null}
                  {mastery ? (
                    <line
                      x1={x(mastery.markTheta)}
                      x2={x(mastery.markTheta)}
                      y1={BAND_TOP}
                      y2={BASELINE}
                      className="stroke-primary-100"
                      strokeWidth={1}
                      strokeDasharray="3 2"
                    >
                      <title>
                        {t(`${KEY}.masteryMarkAt`, {
                          theta: num(mastery.markTheta),
                        })}
                      </title>
                    </line>
                  ) : null}
                  {theta !== null && sd ? (
                    <>
                      <path
                        d={curvePath(
                          theta,
                          sd,
                          Math.max(theta - 4 * sd, scale.min),
                          Math.min(theta + 4 * sd, scale.max),
                          x
                        )}
                        className="fill-none stroke-gray-700"
                        strokeWidth={1.25}
                      />
                    </>
                  ) : null}
                  {theta !== null
                    ? (() => {
                        // Estimate and mastery mark, labelled with their θ.
                        const estimateX = x(theta)
                        const label = t(`${KEY}.thetaLabel`, {
                          theta: num(theta),
                        })
                        // A dark badge centred on its line, kept inside the
                        // picture; roughly 5.4 units per character at 9px.
                        const badgeWidth = label.length * 5.4 + 8
                        const labelX = Math.min(
                          Math.max(estimateX, badgeWidth / 2),
                          WIDTH - badgeWidth / 2
                        )
                        return (
                          <g className="text-[9px] tabular-nums">
                            <line
                              x1={estimateX}
                              x2={estimateX}
                              y1={BADGE_HEIGHT}
                              y2={BASELINE}
                              className="stroke-gray-900"
                              strokeWidth={2}
                            />
                            <rect
                              x={labelX - badgeWidth / 2}
                              y={0}
                              width={badgeWidth}
                              height={BADGE_HEIGHT}
                              rx={3}
                              className="fill-gray-900"
                            />
                            <text
                              x={labelX}
                              y={LABEL_Y}
                              textAnchor="middle"
                              className="fill-white font-semibold"
                              data-cy="adaptive-dry-run-theta-label"
                            >
                              {label}
                            </text>
                          </g>
                        )
                      })()
                    : null}
                  {trueTheta !== null ? (
                    <line
                      x1={x(trueTheta)}
                      x2={x(trueTheta)}
                      y1={BAND_TOP}
                      y2={BASELINE}
                      className="stroke-green-600"
                      strokeWidth={2}
                      data-cy={`adaptive-dry-run-true-theta-${competence.nodeId}`}
                    >
                      <title>
                        {t(`${KEY}.summary.trueTheta`, {
                          theta: num(trueTheta),
                        })}
                      </title>
                    </line>
                  ) : null}
                </svg>
                <div className="space-y-0.5 text-xs leading-tight">
                  {reported ? (
                    <div>
                      <span className="text-sm font-semibold text-primary-100">
                        {reported.label}
                      </span>{' '}
                      <span className="text-gray-500">
                        {t(`${KEY}.summary.reported`)}
                      </span>
                      {mastery ? (
                        <span
                          className={twMerge(
                            'ml-1 rounded px-1',
                            mastery.mastered
                              ? 'bg-green-100 text-green-900'
                              : 'bg-amber-100 text-amber-900'
                          )}
                          data-cy={`adaptive-dry-run-mastery-${competence.nodeId}`}
                        >
                          {t(
                            mastery.mastered
                              ? `${KEY}.summary.mastered`
                              : `${KEY}.summary.notMastered`
                          )}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {trueLevel ? (
                    <div className="text-gray-700">
                      {t(`${KEY}.summary.true`, { level: trueLevel.label })}
                      {difference !== null ? (
                        <>
                          {' · '}
                          <span
                            className={twMerge(
                              'font-medium',
                              verdictTone(difference)
                            )}
                          >
                            {difference === 0
                              ? t(`${KEY}.summary.correct`)
                              : t(
                                  difference > 0
                                    ? `${KEY}.summary.tooHigh`
                                    : `${KEY}.summary.tooLow`,
                                  { count: Math.abs(difference) }
                                )}
                          </span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {theta !== null ? (
                    <div
                      className="text-gray-600 tabular-nums"
                      data-cy={`adaptive-dry-run-theta-${competence.nodeId}`}
                    >
                      {t(`${KEY}.summary.theta`, {
                        theta: num(theta),
                        se: sd === null ? '–' : num(sd),
                      })}
                      {mastery && reported
                        ? ` · ${t(`${KEY}.summary.into`, {
                            share: Math.round(mastery.share * 100),
                            level: reported.label,
                            mark: num(mastery.markTheta),
                          })}`
                        : ''}
                      {trueTheta !== null
                        ? ` · ${t(`${KEY}.summary.trueTheta`, {
                            theta: num(trueTheta),
                          })}`
                        : ''}
                    </div>
                  ) : null}
                  {withinOne !== null ? (
                    <div className="text-primary-100">
                      {t(`${KEY}.summary.withinOne`, {
                        probability: withinOne,
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          }
        )}
        <div />
        <svg
          viewBox={`0 0 ${WIDTH} ${AXIS}`}
          className="block w-full"
          aria-hidden="true"
        >
          {scale.levels.map((level) => (
            <text
              key={level.id}
              transform={`translate(${(x(level.lower) + x(level.upper)) / 2} 4) rotate(-45)`}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-gray-600 text-[10px]"
            >
              {level.label}
            </text>
          ))}
        </svg>
        <div />
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-700">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-4 border-[1.5px] border-primary-100 bg-primary-100/10" />
          {t(`${KEY}.legend.reported`)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0 border-l-2 border-green-600" />
          {t(`${KEY}.legend.trueTheta`)}
        </span>
        <span className="flex items-center gap-1">
          <svg viewBox="0 0 20 10" className="h-2.5 w-5" aria-hidden="true">
            <path
              d="M0,10 C6,10 7,0 10,0 C13,0 14,10 20,10"
              className="fill-none stroke-gray-700"
            />
          </svg>
          {t(`${KEY}.legend.curve`)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0 border-l-2 border-gray-900" />
          <span className="rounded-sm bg-gray-900 px-1 text-[10px] font-semibold text-white">
            θ
          </span>
          {t(`${KEY}.legend.estimate`)}
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0 border-l border-dashed border-primary-100" />
          {t(`${KEY}.legend.masteryMark`, {
            share: Math.round(dryRunMasteryFrom(run.effectiveSettings) * 100),
          })}
        </span>
      </div>
    </figure>
  )
}

export default AdaptiveDryRunStudentLevels

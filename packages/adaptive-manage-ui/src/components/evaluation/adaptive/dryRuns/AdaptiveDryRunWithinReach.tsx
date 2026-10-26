import { useTranslations } from 'next-intl'
import { summarizeDryRunHints } from './adaptiveDryRunHints'
import type { DryRunStudent, DryRunWorkspace } from './adaptiveDryRunTypes'
import { percent } from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.withinReach'

// "Next level within reach": a hint shown on top of the reported level when
// the estimate lies in the upper part of its band. The two readings of a
// result are measured side by side: "level reached" (reported = true level)
// and "next level" (suggested = true level + 1).
function AdaptiveDryRunWithinReach({
  students,
  workspace,
  threshold,
  onThresholdChange,
}: {
  students: DryRunStudent[] | null
  workspace: DryRunWorkspace
  threshold: number
  onThresholdChange: (threshold: number) => void
}) {
  const t = useTranslations()
  const summary = students
    ? summarizeDryRunHints(students, workspace, threshold / 100)
    : null
  const tiles = summary
    ? ([
        ['hint', summary.hintShare],
        ['reached', summary.reachedShare],
        ['nextLevel', summary.nextLevelShare],
        ['covered', summary.coveredShare],
      ] as const)
    : []

  return (
    <div
      className="rounded border border-gray-200 p-3"
      data-cy="adaptive-dry-run-within-reach"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h5 className="text-sm font-semibold">{t(`${KEY}.title`)}</h5>
          <p className="max-w-3xl text-xs text-gray-600">{t(`${KEY}.hint`)}</p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-gray-700">
            {t(`${KEY}.threshold`, { threshold })}
          </span>
          <input
            type="range"
            min={50}
            max={95}
            step={5}
            value={threshold}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
            className="w-40"
            data-cy="adaptive-dry-run-within-reach-threshold"
          />
        </label>
      </div>
      {summary ? (
        <div className="mt-2 grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2">
          {tiles.map(([key, value]) => (
            <div
              key={key}
              className="rounded border border-gray-200 px-3 py-2"
              data-cy={`adaptive-dry-run-within-reach-${key}`}
            >
              <div className="text-xs text-gray-600">
                {t(`${KEY}.tiles.${key}`)}
              </div>
              <div className="text-xl font-semibold tabular-nums">
                {percent(value)}
              </div>
              <div className="text-xs text-gray-500">
                {t(`${KEY}.tileHints.${key}`)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-gray-500">{t(`${KEY}.loading`)}</p>
      )}
    </div>
  )
}

export default AdaptiveDryRunWithinReach

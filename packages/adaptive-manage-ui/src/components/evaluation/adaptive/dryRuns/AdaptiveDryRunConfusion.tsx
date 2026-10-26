import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import {
  type DryRunLevel,
  type DryRunSummary,
  mainLevelOf,
  percent,
} from './adaptiveDryRunTypes'

const cellTone = (difference: number | null) =>
  difference === null
    ? 'bg-gray-100 text-gray-700'
    : difference === 0
      ? 'bg-green-100 text-green-900'
      : Math.abs(difference) === 1
        ? 'bg-amber-100 text-amber-900'
        : 'bg-red-100 text-red-900'

// True × reported level at full sublevel resolution: one row per true level
// of the run, one column per level of the scale. Thicker lines separate main
// levels (A2, B1, …) only for orientation; nothing is grouped.
function AdaptiveDryRunConfusion({
  summary,
  levels,
}: {
  summary: DryRunSummary
  levels: DryRunLevel[]
}) {
  const t = useTranslations()
  const ordered = levels.slice().sort((a, b) => a.order - b.order)
  const byId = new Map(ordered.map((level) => [level.id, level]))
  const startsGroup = (index: number) =>
    index > 0 &&
    mainLevelOf(ordered[index]!.label) !==
      mainLevelOf(ordered[index - 1]!.label)
  const hasUnreported = summary.confusion.some(({ reported }) =>
    reported.some(({ levelId }) => levelId === null)
  )
  const rows = summary.confusion
    .slice()
    .sort(
      (a, b) =>
        (byId.get(a.trueLevelId)?.order ?? 0) -
        (byId.get(b.trueLevelId)?.order ?? 0)
    )

  return (
    <div data-cy="adaptive-dry-run-confusion">
      <h5 className="mb-1 text-sm font-semibold">
        {t('manage.evaluation.adaptive.dryRuns.result.confusion')}
      </h5>
      <p className="mb-2 text-xs text-gray-600">
        {t('manage.evaluation.adaptive.dryRuns.result.confusionHint')}
      </p>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-center text-xs tabular-nums">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 py-1.5 text-left whitespace-nowrap">
                {t('manage.evaluation.adaptive.dryRuns.result.trueReported')}
              </th>
              {ordered.map((level, index) => (
                <th
                  key={level.id}
                  className={twMerge(
                    'px-0.5 py-1.5 font-medium whitespace-nowrap',
                    startsGroup(index) && 'border-l border-gray-300'
                  )}
                >
                  {level.label}
                </th>
              ))}
              {hasUnreported ? (
                <th className="border-l border-gray-300 px-1 py-1.5">
                  {t('manage.evaluation.adaptive.dryRuns.result.notReported')}
                </th>
              ) : null}
              <th className="border-l border-gray-300 px-2 py-1.5">
                {t('manage.evaluation.adaptive.dryRuns.result.exact')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ trueLevelId, reported }) => {
              const trueLevel = byId.get(trueLevelId)
              const counts = new Map(
                reported.map(({ levelId, count }) => [levelId, count])
              )
              const total = reported.reduce((sum, { count }) => sum + count, 0)
              return (
                <tr
                  key={trueLevelId}
                  className="border-t border-gray-100"
                  data-cy={`adaptive-dry-run-confusion-row-${trueLevel?.label ?? trueLevelId}`}
                >
                  <th className="px-2 py-1 text-left font-medium whitespace-nowrap">
                    {trueLevel?.label ?? `#${trueLevelId}`}
                  </th>
                  {ordered.map((level, index) => {
                    const count = counts.get(level.id) ?? 0
                    return (
                      <td
                        key={level.id}
                        className={twMerge(
                          'px-0.5 py-0.5',
                          startsGroup(index) && 'border-l border-gray-300'
                        )}
                        title={`${trueLevel?.label} → ${level.label}: ${count}`}
                      >
                        {count > 0 ? (
                          <span
                            className={twMerge(
                              'block min-w-6 rounded px-0.5 py-0.5',
                              cellTone(
                                trueLevel ? level.order - trueLevel.order : null
                              )
                            )}
                          >
                            {count}
                          </span>
                        ) : (
                          <span className="text-gray-300">·</span>
                        )}
                      </td>
                    )
                  })}
                  {hasUnreported ? (
                    <td className="border-l border-gray-300 px-0.5 py-0.5">
                      {counts.get(null) ? (
                        <span
                          className={twMerge('block rounded', cellTone(null))}
                        >
                          {counts.get(null)}
                        </span>
                      ) : (
                        <span className="text-gray-300">·</span>
                      )}
                    </td>
                  ) : null}
                  <td className="border-l border-gray-300 px-2 py-0.5 font-medium">
                    {total === 0
                      ? '–'
                      : percent((counts.get(trueLevelId) ?? 0) / total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdaptiveDryRunConfusion

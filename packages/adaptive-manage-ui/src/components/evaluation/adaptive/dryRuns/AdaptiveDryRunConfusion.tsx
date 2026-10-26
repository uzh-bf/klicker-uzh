import { useTranslations } from 'next-intl'
import { Fragment, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type DryRunLevel,
  type DryRunSummary,
  mainLevelOf,
} from './adaptiveDryRunTypes'

const cellTone = (difference: number | null) =>
  difference === null
    ? 'bg-gray-100 text-gray-700'
    : difference === 0
      ? 'bg-green-100 text-green-900'
      : Math.abs(difference) === 1
        ? 'bg-amber-100 text-amber-900'
        : 'bg-red-100 text-red-900'

// True × reported levels, grouped by main level (B1, B2, …). A row opens the
// sublevels of that main level with their reported sublevels.
function AdaptiveDryRunConfusion({
  summary,
  levels,
}: {
  summary: DryRunSummary
  levels: DryRunLevel[]
}) {
  const t = useTranslations()
  const [open, setOpen] = useState<string | null>(null)
  const byId = new Map(levels.map((level) => [level.id, level]))
  const groups = [...new Set(levels.map(({ label }) => mainLevelOf(label)))]
  const groupIndex = new Map(groups.map((group, index) => [group, index]))
  const groupOf = (levelId: number | null) =>
    levelId === null ? null : mainLevelOf(byId.get(levelId)?.label ?? '')

  const counts = new Map<string, Map<string | null, number>>()
  for (const row of summary.confusion) {
    const trueGroup = groupOf(row.trueLevelId)!
    const cells = counts.get(trueGroup) ?? new Map()
    for (const { levelId, count } of row.reported) {
      const group = groupOf(levelId)
      cells.set(group, (cells.get(group) ?? 0) + count)
    }
    counts.set(trueGroup, cells)
  }
  const hasUnreported = summary.confusion.some(({ reported }) =>
    reported.some(({ levelId }) => levelId === null)
  )
  const columns: Array<string | null> = [
    ...groups,
    ...(hasUnreported ? [null] : []),
  ]

  return (
    <div data-cy="adaptive-dry-run-confusion">
      <h5 className="mb-1 text-sm font-semibold">
        {t('manage.evaluation.adaptive.dryRuns.result.confusion')}
      </h5>
      <p className="mb-2 text-xs text-gray-600">
        {t('manage.evaluation.adaptive.dryRuns.result.confusionHint')}
      </p>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full text-center text-sm tabular-nums">
          <thead className="bg-gray-50 text-xs text-gray-700">
            <tr>
              <th className="px-2 py-2 text-left">
                {t('manage.evaluation.adaptive.dryRuns.result.trueReported')}
              </th>
              {columns.map((group) => (
                <th key={group ?? 'none'} className="px-2 py-2">
                  {group ??
                    t('manage.evaluation.adaptive.dryRuns.result.notReported')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups
              .filter((group) => counts.has(group))
              .map((group) => {
                const cells = counts.get(group)!
                const isOpen = open === group
                const sublevels = summary.confusion.filter(
                  ({ trueLevelId }) => groupOf(trueLevelId) === group
                )
                return (
                  <Fragment key={group}>
                    <tr
                      className="cursor-pointer border-t border-gray-100 hover:bg-gray-50"
                      onClick={() => setOpen(isOpen ? null : group)}
                      aria-expanded={isOpen}
                      data-cy={`adaptive-dry-run-confusion-row-${group}`}
                    >
                      <th className="px-2 py-1.5 text-left font-medium">
                        {isOpen ? '▾ ' : '▸ '}
                        {group}
                      </th>
                      {columns.map((column) => {
                        const count = cells.get(column) ?? 0
                        return (
                          <td key={column ?? 'none'} className="px-1 py-1">
                            {count > 0 ? (
                              <span
                                className={twMerge(
                                  'block rounded px-1 py-0.5',
                                  cellTone(
                                    column === null
                                      ? null
                                      : groupIndex.get(column)! -
                                          groupIndex.get(group)!
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
                    </tr>
                    {isOpen ? (
                      <tr className="bg-gray-50">
                        <td colSpan={columns.length + 1} className="px-3 py-2">
                          <div className="space-y-1 text-left text-xs">
                            {sublevels.map(({ trueLevelId, reported }) => {
                              const trueLevel = byId.get(trueLevelId)!
                              return (
                                <div
                                  key={trueLevelId}
                                  className="flex flex-wrap items-center gap-1"
                                >
                                  <span className="w-28 font-medium">
                                    {t(
                                      'manage.evaluation.adaptive.dryRuns.result.trueLevel',
                                      { level: trueLevel.label }
                                    )}
                                  </span>
                                  {reported.map(({ levelId, count }) => {
                                    const level =
                                      levelId === null
                                        ? null
                                        : byId.get(levelId)
                                    return (
                                      <span
                                        key={levelId ?? 'none'}
                                        className={twMerge(
                                          'rounded px-1.5 py-0.5',
                                          cellTone(
                                            level
                                              ? level.order - trueLevel.order
                                              : null
                                          )
                                        )}
                                      >
                                        {`${level?.label ?? t('manage.evaluation.adaptive.dryRuns.result.notReported')}: ${count}`}
                                      </span>
                                    )
                                  })}
                                </div>
                              )
                            })}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AdaptiveDryRunConfusion

import { useTranslations } from 'next-intl'
import { Fragment } from 'react'
import { twMerge } from 'tailwind-merge'
import { formatBias } from './AdaptiveDryRunMetrics'
import {
  type DryRunSubcompetenceSummary,
  type DryRunWorkspace,
  percent,
} from './adaptiveDryRunTypes'

// Per subcompetence: how often it was asked and counted, and where its
// question pool has gaps. A simulated student has one true level per
// competence, so the deviation is only a rough indicator.
function AdaptiveDryRunSubcompetences({
  rows,
  workspace,
}: {
  rows: DryRunSubcompetenceSummary[]
  workspace: DryRunWorkspace
}) {
  const t = useTranslations()
  const names = new Map(
    workspace.subcompetences.map(({ nodeId, name }) => [nodeId, name])
  )
  const levelLabel = (id: number) =>
    workspace.levels.find((level) => level.id === id)?.label ?? `#${id}`
  const share = (row: DryRunSubcompetenceSummary, count: number) => {
    const total = Object.values(row.coverage).reduce((sum, n) => sum + n, 0)
    return total === 0 ? '–' : percent(count / total)
  }
  const key = 'manage.evaluation.adaptive.dryRuns.subcompetences'

  const withGaps = rows.filter(({ pool }) =>
    pool.some(({ count }) => count === 0)
  ).length

  return (
    <details
      className="group rounded border border-gray-200"
      data-cy="adaptive-dry-run-subcompetences"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
        <span className="text-gray-500 group-open:rotate-90">▸</span>
        <span className="font-semibold">{t(`${key}.title`)}</span>
        <span className="text-xs text-gray-600">
          {t(`${key}.summary`, { count: rows.length, gaps: withGaps })}
        </span>
      </summary>
      <div className="px-3 pb-3">
        <p className="mb-2 max-w-4xl text-xs text-gray-600">
          {t(`${key}.hint`)}
        </p>
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full min-w-[60rem] text-left text-sm tabular-nums">
            <thead className="bg-gray-50 text-xs text-gray-700">
              <tr>
                <th className="px-3 py-2">{t(`${key}.subcompetence`)}</th>
                <th className="px-3 py-2 text-right">{t(`${key}.answers`)}</th>
                <th className="px-3 py-2 text-right">{t(`${key}.covered`)}</th>
                <th className="px-3 py-2 text-right">
                  {t(`${key}.notSampled`)}
                </th>
                <th className="px-3 py-2 text-right">
                  {t(`${key}.outOfRange`)}
                </th>
                <th className="px-3 py-2">{t(`${key}.pool`)}</th>
                <th className="px-3 py-2 text-right">
                  {t(`${key}.deviation`)}
                </th>
              </tr>
            </thead>
            <tbody>
              {workspace.competences.map((competence) => {
                const leaves = rows.filter(
                  ({ rootId }) => rootId === competence.nodeId
                )
                if (leaves.length === 0) return null
                return (
                  <Fragment key={competence.nodeId}>
                    <tr className="border-t border-gray-200 bg-gray-50/60">
                      <th
                        colSpan={7}
                        className="px-3 py-1.5 text-xs font-semibold text-gray-700"
                      >
                        {competence.name}
                      </th>
                    </tr>
                    {leaves.map((row) => {
                      const gaps = row.pool.filter(({ count }) => count === 0)
                      return (
                        <tr
                          key={row.nodeId}
                          className="border-t border-gray-100 align-top"
                          data-cy={`adaptive-dry-run-subcompetence-${row.nodeId}`}
                        >
                          <td className="px-3 py-2">
                            {names.get(row.nodeId) ?? `#${row.nodeId}`}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.meanAnswers.toFixed(1)}
                            <div className="text-xs text-gray-500">
                              {t(`${key}.min`, { min: row.minAnswers })}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            {share(row, row.coverage.COVERED)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {share(row, row.coverage.NOT_SAMPLED)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {share(row, row.coverage.OUT_OF_RANGE)}
                          </td>
                          <td className="px-3 py-2">
                            <div className="flex flex-wrap gap-0.5">
                              {row.pool.map(({ levelId, count, used }) => (
                                <span
                                  key={levelId}
                                  title={t(`${key}.poolCell`, {
                                    level: levelLabel(levelId),
                                    count,
                                    used,
                                  })}
                                  className={twMerge(
                                    'min-w-6 rounded px-1 text-center text-xs',
                                    count === 0
                                      ? 'bg-red-100 text-red-800'
                                      : used === 0
                                        ? 'bg-gray-100 text-gray-600'
                                        : 'bg-green-100 text-green-900'
                                  )}
                                >
                                  {count}
                                </span>
                              ))}
                            </div>
                            {gaps.length > 0 ? (
                              <div className="mt-1 text-xs text-red-700">
                                {t(`${key}.gaps`, {
                                  levels: gaps
                                    .map(({ levelId }) => levelLabel(levelId))
                                    .join(', '),
                                })}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-right">
                            {row.meanDeviation === null
                              ? '–'
                              : formatBias(row.meanDeviation)}
                            <div className="text-xs text-gray-500">
                              {t(`${key}.estimated`, {
                                count: row.estimatedCount,
                              })}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t(`${key}.legend`)}</p>
      </div>
    </details>
  )
}

export default AdaptiveDryRunSubcompetences

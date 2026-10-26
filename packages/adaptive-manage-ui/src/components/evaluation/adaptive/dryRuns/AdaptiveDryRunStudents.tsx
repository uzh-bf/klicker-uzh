import { useTranslations } from 'next-intl'
import { Fragment, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type DryRunStudent,
  type DryRunWorkspace,
  toDryRunStopReason,
} from './adaptiveDryRunTypes'

// Per simulated student: true and reported levels; a row opens its answers.
function AdaptiveDryRunStudents({
  students,
  workspace,
}: {
  students: DryRunStudent[]
  workspace: DryRunWorkspace
}) {
  const t = useTranslations()
  const [open, setOpen] = useState<number | null>(null)
  const levels = new Map(workspace.levels.map((level) => [level.id, level]))
  const items = new Map(workspace.items.map((item) => [item.poolItemId, item]))
  const competenceName = (nodeId: number) =>
    workspace.competences.find((competence) => competence.nodeId === nodeId)
      ?.name ?? `#${nodeId}`
  const label = (id: number | null) =>
    id === null ? '–' : (levels.get(id)?.label ?? '–')

  return (
    <div
      className="max-h-[32rem] overflow-auto rounded border border-gray-200"
      data-cy="adaptive-dry-run-students"
    >
      <table className="w-full min-w-[48rem] text-left text-sm">
        <thead className="sticky top-0 bg-gray-50 text-xs text-gray-700">
          <tr>
            <th className="px-3 py-2">
              {t('manage.evaluation.adaptive.dryRuns.students.student')}
            </th>
            <th className="px-3 py-2">
              {t('manage.evaluation.adaptive.dryRuns.students.competences')}
            </th>
            <th className="px-3 py-2">
              {t('manage.evaluation.adaptive.dryRuns.students.overall')}
            </th>
            <th className="px-3 py-2 text-right">
              {t('manage.evaluation.adaptive.dryRuns.students.questions')}
            </th>
            <th className="px-3 py-2 text-right">
              {t('manage.evaluation.adaptive.dryRuns.students.flipped')}
            </th>
            <th className="px-3 py-2">
              {t('manage.evaluation.adaptive.dryRuns.students.stop')}
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => {
            const isOpen = open === student.index
            return (
              <Fragment key={student.index}>
                <tr
                  className="cursor-pointer border-t border-gray-100 align-top hover:bg-gray-50"
                  onClick={() => setOpen(isOpen ? null : student.index)}
                  aria-expanded={isOpen}
                  data-cy={`adaptive-dry-run-student-${student.index}`}
                >
                  <td className="px-3 py-2 font-mono text-xs">
                    {`#${student.index}`}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {student.competences.map((competence) => {
                      const trueLevelId =
                        student.trueLevels.find(
                          ({ nodeId }) => nodeId === competence.nodeId
                        )?.levelId ?? null
                      const difference =
                        competence.levelId === null || trueLevelId === null
                          ? null
                          : levels.get(competence.levelId)!.order -
                            levels.get(trueLevelId)!.order
                      return (
                        <div key={competence.nodeId}>
                          <span className="font-medium">
                            {competenceName(competence.nodeId)}
                          </span>
                          {`: ${label(trueLevelId)} → `}
                          <span
                            className={twMerge(
                              difference === 0
                                ? 'text-green-700'
                                : difference !== null &&
                                    Math.abs(difference) === 1
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            )}
                          >
                            {label(competence.levelId)}
                          </span>
                          {competence.classified
                            ? ''
                            : ` (${t('manage.evaluation.adaptive.dryRuns.students.notDetermined')})`}
                        </div>
                      )
                    })}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {label(student.overall.levelId)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {student.questionCount}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {student.answers.filter(({ flipped }) => flipped).length}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {t(
                      `manage.evaluation.adaptive.dryRuns.stopReasons.${toDryRunStopReason(student.stopReason)}`
                    )}
                  </td>
                </tr>
                {isOpen ? (
                  <tr>
                    <td colSpan={6} className="bg-gray-50 px-3 py-2">
                      <ol className="space-y-0.5 text-xs">
                        {student.answers.map((answer, index) => {
                          const item = items.get(answer.poolItemId)
                          return (
                            <li
                              key={answer.poolItemId}
                              className="flex flex-wrap gap-2"
                            >
                              <span className="w-6 shrink-0 text-right text-gray-500 tabular-nums">
                                {index + 1}
                              </span>
                              <span className="w-24 shrink-0 truncate font-medium">
                                {label(answer.levelId)}
                              </span>
                              <span
                                className={
                                  answer.correct
                                    ? 'w-16 shrink-0 text-green-700'
                                    : 'w-16 shrink-0 text-red-700'
                                }
                              >
                                {answer.correct
                                  ? t(
                                      'manage.evaluation.adaptive.dryRuns.students.correct'
                                    )
                                  : t(
                                      'manage.evaluation.adaptive.dryRuns.students.incorrect'
                                    )}
                              </span>
                              <span className="w-20 shrink-0 text-amber-700">
                                {answer.flipped
                                  ? t(
                                      'manage.evaluation.adaptive.dryRuns.students.flippedAnswer'
                                    )
                                  : ''}
                              </span>
                              <span className="text-gray-700">
                                {item
                                  ? `${item.elementName} · ${item.nodeNames.join(' › ')}`
                                  : `#${answer.poolItemId}`}
                              </span>
                            </li>
                          )
                        })}
                      </ol>
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default AdaptiveDryRunStudents

import { useTranslations } from 'next-intl'
import { Fragment, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  type DryRunCompetenceTrace,
  traceDryRunCompetence,
} from './adaptiveDryRunExplain'
import { type DryRunHint, dryRunHint } from './adaptiveDryRunHints'
import {
  type DryRunStudent,
  type DryRunWorkspace,
  toDryRunStopReason,
} from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.students'

const arrow = (change: string) =>
  change === 'UP' ? '↑ ' : change === 'DOWN' ? '↓ ' : ''

const differenceTone = (difference: number | null) =>
  difference === 0
    ? 'text-green-700'
    : difference !== null && Math.abs(difference) === 1
      ? 'text-amber-700'
      : 'text-red-700'

// One competence of one simulated student: what was asked, which answers the
// true level predicts, and how the level moved answer by answer.
function CompetenceTrace({
  name,
  trace,
  hint,
  workspace,
}: {
  name: string
  trace: DryRunCompetenceTrace
  hint: DryRunHint
  workspace: DryRunWorkspace
}) {
  const t = useTranslations()
  const items = new Map(workspace.items.map((item) => [item.poolItemId, item]))
  const label = (id: number | null) =>
    id === null
      ? '–'
      : (workspace.levels.find((level) => level.id === id)?.label ?? '–')
  const values = {
    count: trace.steps.length,
    highest: label(trace.highestCorrectLevelId),
    lowest: label(trace.lowestWrongLevelId),
    result: label(trace.reportedLevelId),
  }

  return (
    <div
      className="rounded border border-gray-200 bg-white p-3"
      data-cy={`adaptive-dry-run-trace-${trace.nodeId}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h6 className="font-semibold">{name}</h6>
        <span className="text-xs text-gray-600">
          {trace.classified
            ? t(`${KEY}.determined`)
            : t(`${KEY}.notDetermined`)}
        </span>
      </div>
      <p className="mt-1 text-sm">
        {t.rich(`${KEY}.result`, {
          trueLevel: label(trace.trueLevelId),
          result: label(trace.reportedLevelId),
          strong: (chunks) => <strong>{chunks}</strong>,
        })}{' '}
        <span
          className={twMerge('font-medium', differenceTone(trace.difference))}
        >
          {trace.difference === null
            ? ''
            : trace.difference === 0
              ? t(`${KEY}.matches`)
              : t(trace.difference > 0 ? `${KEY}.tooHigh` : `${KEY}.tooLow`, {
                  count: Math.abs(trace.difference),
                })}
        </span>
      </p>
      {hint.position !== null ? (
        <p className="mt-1 text-sm" data-cy="adaptive-dry-run-trace-hint">
          <span className="text-gray-600">
            {t(`${KEY}.position`, {
              position: Math.round(hint.position * 100),
              level: label(trace.reportedLevelId),
            })}
          </span>
          {hint.nextLevelId !== null ? (
            <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 font-medium text-blue-900">
              {t(`${KEY}.withinReach`, { level: label(hint.nextLevelId) })}
            </span>
          ) : null}
        </p>
      ) : null}
      <p className="mt-1 text-sm text-gray-700">
        {t(`${KEY}.patterns.${trace.pattern}`, values)}
        {trace.unexpectedCount > 0
          ? ` ${t(`${KEY}.unexpectedNote`, { count: trace.unexpectedCount })}`
          : ''}
      </p>

      {trace.steps.length > 0 ? (
        <table className="mt-2 w-full text-left text-xs tabular-nums">
          <thead className="text-gray-600">
            <tr>
              <th className="py-1 pr-2">#</th>
              <th className="py-1 pr-2">{t(`${KEY}.questionLevel`)}</th>
              <th className="py-1 pr-2">{t(`${KEY}.expected`)}</th>
              <th className="py-1 pr-2">{t(`${KEY}.answer`)}</th>
              <th className="py-1 pr-2">{t(`${KEY}.levelAfter`)}</th>
              <th className="py-1 pr-2">{t(`${KEY}.subcompetence`)}</th>
              <th className="py-1">{t(`${KEY}.question`)}</th>
            </tr>
          </thead>
          <tbody>
            {trace.steps.map((step) => {
              const item = items.get(step.poolItemId)
              return (
                <tr
                  key={step.poolItemId}
                  className={twMerge(
                    'border-t border-gray-100',
                    step.flipped && 'bg-amber-50'
                  )}
                >
                  <td className="py-1 pr-2 text-gray-500">{step.order}</td>
                  <td className="py-1 pr-2 font-medium">
                    {label(step.levelId)}
                  </td>
                  <td className="py-1 pr-2 text-gray-600">
                    {step.expectedCorrect
                      ? t(`${KEY}.correct`)
                      : t(`${KEY}.incorrect`)}
                  </td>
                  <td className="whitespace-nowrap py-1 pr-2">
                    <span
                      className={
                        step.correct ? 'text-green-700' : 'text-red-700'
                      }
                    >
                      {step.correct
                        ? `✓ ${t(`${KEY}.correct`)}`
                        : `✗ ${t(`${KEY}.incorrect`)}`}
                    </span>
                    {step.flipped ? (
                      <span className="ml-1 rounded bg-amber-100 px-1 text-amber-900">
                        {t(`${KEY}.unexpected`)}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-1 pr-2">
                    {step.after?.levelId != null ? (
                      <span
                        className={twMerge(
                          step.levelChange === 'UP' ||
                            step.levelChange === 'DOWN'
                            ? 'font-semibold'
                            : 'text-gray-700'
                        )}
                      >
                        {arrow(step.levelChange)}
                        {label(step.after.levelId)}
                      </span>
                    ) : step.after?.roughLevelId != null ? (
                      <span
                        className="text-gray-500 italic"
                        title={t(`${KEY}.roughHint`)}
                      >
                        {arrow(step.levelChange)}≈{' '}
                        {label(step.after.roughLevelId)}
                      </span>
                    ) : (
                      <span className="text-gray-500">–</span>
                    )}
                  </td>
                  <td className="py-1 pr-2 text-gray-700">
                    {item?.nodeNames.at(-1) ?? '–'}
                  </td>
                  <td
                    className="max-w-[14rem] truncate py-1 text-gray-600"
                    title={item?.elementName}
                  >
                    {item?.elementName ?? `#${step.poolItemId}`}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      ) : null}
    </div>
  )
}

// Per simulated student: true and reported level per competence; a row opens
// the reasoning behind each result.
function AdaptiveDryRunStudents({
  students,
  workspace,
  threshold,
}: {
  students: DryRunStudent[]
  workspace: DryRunWorkspace
  /** "Next level within reach" from this position in the band (0-1). */
  threshold: number
}) {
  const t = useTranslations()
  const [open, setOpen] = useState<number | null>(null)
  const rootOfItem = new Map(
    workspace.items.map(({ poolItemId, rootId }) => [poolItemId, rootId])
  )
  const label = (id: number | null) =>
    id === null
      ? '–'
      : (workspace.levels.find((level) => level.id === id)?.label ?? '–')
  const traces = (student: DryRunStudent) =>
    workspace.competences.map((competence) => ({
      name: competence.name,
      hint: dryRunHint(
        student.competences.find(
          ({ nodeId }) => nodeId === competence.nodeId
        ) ?? { theta: null, levelId: null },
        workspace,
        threshold
      ),
      trace: traceDryRunCompetence({
        student,
        nodeId: competence.nodeId,
        levels: workspace.levels,
        rootOfItem: (id) => rootOfItem.get(id),
      }),
    }))

  return (
    <div data-cy="adaptive-dry-run-students">
      <p className="mb-2 text-xs text-gray-600">{t(`${KEY}.hint`)}</p>
      <div className="max-h-[40rem] overflow-auto rounded border border-gray-200">
        <table className="w-full min-w-[52rem] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-gray-50 text-xs text-gray-700">
            <tr>
              <th className="px-3 py-2">{t(`${KEY}.student`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.competences`)}</th>
              <th className="px-3 py-2">{t(`${KEY}.overall`)}</th>
              <th className="px-3 py-2 text-right">{t(`${KEY}.questions`)}</th>
              <th className="px-3 py-2 text-right">
                {t(`${KEY}.unexpectedAnswers`)}
              </th>
              <th className="px-3 py-2">{t(`${KEY}.stop`)}</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student) => {
              const isOpen = open === student.index
              const rows = traces(student)
              return (
                <Fragment key={student.index}>
                  <tr
                    className={twMerge(
                      'cursor-pointer border-t border-gray-100 align-top hover:bg-gray-50',
                      isOpen && 'bg-gray-50'
                    )}
                    onClick={() => setOpen(isOpen ? null : student.index)}
                    aria-expanded={isOpen}
                    data-cy={`adaptive-dry-run-student-${student.index}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {isOpen ? '▾ ' : '▸ '}
                      {`#${student.index}`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {rows.map(({ name, trace, hint }) => (
                        <div key={trace.nodeId}>
                          <span className="font-medium">{name}</span>
                          {`: ${label(trace.trueLevelId)} → `}
                          <span className={differenceTone(trace.difference)}>
                            {label(trace.reportedLevelId)}
                          </span>
                          {hint.position !== null ? (
                            <span className="ml-1 text-gray-500">
                              {`(${Math.round(hint.position * 100)}%)`}
                            </span>
                          ) : null}
                          {hint.nextLevelId !== null ? (
                            <span className="ml-1 rounded bg-blue-100 px-1 text-blue-900">
                              {`→ ${label(hint.nextLevelId)}`}
                            </span>
                          ) : null}
                          {trace.difference !== 0 &&
                          (trace.pattern === 'ALL_CORRECT' ||
                            trace.pattern === 'ALL_WRONG') ? (
                            <span className="ml-1 rounded bg-gray-100 px-1 text-gray-700">
                              {t(`${KEY}.tags.${trace.pattern}`)}
                            </span>
                          ) : null}
                        </div>
                      ))}
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
                      <td colSpan={6} className="bg-gray-50 px-3 py-3">
                        <div className="grid gap-3 lg:grid-cols-2">
                          {rows.map(({ name, trace, hint }) => (
                            <CompetenceTrace
                              key={trace.nodeId}
                              name={name}
                              trace={trace}
                              hint={hint}
                              workspace={workspace}
                            />
                          ))}
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

export default AdaptiveDryRunStudents

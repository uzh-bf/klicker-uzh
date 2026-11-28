import { useTranslations } from 'next-intl'
import { Fragment } from 'react'
import { twMerge } from 'tailwind-merge'
import AdaptiveDryRunStudentLevels from './AdaptiveDryRunStudentLevels'
import {
  type DryRunLevelSplit,
  dryRunChartScale,
  dryRunLevelSplit,
  dryRunUnexpectedAnswers,
} from './adaptiveDryRunChart'
import {
  type DryRunCompetenceTrace,
  traceDryRunCompetence,
} from './adaptiveDryRunExplain'
import {
  type DryRun,
  type DryRunStudent,
  type DryRunWorkspace,
  toDryRunStopReason,
} from './adaptiveDryRunTypes'

const KEY = 'manage.evaluation.adaptive.dryRuns.students'
// A result this many levels or more off, with fewer than a quarter of its
// questions within one level of the true level, was barely measured there.
const FAR_FROM_TRUE_LEVEL = 2
const NEAR_SHARE = 0.25

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
  split,
  workspace,
}: {
  name: string
  trace: DryRunCompetenceTrace
  split: DryRunLevelSplit | null
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
  const orderOf = (id: number | null) =>
    workspace.levels.find((level) => level.id === id)?.order ?? null
  // A clear boundary bounds the estimate between the two questions; where it
  // lands in between decides whether the result is at, below or above it.
  const reportedOrder = orderOf(trace.reportedLevelId) ?? 0
  const highestOrder = orderOf(trace.highestCorrectLevelId) ?? 0
  const pattern =
    trace.pattern !== 'CLEAR_BOUNDARY'
      ? trace.pattern
      : reportedOrder < highestOrder
        ? 'CLEAR_BOUNDARYBELOW'
        : reportedOrder > highestOrder
          ? 'CLEAR_BOUNDARYABOVE'
          : 'CLEAR_BOUNDARY'
  const unexpected = trace.steps.filter(
    ({ correct, expectedCorrect }) => correct !== expectedCorrect
  ).length

  return (
    <div
      className="rounded border border-gray-200 bg-white p-3"
      data-cy={`adaptive-dry-run-trace-${trace.nodeId}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h6 className="font-semibold">{name}</h6>
        <span
          className="text-xs text-gray-600"
          title={t(
            trace.classified
              ? `${KEY}.determinedHint`
              : `${KEY}.notDeterminedHint`
          )}
        >
          {trace.classified
            ? t(`${KEY}.determined`)
            : t(`${KEY}.notDetermined`)}
        </span>
      </div>
      <p className="mt-1 text-sm">
        {t.rich(`${KEY}.explain.result`, {
          result: label(trace.reportedLevelId),
          strong: (chunks) => <strong>{chunks}</strong>,
        })}{' '}
        <span
          className={twMerge('font-medium', differenceTone(trace.difference))}
        >
          {trace.difference === null
            ? ''
            : trace.difference === 0
              ? t(`${KEY}.explain.correct`)
              : t(
                  trace.difference > 0
                    ? `${KEY}.explain.tooHigh`
                    : `${KEY}.explain.tooLow`,
                  { count: Math.abs(trace.difference) }
                )}
        </span>{' '}
        <span className="text-gray-600">
          {t(`${KEY}.explain.trueLevel`, { level: label(trace.trueLevelId) })}
        </span>
      </p>
      <p className="mt-1 text-sm text-gray-700">
        <strong>{t(`${KEY}.explain.why`)}</strong>{' '}
        {t(`${KEY}.patterns.${pattern}`, values)}
        {unexpected > 0
          ? ` ${t(`${KEY}.unexpectedNote`, { count: unexpected })}`
          : ''}
        {trace.difference !== null &&
        Math.abs(trace.difference) >= FAR_FROM_TRUE_LEVEL &&
        trace.nearCount < trace.steps.length * NEAR_SHARE
          ? ` ${t(`${KEY}.farNote`, {
              start: trace.startsAfterOthers ? 'previous' : 'other',
              first: label(trace.steps[0]?.levelId ?? null),
              near: trace.nearCount,
              count: trace.steps.length,
              trueLevel: label(trace.trueLevelId),
            })}`
          : ''}
      </p>
      {split ? (
        <p
          className="mt-1 text-sm text-gray-700"
          data-cy="adaptive-dry-run-trace-split"
        >
          <strong>{t(`${KEY}.explain.howSure`)}</strong>{' '}
          {[
            t(`${KEY}.explain.splitExactly`, {
              probability: split.exactly,
              level: label(trace.reportedLevelId),
            }),
            split.aboveLevelId !== null
              ? t(`${KEY}.explain.splitHigher`, {
                  probability: split.higher,
                  level: label(split.aboveLevelId),
                })
              : null,
            split.belowLevelId !== null
              ? t(`${KEY}.explain.splitLower`, {
                  probability: split.lower,
                  level: label(split.belowLevelId),
                })
              : null,
          ]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}

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
                    {step.bound ? (
                      <span
                        className="text-gray-500 italic"
                        title={t(`${KEY}.boundHint`)}
                      >
                        {arrow(step.levelChange)}
                        {t(
                          step.bound.kind === 'BELOW'
                            ? `${KEY}.levelBelow`
                            : `${KEY}.levelAbove`,
                          { level: label(step.bound.levelId) }
                        )}
                      </span>
                    ) : step.after?.levelId != null ? (
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
  run,
  students,
  workspace,
  open,
  onOpen,
}: {
  run: DryRun
  students: DryRunStudent[]
  workspace: DryRunWorkspace
  /** The expanded student, also opened from the chart. */
  open: number | null
  onOpen: (index: number | null) => void
}) {
  const t = useTranslations()
  const rootOfItem = new Map(
    workspace.items.map(({ poolItemId, rootId }) => [poolItemId, rootId])
  )
  const label = (id: number | null) =>
    id === null
      ? '–'
      : (workspace.levels.find((level) => level.id === id)?.label ?? '–')
  const scale = dryRunChartScale(workspace, run)
  const traces = (student: DryRunStudent) =>
    workspace.competences.map((competence) => ({
      name: competence.name,
      split: scale
        ? dryRunLevelSplit(
            scale,
            student.competences.find(
              ({ nodeId }) => nodeId === competence.nodeId
            ) ?? { theta: null, standardError: null, levelId: null }
          )
        : null,
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
                    onClick={() => onOpen(isOpen ? null : student.index)}
                    aria-expanded={isOpen}
                    data-cy={`adaptive-dry-run-student-${student.index}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {isOpen ? '▾ ' : '▸ '}
                      {`#${student.index}`}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {rows.map(({ name, trace, split }) => (
                        <div key={trace.nodeId}>
                          <span className="font-medium">{name}</span>
                          {`: ${label(trace.trueLevelId)} → `}
                          <span className={differenceTone(trace.difference)}>
                            {label(trace.reportedLevelId)}
                          </span>
                          {split ? (
                            <span
                              className="ml-1 text-gray-500"
                              title={t(`${KEY}.rowHint`)}
                            >
                              {`${split.exactly}%`}
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
                      {dryRunUnexpectedAnswers(
                        student,
                        workspace.levels,
                        (id) => rootOfItem.get(id)
                      )}
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
                        <div className="mb-3 rounded border border-gray-200 bg-white p-3">
                          <AdaptiveDryRunStudentLevels
                            run={run}
                            student={student}
                            workspace={workspace}
                          />
                        </div>
                        <div className="grid gap-3 lg:grid-cols-2">
                          {rows.map(({ name, trace, split }) => (
                            <CompetenceTrace
                              key={trace.nodeId}
                              name={name}
                              trace={trace}
                              split={split}
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

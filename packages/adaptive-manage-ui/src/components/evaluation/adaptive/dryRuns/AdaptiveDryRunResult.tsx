import { useLazyQuery } from '@apollo/client'
import { faDownload, faRotateRight } from '@fortawesome/free-solid-svg-icons'
import { QAdaptivePracticeQuizDryRunDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button, Select } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { downloadCsv } from '../attemptDiagnostics/adaptiveAttemptCsv'
import AdaptiveDryRunAgreement from './AdaptiveDryRunAgreement'
import AdaptiveDryRunConfusion from './AdaptiveDryRunConfusion'
import AdaptiveDryRunMetrics, { formatBias } from './AdaptiveDryRunMetrics'
import AdaptiveDryRunStudents from './AdaptiveDryRunStudents'
import AdaptiveDryRunTrueVsReported from './AdaptiveDryRunTrueVsReported'
import {
  type DryRunLevelsSelection,
  dryRunAgreement,
  dryRunChartScale,
  dryRunConfusion,
  dryRunOverallConfusion,
} from './adaptiveDryRunChart'
import {
  buildDryRunAnswersCsv,
  buildDryRunStudentsCsv,
} from './adaptiveDryRunCsv'
import {
  confidencePercent,
  type DryRun,
  type DryRunStudent,
  type DryRunWorkspace,
  dryRunWorkspaceOf,
  percent,
  toDryRunStopReason,
} from './adaptiveDryRunTypes'

export function useDryRunSettingsText() {
  const t = useTranslations()
  return (run: DryRun) => {
    const settings = run.effectiveSettings
    const confidence = confidencePercent(settings.classificationZ)
    return t('manage.evaluation.adaptive.dryRuns.result.settings', {
      cap: settings.totalQuestionCap,
      precision: String(settings.classificationToleranceBands),
      reachedFrom: Math.round((settings.levelReachedFrom ?? 0) * 100),
      confidence: confidence ?? `z ${settings.classificationZ}`,
      minPerLeaf: settings.minQuestionsPerLeaf,
    })
  }
}

const R = 'manage.evaluation.adaptive.dryRuns.result'
const TABS = ['OVERVIEW', 'STUDENTS', 'QUESTIONS'] as const
type Tab = (typeof TABS)[number]
const TAB_LABEL = {
  OVERVIEW: `${R}.tabOverview`,
  STUDENTS: `${R}.tabStudents`,
  QUESTIONS: `${R}.tabQuestions`,
} as const

// One run: the headline numbers first, the details one tab away.
function AdaptiveDryRunResult({
  practiceQuizId,
  run,
  workspace: currentWorkspace,
  onUseSeed,
}: {
  practiceQuizId: string
  run: DryRun
  workspace: DryRunWorkspace
  onUseSeed: (seed: string) => void
}) {
  const workspace = dryRunWorkspaceOf(currentWorkspace, run)
  const t = useTranslations()
  const formatter = useFormatter()
  const settingsText = useDryRunSettingsText()
  const [tab, setTab] = useState<Tab>('OVERVIEW')
  const [openStudent, setOpenStudent] = useState<number | null>(null)
  const [levelsView, setLevelsView] = useState<'CHART' | 'TABLE'>('CHART')
  // Overall level, all competences pooled or one competence, for the chart
  // and the table alike.
  const [levels, setLevels] = useState<DryRunLevelsSelection>('OVERALL')
  const scale = dryRunChartScale(workspace, run)
  // A point in the chart opens its student in the students tab.
  const selectStudent = (index: number) => {
    setTab('STUDENTS')
    setOpenStudent(index)
    setTimeout(
      () =>
        document
          .querySelector(`[data-cy="adaptive-dry-run-student-${index}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
      50
    )
  }
  const [loadRun, detail] = useLazyQuery(QAdaptivePracticeQuizDryRunDocument, {
    fetchPolicy: 'cache-first',
  })
  const students: DryRunStudent[] | null =
    run.students ??
    ((detail.data?.adaptivePracticeQuizDryRun?.id === run.id
      ? detail.data.adaptivePracticeQuizDryRun.students
      : null) as DryRunStudent[] | null)
  const ensureStudents = async () => {
    if (students) return students
    const result = await loadRun({ variables: { practiceQuizId, id: run.id } })
    return (result.data?.adaptivePracticeQuizDryRun?.students ?? null) as
      | DryRunStudent[]
      | null
  }

  // True × reported counts of the selection, shared by chart and table.
  const levelsConfusion =
    levels === 'POOLED'
      ? run.summary.confusion
      : !students
        ? null
        : levels === 'OVERALL'
          ? scale && dryRunOverallConfusion(students, scale)
          : dryRunConfusion(students, levels)
  // The chart needs the students; saved runs load them on open.
  const hasStudents = students !== null
  useEffect(() => {
    if (!hasStudents)
      void loadRun({ variables: { practiceQuizId, id: run.id } })
  }, [hasStudents, loadRun, practiceQuizId, run.id])

  const { summary } = run
  const levelLabel = (id: number) =>
    workspace.levels.find((level) => level.id === id)?.label ?? `#${id}`
  const trueLevelsText =
    run.spec.trueLevels.kind === 'FIXED'
      ? levelLabel(run.spec.trueLevels.levelId)
      : `${levelLabel(run.spec.trueLevels.fromLevelId)}–${levelLabel(run.spec.trueLevels.toLevelId)}`
  const maxStopCount = Math.max(1, ...summary.stopReasons.map((s) => s.count))
  const items = new Map(workspace.items.map((item) => [item.poolItemId, item]))
  const competenceName = (nodeId: number) =>
    workspace.competences.find((competence) => competence.nodeId === nodeId)
      ?.name ?? `#${nodeId}`

  return (
    <div
      className="rounded border border-gray-200"
      data-cy="adaptive-dry-run-result"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 p-4 pb-3">
        <div className="space-y-0.5">
          <h4 className="font-semibold">
            {t(`${R}.title`, { number: run.number })}
          </h4>
          <p className="text-xs text-gray-600">
            {t(`${R}.meta`, {
              students: run.spec.students,
              levels: trueLevelsText,
              noise: Math.round(run.spec.noiseProbability * 100),
              realistic: run.spec.answerModel === 'REALISTIC' ? 'yes' : 'no',
              competences: t(
                `manage.evaluation.adaptive.dryRuns.form.${run.spec.competences}`
              ),
              date: formatter.dateTime(new Date(run.createdAt), {
                dateStyle: 'short',
                timeStyle: 'short',
              }),
              seconds: (run.durationMs / 1000).toFixed(1),
            })}
          </p>
          <p className="text-xs text-gray-600">{settingsText(run)}</p>
          {run.publicationId !== workspace.publicationId ? (
            <p className="text-xs text-amber-700">
              {t(`${R}.olderPublication`)}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="flex items-center gap-2 rounded border border-gray-200 bg-gray-50 py-1 pl-2 pr-1 text-xs"
            data-cy="adaptive-dry-run-seed-used"
          >
            <span className="text-gray-600">{t(`${R}.seed`)}</span>
            <code
              className="max-w-40 truncate font-mono text-gray-900"
              title={run.spec.seed}
            >
              {run.spec.seed}
            </code>
            <span title={t(`${R}.useSeedHint`)}>
              <Button
                basic
                className={{
                  root: 'rounded px-2 py-0.5 text-primary-100 hover:bg-primary-20',
                }}
                onClick={() => onUseSeed(run.spec.seed)}
                data={{ cy: 'adaptive-dry-run-use-seed' }}
              >
                <Button.Icon icon={faRotateRight} />
                <Button.Label>{t(`${R}.useSeed`)}</Button.Label>
              </Button>
            </span>
          </div>
          <Button
            onClick={async () => {
              const rows = await ensureStudents()
              if (!rows) return
              downloadCsv(
                `adaptive-dry-run-${run.number}-students.csv`,
                buildDryRunStudentsCsv(run, rows, workspace)
              )
              downloadCsv(
                `adaptive-dry-run-${run.number}-answers.csv`,
                buildDryRunAnswersCsv(run, rows, workspace)
              )
            }}
            data={{ cy: 'adaptive-dry-run-export' }}
          >
            <Button.Icon icon={faDownload} />
            <Button.Label>{t(`${R}.export`)}</Button.Label>
          </Button>
        </div>
      </div>

      <div
        role="tablist"
        className="flex gap-1 overflow-x-auto border-b border-gray-200 px-4"
      >
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={twMerge(
              '-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm',
              tab === value
                ? 'border-primary-100 font-semibold text-primary-100'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
            data-cy={`adaptive-dry-run-tab-${value.toLowerCase()}`}
          >
            {t(TAB_LABEL[value])}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-4" role="tabpanel">
        {tab === 'OVERVIEW' ? (
          <>
            <AdaptiveDryRunMetrics summary={summary} />

            {summary.competences.length > 1 ? (
              <table className="w-full text-left text-sm tabular-nums">
                <thead className="text-xs text-gray-600">
                  <tr>
                    <th className="py-1 pr-3">{t(`${R}.competence`)}</th>
                    <th className="py-1 pr-3 text-right">{t(`${R}.exact`)}</th>
                    <th className="py-1 pr-3 text-right">
                      {t(`${R}.withinOne`)}
                    </th>
                    <th className="py-1 pr-3 text-right">{t(`${R}.bias`)}</th>
                    <th className="py-1 text-right">{t(`${R}.determined`)}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.competences.map((competence) => (
                    <tr
                      key={competence.nodeId}
                      className="border-t border-gray-100"
                    >
                      <td className="py-1 pr-3">
                        {competenceName(competence.nodeId)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {percent(competence.exactShare)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {percent(competence.withinOneShare)}
                      </td>
                      <td className="py-1 pr-3 text-right">
                        {formatBias(competence.bias)}
                      </td>
                      <td className="py-1 text-right">
                        {percent(competence.determinedShare)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <div className="space-y-2" data-cy="adaptive-dry-run-levels">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <fieldset className="inline-flex rounded border border-gray-300 text-xs">
                  <legend className="sr-only">{t(`${R}.levelsView`)}</legend>
                  {(['CHART', 'TABLE'] as const).map((view) => (
                    <button
                      key={view}
                      type="button"
                      aria-pressed={levelsView === view}
                      onClick={() => setLevelsView(view)}
                      className={twMerge(
                        'px-3 py-1 first:rounded-l last:rounded-r',
                        levelsView === view
                          ? 'bg-primary-100 text-white'
                          : 'bg-white text-gray-700 hover:bg-gray-50'
                      )}
                      data-cy={`adaptive-dry-run-levels-${view.toLowerCase()}`}
                    >
                      {t(`${R}.levelsView${view}`)}
                    </button>
                  ))}
                </fieldset>
                <Select
                  value={String(levels)}
                  onChange={(value) =>
                    setLevels(
                      value === 'OVERALL' || value === 'POOLED'
                        ? value
                        : Number(value)
                    )
                  }
                  items={[
                    {
                      value: 'OVERALL',
                      label: t(
                        'manage.evaluation.adaptive.dryRuns.chart.overall'
                      ),
                    },
                    {
                      value: 'POOLED',
                      label: t(
                        'manage.evaluation.adaptive.dryRuns.chart.pooled'
                      ),
                    },
                    ...workspace.competences.map((competence) => ({
                      value: String(competence.nodeId),
                      label: competence.name,
                    })),
                  ]}
                  className={{ trigger: 'w-56' }}
                  data={{ cy: 'adaptive-dry-run-levels-competence' }}
                />
              </div>
              {levelsConfusion ? (
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start">
                  <div className="min-w-0 flex-1">
                    {levelsView === 'CHART' ? (
                      <AdaptiveDryRunTrueVsReported
                        run={run}
                        students={students}
                        workspace={workspace}
                        selection={levels}
                        onSelectStudent={selectStudent}
                      />
                    ) : (
                      <AdaptiveDryRunConfusion
                        confusion={levelsConfusion}
                        levels={workspace.levels}
                      />
                    )}
                  </div>
                  <AdaptiveDryRunAgreement
                    agreement={dryRunAgreement(
                      levelsConfusion,
                      workspace.levels
                    )}
                  />
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {t(
                    students && !scale
                      ? 'manage.evaluation.adaptive.dryRuns.chart.noScale'
                      : 'manage.evaluation.adaptive.dryRuns.chart.loading'
                  )}
                </p>
              )}
            </div>
          </>
        ) : null}

        {tab === 'STUDENTS' ? (
          students ? (
            <AdaptiveDryRunStudents
              run={run}
              students={students}
              workspace={workspace}
              open={openStudent}
              onOpen={setOpenStudent}
            />
          ) : (
            <p className="text-sm text-gray-500">
              {t('manage.evaluation.adaptive.dryRuns.chart.loading')}
            </p>
          )
        ) : null}

        {tab === 'QUESTIONS' ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <div data-cy="adaptive-dry-run-stop-reasons">
              <h5 className="mb-2 text-sm font-semibold">
                {t(`${R}.stopReasons`)}
              </h5>
              <div className="space-y-1 text-xs">
                {summary.stopReasons.map(({ reason, count }) => (
                  <div key={reason} className="flex items-center gap-2">
                    <span className="w-40 shrink-0">
                      {t(
                        `manage.evaluation.adaptive.dryRuns.stopReasons.${toDryRunStopReason(reason)}`
                      )}
                    </span>
                    <div className="h-3 flex-1 rounded bg-gray-100">
                      <div
                        className="h-3 rounded bg-primary-60"
                        style={{ width: `${(count / maxStopCount) * 100}%` }}
                      />
                    </div>
                    <span className="w-8 text-right tabular-nums">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div data-cy="adaptive-dry-run-item-use">
              <h5 className="mb-1 text-sm font-semibold">
                {t(`${R}.itemUse`)}
              </h5>
              <p className="mb-1 text-xs text-gray-600">
                {t(`${R}.itemUseSummary`, {
                  used: summary.itemUse.usedCount,
                  pool: summary.itemUse.poolSize,
                  unused: summary.itemUse.poolSize - summary.itemUse.usedCount,
                  flipped: percent(summary.flippedShare),
                })}
              </p>
              <ol className="space-y-0.5 text-xs">
                {summary.itemUse.top.map(({ poolItemId, count }) => {
                  const item = items.get(poolItemId)
                  return (
                    <li key={poolItemId} className="flex gap-2">
                      <span className="w-10 shrink-0 text-right tabular-nums">
                        {count}×
                      </span>
                      <span className="w-24 shrink-0 truncate font-medium">
                        {item ? levelLabel(item.levelId) : ''}
                      </span>
                      <span className="truncate text-gray-700">
                        {item?.elementName ?? `#${poolItemId}`}
                      </span>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        ) : null}

        <p
          className="font-mono text-[11px] text-gray-400"
          title={run.engineRevision ?? undefined}
        >
          {t(`${R}.engine`, { revision: run.engineRevision ?? '–' })}
        </p>
      </div>
    </div>
  )
}

export default AdaptiveDryRunResult

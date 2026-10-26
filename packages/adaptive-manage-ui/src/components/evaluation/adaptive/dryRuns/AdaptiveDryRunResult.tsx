import { useLazyQuery } from '@apollo/client'
import {
  faDownload,
  faRotateRight,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { QAdaptivePracticeQuizDryRunDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { downloadCsv } from '../attemptDiagnostics/adaptiveAttemptCsv'
import AdaptiveDryRunConfusion from './AdaptiveDryRunConfusion'
import AdaptiveDryRunMetrics, { formatBias } from './AdaptiveDryRunMetrics'
import AdaptiveDryRunStudents from './AdaptiveDryRunStudents'
import AdaptiveDryRunSubcompetences from './AdaptiveDryRunSubcompetences'
import AdaptiveDryRunWithinReach from './AdaptiveDryRunWithinReach'
import {
  buildDryRunAnswersCsv,
  buildDryRunStudentsCsv,
} from './adaptiveDryRunCsv'
import {
  confidencePercent,
  type DryRun,
  type DryRunStudent,
  type DryRunWorkspace,
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
      confidence: confidence ?? `z ${settings.classificationZ}`,
      minPerLeaf: settings.minQuestionsPerLeaf,
    })
  }
}

function AdaptiveDryRunResult({
  practiceQuizId,
  run,
  workspace,
  onSameStudents,
}: {
  practiceQuizId: string
  run: DryRun
  workspace: DryRunWorkspace
  onSameStudents: (run: DryRun) => void
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const settingsText = useDryRunSettingsText()
  const [showStudents, setShowStudents] = useState(false)
  const [threshold, setThreshold] = useState(70)
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

  // The hint numbers need the students; saved runs load them on open.
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
      className="space-y-4 rounded border border-gray-200 p-4"
      data-cy="adaptive-dry-run-result"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 className="font-semibold">
            {t('manage.evaluation.adaptive.dryRuns.result.title', {
              number: run.number,
            })}
          </h4>
          <p className="text-xs text-gray-600">
            {t('manage.evaluation.adaptive.dryRuns.result.meta', {
              students: run.spec.students,
              levels: trueLevelsText,
              noise: Math.round(run.spec.noiseProbability * 100),
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
          <p
            className="font-mono text-xs text-gray-500"
            title={run.engineRevision ?? undefined}
          >
            {t('manage.evaluation.adaptive.dryRuns.result.engine', {
              revision: run.engineRevision ?? '–',
            })}
          </p>
          {run.publicationId !== workspace.publicationId ? (
            <p className="text-xs text-amber-700">
              {t('manage.evaluation.adaptive.dryRuns.result.olderPublication')}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={async () => {
              if (!showStudents) await ensureStudents()
              setShowStudents(!showStudents)
            }}
            loading={detail.loading}
            data={{ cy: 'adaptive-dry-run-show-students' }}
          >
            <Button.Icon icon={faUsers} />
            <Button.Label>
              {showStudents
                ? t('manage.evaluation.adaptive.dryRuns.result.hideStudents')
                : t('manage.evaluation.adaptive.dryRuns.result.showStudents')}
            </Button.Label>
          </Button>
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
            <Button.Label>
              {t('manage.evaluation.adaptive.dryRuns.result.export')}
            </Button.Label>
          </Button>
          <Button
            onClick={() => onSameStudents(run)}
            data={{ cy: 'adaptive-dry-run-same-students' }}
          >
            <Button.Icon icon={faRotateRight} />
            <Button.Label>
              {t('manage.evaluation.adaptive.dryRuns.result.sameStudents')}
            </Button.Label>
          </Button>
        </div>
      </div>

      <AdaptiveDryRunMetrics summary={summary} />

      <AdaptiveDryRunWithinReach
        students={students}
        workspace={workspace}
        threshold={threshold}
        onThresholdChange={setThreshold}
      />

      {summary.competences.length > 1 ? (
        <table className="w-full text-left text-sm tabular-nums">
          <thead className="text-xs text-gray-600">
            <tr>
              <th className="py-1 pr-3">
                {t('manage.evaluation.adaptive.dryRuns.result.competence')}
              </th>
              <th className="py-1 pr-3 text-right">
                {t('manage.evaluation.adaptive.dryRuns.result.exact')}
              </th>
              <th className="py-1 pr-3 text-right">
                {t('manage.evaluation.adaptive.dryRuns.result.withinOne')}
              </th>
              <th className="py-1 pr-3 text-right">
                {t('manage.evaluation.adaptive.dryRuns.result.bias')}
              </th>
              <th className="py-1 text-right">
                {t('manage.evaluation.adaptive.dryRuns.result.determined')}
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.competences.map((competence) => (
              <tr key={competence.nodeId} className="border-t border-gray-100">
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

      {summary.subcompetences && summary.subcompetences.length > 0 ? (
        <AdaptiveDryRunSubcompetences
          rows={summary.subcompetences}
          workspace={workspace}
        />
      ) : null}

      <AdaptiveDryRunConfusion summary={summary} levels={workspace.levels} />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <div data-cy="adaptive-dry-run-stop-reasons">
            <h5 className="mb-2 text-sm font-semibold">
              {t('manage.evaluation.adaptive.dryRuns.result.stopReasons')}
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
        </div>
        <div>
          <div data-cy="adaptive-dry-run-item-use">
            <h5 className="mb-1 text-sm font-semibold">
              {t('manage.evaluation.adaptive.dryRuns.result.itemUse')}
            </h5>
            <p className="mb-1 text-xs text-gray-600">
              {t('manage.evaluation.adaptive.dryRuns.result.itemUseSummary', {
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
      </div>

      {showStudents && students ? (
        <AdaptiveDryRunStudents
          students={students}
          workspace={workspace}
          threshold={threshold / 100}
        />
      ) : null}
    </div>
  )
}

export default AdaptiveDryRunResult

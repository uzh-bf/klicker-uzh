import { useMutation, useQuery } from '@apollo/client'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import {
  MDeleteAdaptivePracticeQuizDryRunDocument,
  MRunAdaptivePracticeQuizDryRunDocument,
  QAdaptivePracticeQuizDryRunsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import AdaptiveDryRunForm, { type DryRunFormValues } from './AdaptiveDryRunForm'
import { formatBias } from './AdaptiveDryRunMetrics'
import AdaptiveDryRunResult, {
  useDryRunSettingsText,
} from './AdaptiveDryRunResult'
import { type DryRun, percent } from './adaptiveDryRunTypes'

const METRICS = [
  ['exact', (run: DryRun) => percent(run.summary.metrics.exactShare)],
  ['withinOne', (run: DryRun) => percent(run.summary.metrics.withinOneShare)],
  ['bias', (run: DryRun) => formatBias(run.summary.metrics.bias)],
  ['questions', (run: DryRun) => run.summary.questions.mean.toFixed(1)],
  ['determined', (run: DryRun) => percent(run.summary.metrics.determinedShare)],
] as const

// Dry runs with simulated students, for testing environments. The server
// returns null unless ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true, and then nothing is
// rendered.
function AdaptiveDryRuns({ practiceQuizId }: { practiceQuizId: string }) {
  const t = useTranslations()
  const formatter = useFormatter()
  const settingsText = useDryRunSettingsText()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [latest, setLatest] = useState<DryRun | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const { data, loading, error, refetch } = useQuery(
    QAdaptivePracticeQuizDryRunsDocument,
    { variables: { practiceQuizId }, fetchPolicy: 'network-only' }
  )
  const [runDryRun, runState] = useMutation(
    MRunAdaptivePracticeQuizDryRunDocument
  )
  const [deleteDryRun] = useMutation(MDeleteAdaptivePracticeQuizDryRunDocument)

  if (loading && !data) return <Loader />
  if (error) return <UserNotification type="error" message={error.message} />
  const workspace = data?.adaptivePracticeQuizDryRuns
  if (!workspace) return null

  const runs = workspace.runs as unknown as DryRun[]
  const selected =
    (latest && latest.id === selectedId ? latest : null) ??
    runs.find((run) => run.id === selectedId) ??
    (latest && runs.some((run) => run.id === latest.id) ? latest : null) ??
    runs[0] ??
    null

  const start = async (values: DryRunFormValues) => {
    const result = await runDryRun({
      variables: { practiceQuizId, ...values },
    })
    const run = result.data?.runAdaptivePracticeQuizDryRun as
      | DryRun
      | null
      | undefined
    if (run) {
      setLatest(run)
      setSelectedId(run.id)
    }
    await refetch()
  }
  const runAgain = (run: DryRun) =>
    start({
      students: run.spec.students,
      noiseProbability: run.spec.noiseProbability,
      fromLevelId:
        run.spec.trueLevels.kind === 'FIXED'
          ? run.spec.trueLevels.levelId
          : run.spec.trueLevels.fromLevelId,
      toLevelId:
        run.spec.trueLevels.kind === 'FIXED'
          ? run.spec.trueLevels.levelId
          : run.spec.trueLevels.toLevelId,
      competences: run.spec.competences,
      seed: run.spec.seed,
      ...run.effectiveSettings,
    })
  const compared = compareIds
    .map((id) => runs.find((run) => run.id === id))
    .filter((run): run is DryRun => Boolean(run))

  return (
    <section
      className="space-y-4 border-t border-gray-200 py-6"
      data-cy="adaptive-dry-runs"
    >
      <div>
        <div className="flex items-center gap-2">
          <H3 className={{ root: 'mb-1' }}>
            {t('manage.evaluation.adaptive.dryRuns.title')}
          </H3>
          <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            {t('manage.evaluation.adaptive.dryRuns.testingOnly')}
          </span>
        </div>
        <p className="max-w-3xl text-sm text-gray-600">
          {t('manage.evaluation.adaptive.dryRuns.description')}
        </p>
      </div>

      {workspace.available ? (
        <AdaptiveDryRunForm
          workspace={workspace}
          loading={runState.loading}
          onRun={start}
        />
      ) : (
        <UserNotification
          type="info"
          message={t('manage.evaluation.adaptive.dryRuns.unavailable')}
        />
      )}
      {runState.error ? (
        <UserNotification type="error" message={runState.error.message} />
      ) : null}

      {selected ? (
        <AdaptiveDryRunResult
          key={selected.id}
          practiceQuizId={practiceQuizId}
          run={selected}
          workspace={workspace}
          onRunAgain={runAgain}
          rerunning={runState.loading}
        />
      ) : null}

      <div data-cy="adaptive-dry-run-list">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="font-semibold">
            {t('manage.evaluation.adaptive.dryRuns.runs.title')}
          </h4>
          <Button
            disabled={compareIds.length !== 2}
            onClick={() => setComparing(!comparing)}
            data={{ cy: 'adaptive-dry-run-compare' }}
          >
            <Button.Label>
              {comparing && compareIds.length === 2
                ? t('manage.evaluation.adaptive.dryRuns.runs.hideCompare')
                : t('manage.evaluation.adaptive.dryRuns.runs.compare')}
            </Button.Label>
          </Button>
        </div>
        {runs.length === 0 ? (
          <p className="text-sm text-gray-600">
            {t('manage.evaluation.adaptive.dryRuns.runs.empty')}
          </p>
        ) : (
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-gray-50 text-xs text-gray-700">
                <tr>
                  <th className="px-3 py-2" />
                  <th className="px-3 py-2">
                    {t('manage.evaluation.adaptive.dryRuns.runs.run')}
                  </th>
                  <th className="px-3 py-2">
                    {t('manage.evaluation.adaptive.dryRuns.runs.settings')}
                  </th>
                  {METRICS.map(([key]) => (
                    <th key={key} className="px-3 py-2 text-right">
                      {t(`manage.evaluation.adaptive.dryRuns.result.${key}`)}
                    </th>
                  ))}
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => {
                  const checked = compareIds.includes(run.id)
                  return (
                    <tr
                      key={run.id}
                      className={twMerge(
                        'cursor-pointer border-t border-gray-100 hover:bg-gray-50',
                        selected?.id === run.id && 'bg-primary-20/30'
                      )}
                      onClick={() => setSelectedId(run.id)}
                      data-cy={`adaptive-dry-run-row-${run.number}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          aria-label={t(
                            'manage.evaluation.adaptive.dryRuns.runs.select',
                            { number: run.number }
                          )}
                          checked={checked}
                          onClick={(event) => event.stopPropagation()}
                          disabled={!checked && compareIds.length >= 2}
                          onChange={() =>
                            setCompareIds(
                              checked
                                ? compareIds.filter((id) => id !== run.id)
                                : [...compareIds, run.id]
                            )
                          }
                        />
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">#{run.number}</div>
                        <div className="text-xs text-gray-500">
                          {formatter.dateTime(new Date(run.createdAt), {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>
                          {t('manage.evaluation.adaptive.dryRuns.runs.spec', {
                            students: run.spec.students,
                            noise: Math.round(run.spec.noiseProbability * 100),
                          })}
                        </div>
                        <div className="text-gray-600">{settingsText(run)}</div>
                      </td>
                      {METRICS.map(([key, value]) => (
                        <td
                          key={key}
                          className="px-3 py-2 text-right tabular-nums"
                        >
                          {value(run)}
                        </td>
                      ))}
                      <td className="px-3 py-2 text-right">
                        <Button
                          basic
                          onClick={async (event) => {
                            event?.stopPropagation()
                            await deleteDryRun({
                              variables: { practiceQuizId, id: run.id },
                            })
                            setCompareIds(
                              compareIds.filter((id) => id !== run.id)
                            )
                            await refetch()
                          }}
                          data={{ cy: `adaptive-dry-run-delete-${run.number}` }}
                        >
                          <Button.Icon icon={faTrash} />
                          <Button.Label className={{ root: 'sr-only' }}>
                            {t(
                              'manage.evaluation.adaptive.dryRuns.runs.delete'
                            )}
                          </Button.Label>
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {comparing && compared.length === 2 ? (
        <div
          className="rounded border border-gray-200 p-4"
          data-cy="adaptive-dry-run-comparison"
        >
          <h4 className="mb-2 font-semibold">
            {t('manage.evaluation.adaptive.dryRuns.runs.compareTitle', {
              first: compared[0]!.number,
              second: compared[1]!.number,
            })}
          </h4>
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-xs text-gray-600">
              <tr>
                <th className="py-1 pr-3" />
                {compared.map((run) => (
                  <th key={run.id} className="py-1 pr-3 text-right">
                    #{run.number}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="py-1 pr-3">
                  {t('manage.evaluation.adaptive.dryRuns.runs.settings')}
                </td>
                {compared.map((run) => (
                  <td key={run.id} className="py-1 pr-3 text-right text-xs">
                    {settingsText(run)}
                  </td>
                ))}
              </tr>
              {METRICS.map(([key, value]) => (
                <tr key={key} className="border-t border-gray-100">
                  <td className="py-1 pr-3">
                    {t(`manage.evaluation.adaptive.dryRuns.result.${key}`)}
                  </td>
                  {compared.map((run) => (
                    <td key={run.id} className="py-1 pr-3 text-right">
                      {value(run)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default AdaptiveDryRuns

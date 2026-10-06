import { useQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { QAdaptivePracticeQuizAttemptDiagnosticDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H4, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { buildAttemptAnswersCsv, downloadCsv } from './adaptiveAttemptCsv'
import { formatAdaptiveLevelRange } from './formatAdaptiveLevelRange'

const COVERAGE_KEYS: Record<
  string,
  'COVERED' | 'OUT_OF_RANGE' | 'SAMPLED_PENDING' | 'NOT_SAMPLED'
> = {
  COVERED: 'COVERED',
  OUT_OF_RANGE: 'OUT_OF_RANGE',
  SAMPLED_PENDING: 'SAMPLED_PENDING',
  NOT_SAMPLED: 'NOT_SAMPLED',
}

const signed = (value: number | null | undefined) =>
  typeof value === 'number' ? (value > 0 ? `+${value}` : String(value)) : '–'
const fixed = (value: number | null | undefined, digits = 2) =>
  typeof value === 'number' ? value.toFixed(digits) : '–'

function AdaptiveAttemptDiagnosticDetail({
  practiceQuizId,
  attemptCode,
}: {
  practiceQuizId: string
  attemptCode: string
}) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(
    QAdaptivePracticeQuizAttemptDiagnosticDocument,
    { variables: { practiceQuizId, attemptCode }, fetchPolicy: 'network-only' }
  )

  if (loading) return <Loader />
  if (error) return <UserNotification type="error" message={error.message} />
  const detail = data?.adaptivePracticeQuizAttemptDiagnostic
  if (!detail) return null

  const replayByOrder = new Map(
    (detail.replay?.answers ?? []).map((answer) => [answer.order, answer])
  )

  return (
    <div
      className="space-y-4"
      data-cy={`adaptive-attempt-detail-${attemptCode}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H4 className={{ root: 'mb-0' }}>
          {t('manage.evaluation.adaptive.attemptDiagnostics.detailTitle', {
            code: attemptCode,
          })}
        </H4>
        <Button
          onClick={() =>
            downloadCsv(
              `adaptive-attempt-${attemptCode}.csv`,
              buildAttemptAnswersCsv(detail)
            )
          }
          data={{ cy: 'adaptive-attempt-export' }}
        >
          <Button.Icon icon={faDownload} />
          <Button.Label>
            {t('manage.evaluation.adaptive.attemptDiagnostics.exportAttempt')}
          </Button.Label>
        </Button>
      </div>

      {detail.replayError ? (
        <UserNotification
          type="warning"
          message={t(
            'manage.evaluation.adaptive.attemptDiagnostics.replayUnavailable'
          )}
        />
      ) : detail.replay && !detail.replay.exact ? (
        <UserNotification
          type="info"
          message={t(
            'manage.evaluation.adaptive.attemptDiagnostics.replayDiffers'
          )}
        />
      ) : null}

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full min-w-[44rem] text-left text-xs">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.node')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.estimate')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.range')}
              </th>
              <th className="px-2 py-1 text-right">
                {t('manage.evaluation.adaptive.attemptDiagnostics.answers')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.status')}
              </th>
            </tr>
          </thead>
          <tbody>
            {[detail.summary.overall, ...detail.nodes].map((node) => (
              <tr
                key={node.nodeId ?? 'overall'}
                className="border-t border-gray-100"
              >
                <td
                  className="px-2 py-1"
                  style={{ paddingLeft: `${0.5 + node.depth * 1}rem` }}
                >
                  <span className={node.depth <= 1 ? 'font-semibold' : ''}>
                    {node.kind === 'OVERALL'
                      ? t(
                          'manage.evaluation.adaptive.attemptDiagnostics.overall'
                        )
                      : node.name}
                  </span>
                  {typeof node.weightShare === 'number' &&
                  node.weightShare < 1 ? (
                    <span className="ml-1 text-gray-500">
                      {`(${Math.round(node.weightShare * 100)}%)`}
                    </span>
                  ) : null}
                </td>
                <td className="px-2 py-1">
                  {node.levelLabel ?? '–'}
                  <span className="ml-1 text-gray-500">
                    {`θ ${fixed(node.theta)} ± ${fixed(node.standardError)}`}
                  </span>
                </td>
                <td className="px-2 py-1">{formatAdaptiveLevelRange(node)}</td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {node.responseCount}
                </td>
                <td className="px-2 py-1">
                  {node.determined
                    ? t(
                        'manage.evaluation.adaptive.attemptDiagnostics.determined'
                      )
                    : node.responseCount === 0
                      ? t(
                          `manage.evaluation.adaptive.attemptDiagnostics.coverage.${COVERAGE_KEYS[node.coverageStatus ?? ''] ?? 'NOT_TESTED'}`
                        )
                      : t(
                          'manage.evaluation.adaptive.attemptDiagnostics.notDetermined'
                        )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded border border-gray-200 bg-white">
        <table className="w-full min-w-[64rem] text-left text-xs tabular-nums">
          <thead className="sticky top-0 bg-gray-50 text-gray-700">
            <tr>
              <th className="px-2 py-1">#</th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.competence')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.element')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.itemLevel')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.result')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.phase')}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.levelBefore')}
              </th>
              <th className="px-2 py-1 text-right">
                {t(
                  'manage.evaluation.adaptive.attemptDiagnostics.distanceBefore'
                )}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.levelAfter')}
              </th>
              <th className="px-2 py-1 text-right">
                {t(
                  'manage.evaluation.adaptive.attemptDiagnostics.distanceFinal'
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {detail.answers.map((answer) => {
              const replay = replayByOrder.get(answer.order)
              const offLevel = Math.abs(replay?.levelDistanceBefore ?? 0) > 3
              return (
                <tr
                  key={answer.order}
                  className={`border-t border-gray-100 align-top ${offLevel ? 'bg-amber-50' : ''}`}
                  data-cy={`adaptive-attempt-answer-${answer.order}`}
                >
                  <td className="px-2 py-1">{answer.order}</td>
                  <td className="px-2 py-1">
                    <div className="font-medium">
                      {answer.competenceName ?? '–'}
                    </div>
                    <div className="text-gray-500">
                      {answer.subcompetenceName}
                    </div>
                  </td>
                  <td className="break-all px-2 py-1">{answer.elementTitle}</td>
                  <td className="px-2 py-1 font-medium">
                    {answer.itemLevelLabel ?? '–'}
                    <span className="ml-1 font-normal text-gray-500">
                      {`b ${fixed(answer.difficulty)}`}
                    </span>
                  </td>
                  <td
                    className={`px-2 py-1 ${answer.correct ? 'text-green-800' : 'text-red-800'}`}
                  >
                    {t(
                      answer.correct
                        ? 'manage.evaluation.adaptive.attemptDiagnostics.correct'
                        : 'manage.evaluation.adaptive.attemptDiagnostics.incorrect'
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {replay
                      ? t(
                          `manage.evaluation.adaptive.attemptDiagnostics.phases.${replay.phase === 'PRECISION' ? 'PRECISION' : 'COVERAGE'}`
                        )
                      : '–'}
                    {replay && !replay.replayMatches ? (
                      <span
                        className="ml-1 text-amber-700"
                        title={t(
                          'manage.evaluation.adaptive.attemptDiagnostics.replayMismatch'
                        )}
                      >
                        ≠
                      </span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1">
                    {replay?.competenceLevelBefore ?? '–'}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {signed(replay?.levelDistanceBefore)}
                  </td>
                  <td className="px-2 py-1">
                    {replay?.competenceLevelAfter ?? '–'}
                    {replay?.competenceLowerLevelAfter ? (
                      <div className="text-gray-500">
                        {formatAdaptiveLevelRange({
                          lowerLevelLabel: replay.competenceLowerLevelAfter,
                          upperLevelLabel: replay.competenceUpperLevelAfter,
                        })}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-2 py-1 text-right">
                    {signed(answer.levelDistance)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-600">
        {t('manage.evaluation.adaptive.attemptDiagnostics.answersHelp')}
      </p>
    </div>
  )
}

export default AdaptiveAttemptDiagnosticDetail

import { useQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { QAdaptivePracticeQuizAttemptDiagnosticDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H4 } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import AdaptiveAttemptReviewForm from './AdaptiveAttemptReviewForm'
import {
  type AdaptiveAttemptSummaryData,
  buildAttemptAnswersCsv,
  downloadCsv,
} from './adaptiveAttemptCsv'
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
const estimate = (
  theta: number | null | undefined,
  standardError: number | null | undefined
) =>
  typeof theta === 'number' ? `${fixed(theta)} ± ${fixed(standardError)}` : '–'

function AdaptiveAttemptDiagnosticDetail({
  practiceQuizId,
  attempt,
  levelLabels,
  onReviewSaved,
}: {
  practiceQuizId: string
  attempt: AdaptiveAttemptSummaryData
  levelLabels: string[]
  onReviewSaved: () => void
}) {
  const t = useTranslations()
  const { data, loading } = useQuery(
    QAdaptivePracticeQuizAttemptDiagnosticDocument,
    {
      variables: { practiceQuizId, attemptCode: attempt.attemptCode },
      fetchPolicy: 'network-only',
    }
  )
  const nodes = data?.adaptivePracticeQuizAttemptDiagnostic?.nodes ?? []

  return (
    <div
      className="space-y-4"
      data-cy={`adaptive-attempt-detail-${attempt.attemptCode}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <H4 className={{ root: 'mb-0' }}>
          {t('manage.evaluation.adaptive.attemptDiagnostics.detailTitle', {
            code: attempt.participantCode,
            number: attempt.attemptNumber,
          })}
        </H4>
        <Button
          onClick={() =>
            downloadCsv(
              `adaptive-answers-${attempt.participantCode}-${attempt.attemptNumber}.csv`,
              buildAttemptAnswersCsv([attempt])
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

      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          {loading && !data ? (
            <Loader />
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="px-2 py-1">
                    {t('manage.evaluation.adaptive.attemptDiagnostics.node')}
                  </th>
                  <th className="px-2 py-1">
                    {t(
                      'manage.evaluation.adaptive.attemptDiagnostics.finalResult'
                    )}
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
                {[attempt.overall, ...nodes].map((node) => (
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
                        {`θ ${estimate(node.theta, node.standardError)}`}
                      </span>
                    </td>
                    <td className="px-2 py-1">
                      {formatAdaptiveLevelRange(node)}
                    </td>
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
          )}
        </div>
        <AdaptiveAttemptReviewForm
          practiceQuizId={practiceQuizId}
          attempt={attempt}
          levelLabels={levelLabels}
          onSaved={onReviewSaved}
        />
      </div>

      {!attempt.estimatesComplete ? (
        <p className="text-xs text-amber-800">
          {t('manage.evaluation.adaptive.attemptDiagnostics.backfill.attempt')}
        </p>
      ) : null}

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
                {t('manage.evaluation.adaptive.attemptDiagnostics.thetaBefore')}
              </th>
              <th className="px-2 py-1 text-right">
                {t(
                  'manage.evaluation.adaptive.attemptDiagnostics.distanceBefore'
                )}
              </th>
              <th className="px-2 py-1">
                {t('manage.evaluation.adaptive.attemptDiagnostics.thetaAfter')}
              </th>
            </tr>
          </thead>
          <tbody>
            {attempt.answers.map((answer) => {
              const offLevel = Math.abs(answer.levelDistanceBefore ?? 0) > 3
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
                    {t(
                      `manage.evaluation.adaptive.attemptDiagnostics.phases.${answer.phase === 'PRECISION' ? 'PRECISION' : 'COVERAGE'}`
                    )}
                  </td>
                  <td className="px-2 py-1">
                    {answer.competenceLevelBefore ?? '–'}
                    <div className="text-gray-500">
                      {estimate(
                        answer.competenceThetaBefore,
                        answer.competenceStandardErrorBefore
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right">
                    {signed(answer.levelDistanceBefore)}
                  </td>
                  <td className="px-2 py-1">
                    {answer.competenceLevelAfter ?? '–'}
                    <span className="ml-1 text-gray-500">
                      {formatAdaptiveLevelRange({
                        lowerLevelLabel: answer.competenceLowerLevelAfter,
                        upperLevelLabel: answer.competenceUpperLevelAfter,
                      })}
                    </span>
                    <div className="text-gray-500">
                      {estimate(
                        answer.competenceThetaAfter,
                        answer.competenceStandardErrorAfter
                      )}
                    </div>
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

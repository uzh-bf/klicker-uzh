import { useQuery } from '@apollo/client'
import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { QAdaptivePracticeQuizAttemptDiagnosticsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, Select, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import AdaptiveAttemptDiagnosticDetail from './AdaptiveAttemptDiagnosticDetail'
import AdaptiveAttemptRating from './AdaptiveAttemptRating'
import {
  type AdaptiveAttemptSummaryData,
  buildAttemptSummaryCsv,
  downloadCsv,
} from './adaptiveAttemptCsv'
import { formatAdaptiveLevelRange } from './formatAdaptiveLevelRange'

const RATING_FILTERS = ['ALL', 'UNRELIABLE', 'CHECK', 'GOOD'] as const

// Per-attempt debugging for testing environments. The server returns null
// unless ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true, and then nothing is rendered:
// production evaluations stay group-only, as students are told.
function AdaptiveAttemptDiagnostics({
  practiceQuizId,
}: {
  practiceQuizId: string
}) {
  const t = useTranslations()
  const formatter = useFormatter()
  const [ratingFilter, setRatingFilter] =
    useState<(typeof RATING_FILTERS)[number]>('ALL')
  const [openCode, setOpenCode] = useState<string | null>(null)
  const { data, loading, error } = useQuery(
    QAdaptivePracticeQuizAttemptDiagnosticsDocument,
    { variables: { practiceQuizId }, fetchPolicy: 'network-only' }
  )

  if (loading) return <Loader />
  if (error) {
    return <UserNotification type="error" message={error.message} />
  }
  const diagnostics = data?.adaptivePracticeQuizAttemptDiagnostics
  if (!diagnostics) return null

  const attempts = diagnostics.attempts.filter(
    (attempt: AdaptiveAttemptSummaryData) =>
      ratingFilter === 'ALL' || attempt.rating === ratingFilter
  )

  return (
    <section
      className="border-t border-gray-200 py-6"
      data-cy="adaptive-attempts"
    >
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <H3 className={{ root: 'mb-1' }}>
            {t('manage.evaluation.adaptive.attemptDiagnostics.title')}
          </H3>
          <p className="max-w-3xl text-sm text-gray-600">
            {t('manage.evaluation.adaptive.attemptDiagnostics.description')}
          </p>
        </div>
        <div className="flex items-end gap-2">
          <Select
            value={ratingFilter}
            onChange={(value) =>
              setRatingFilter(value as (typeof RATING_FILTERS)[number])
            }
            items={RATING_FILTERS.map((value) => ({
              value,
              label: t(
                `manage.evaluation.adaptive.attemptDiagnostics.filter.${value}`
              ),
            }))}
            data={{ cy: 'adaptive-attempts-filter' }}
          />
          <Button
            disabled={diagnostics.attempts.length === 0}
            onClick={() =>
              downloadCsv(
                `adaptive-attempts-${practiceQuizId.slice(0, 8)}.csv`,
                buildAttemptSummaryCsv(diagnostics.attempts)
              )
            }
            data={{ cy: 'adaptive-attempts-export' }}
          >
            <Button.Icon icon={faDownload} />
            <Button.Label>
              {t('manage.evaluation.adaptive.attemptDiagnostics.exportAll')}
            </Button.Label>
          </Button>
        </div>
      </div>

      {diagnostics.earlierPublicationAttemptCount > 0 ? (
        <p className="mb-2 text-xs text-gray-600">
          {t(
            'manage.evaluation.adaptive.attemptDiagnostics.earlierPublications',
            {
              count: diagnostics.earlierPublicationAttemptCount,
            }
          )}
        </p>
      ) : null}

      {attempts.length === 0 ? (
        <p className="text-sm text-gray-600">
          {t('manage.evaluation.adaptive.attemptDiagnostics.empty')}
        </p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="bg-gray-50 text-xs text-gray-700">
              <tr>
                <th className="px-3 py-2">
                  {t('manage.evaluation.adaptive.attemptDiagnostics.attempt')}
                </th>
                <th className="px-3 py-2">
                  {t(
                    'manage.evaluation.adaptive.attemptDiagnostics.completedAt'
                  )}
                </th>
                <th className="px-3 py-2 text-right">
                  {t('manage.evaluation.adaptive.attemptDiagnostics.answers')}
                </th>
                <th className="px-3 py-2">
                  {t('manage.evaluation.adaptive.attemptDiagnostics.overall')}
                </th>
                <th className="px-3 py-2">
                  {t(
                    'manage.evaluation.adaptive.attemptDiagnostics.competences'
                  )}
                </th>
                <th className="px-3 py-2">
                  {t('manage.evaluation.adaptive.attemptDiagnostics.rating')}
                </th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => {
                const open = openCode === attempt.attemptCode
                return [
                  <tr
                    key={attempt.attemptCode}
                    className="cursor-pointer border-t border-gray-100 align-top hover:bg-gray-50"
                    onClick={() =>
                      setOpenCode(open ? null : attempt.attemptCode)
                    }
                    aria-expanded={open}
                    data-cy={`adaptive-attempt-row-${attempt.attemptCode}`}
                  >
                    <td className="px-3 py-2 font-mono text-xs">
                      {attempt.attemptCode}
                      <div className="text-gray-500">
                        {t(
                          'manage.evaluation.adaptive.attemptDiagnostics.participant',
                          {
                            code: attempt.participantCode,
                            number: attempt.attemptNumber,
                          }
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {attempt.completedAt
                        ? formatter.dateTime(new Date(attempt.completedAt), {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '–'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {attempt.answerCount}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium">
                        {attempt.overall.levelLabel ?? '–'}
                        {attempt.overall.determined
                          ? ` · ${t('manage.evaluation.adaptive.attemptDiagnostics.determined')}`
                          : ''}
                      </div>
                      <div className="text-xs text-gray-600">
                        {formatAdaptiveLevelRange(attempt.overall)}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {attempt.competences.map((competence) => (
                        <div key={competence.nodeId ?? competence.name}>
                          <span className="font-medium">{competence.name}</span>
                          {`: ${competence.levelLabel ?? '–'} (${formatAdaptiveLevelRange(competence)})`}
                        </div>
                      ))}
                    </td>
                    <td className="px-3 py-2">
                      <AdaptiveAttemptRating
                        rating={attempt.rating}
                        reasons={attempt.ratingReasons}
                      />
                    </td>
                  </tr>,
                  open ? (
                    <tr key={`${attempt.attemptCode}-detail`}>
                      <td colSpan={6} className="bg-gray-50 px-3 py-4">
                        <AdaptiveAttemptDiagnosticDetail
                          practiceQuizId={practiceQuizId}
                          attemptCode={attempt.attemptCode}
                        />
                      </td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

export default AdaptiveAttemptDiagnostics

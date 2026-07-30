import { useQuery } from '@apollo/client'
import {
  AdaptiveEstimateNodeKind,
  QAdaptivePracticeQuizCohortResultsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { H1, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Layout from '../../Layout'
import AdaptiveCompetenceDistributions from './AdaptiveCompetenceDistributions'
import AdaptiveDistributionBars from './AdaptiveDistributionBars'
import AdaptivePilotMetrics from './AdaptivePilotMetrics'
import { AdaptiveCohortAttemptSummary } from './types'

function Metric({
  label,
  value,
  dataCy,
}: {
  label: string
  value: number | null
  dataCy: string
}) {
  const t = useTranslations()

  return (
    <div className="rounded border border-gray-200 px-3 py-2" data-cy={dataCy}>
      <dt className="text-xs font-medium text-gray-600">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tabular-nums">
        {value ?? t('manage.evaluation.adaptive.suppressedValue')}
      </dd>
    </div>
  )
}

function AttemptSummary({
  summary,
  cohortSize,
}: {
  summary: AdaptiveCohortAttemptSummary
  cohortSize: number | null
}) {
  const t = useTranslations()
  const metrics = [
    { key: 'completed', value: cohortSize },
    { key: 'classified', value: summary.classified },
    { key: 'capped', value: summary.capped },
    { key: 'poolExhausted', value: summary.poolExhausted },
    {
      key: 'stoppedInsufficientData',
      value: summary.stoppedInsufficientData,
    },
    { key: 'insufficientData', value: summary.insufficientData },
    { key: 'nearBoundary', value: summary.nearBoundary },
  ] as const

  return (
    <section className="py-6" data-cy="adaptive-evaluation-attempt-summary">
      <H3>{t('manage.evaluation.adaptive.attemptSummary')}</H3>
      {summary.suppressed ? (
        <UserNotification
          type="info"
          message={t('manage.evaluation.adaptive.suppression.summary')}
          className={{ root: 'mb-4' }}
          data={{ cy: 'adaptive-evaluation-summary-suppressed' }}
        />
      ) : null}
      <dl className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {metrics.map((metric) => (
          <Metric
            key={metric.key}
            label={t(`manage.evaluation.adaptive.attempts.${metric.key}`)}
            value={metric.value ?? null}
            dataCy={`adaptive-evaluation-attempt-${metric.key}`}
          />
        ))}
      </dl>
    </section>
  )
}

function SummaryRate({
  label,
  value,
  total,
  dataCy,
}: {
  label: string
  value: number | null
  total: number | null
  dataCy: string
}) {
  const t = useTranslations()
  const percentage =
    value === null || total === null || total === 0 ? 0 : (value / total) * 100

  return (
    <div data-cy={dataCy}>
      <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
        <span>{label}</span>
        <span className="font-medium tabular-nums">
          {value ?? t('manage.evaluation.adaptive.suppressedValue')}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-sm bg-gray-100">
        <div
          className="bg-uzh-blue-100 h-full"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  )
}

function StopAndQualitySummary({
  summary,
  cohortSize,
}: {
  summary: AdaptiveCohortAttemptSummary
  cohortSize: number | null
}) {
  const t = useTranslations()

  return (
    <section
      className="grid grid-cols-1 gap-8 border-t border-gray-200 py-6 md:grid-cols-2"
      data-cy="adaptive-evaluation-stop-quality-summary"
    >
      <div>
        <H3>{t('manage.evaluation.adaptive.stopSummary')}</H3>
        <div className="space-y-4">
          <SummaryRate
            label={t('manage.evaluation.adaptive.attempts.classified')}
            value={summary.classified ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-stop-classified"
          />
          <SummaryRate
            label={t('manage.evaluation.adaptive.attempts.capped')}
            value={summary.capped ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-stop-capped"
          />
          <SummaryRate
            label={t('manage.evaluation.adaptive.attempts.poolExhausted')}
            value={summary.poolExhausted ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-stop-pool-exhausted"
          />
          <SummaryRate
            label={t(
              'manage.evaluation.adaptive.attempts.stoppedInsufficientData'
            )}
            value={summary.stoppedInsufficientData ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-stop-insufficient-data"
          />
        </div>
      </div>
      <div>
        <H3>{t('manage.evaluation.adaptive.qualitySummary')}</H3>
        <div className="space-y-4">
          <SummaryRate
            label={t('manage.evaluation.adaptive.attempts.insufficientData')}
            value={summary.insufficientData ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-quality-insufficient"
          />
          <SummaryRate
            label={t('manage.evaluation.adaptive.attempts.nearBoundary')}
            value={summary.nearBoundary ?? null}
            total={cohortSize}
            dataCy="adaptive-evaluation-quality-near-boundary"
          />
        </div>
      </div>
    </section>
  )
}

function AdaptivePracticeQuizEvaluation({
  practiceQuizId,
  displayName,
}: {
  practiceQuizId: string
  displayName: string
}) {
  const t = useTranslations()
  const { data, loading, error } = useQuery(
    QAdaptivePracticeQuizCohortResultsDocument,
    {
      variables: { practiceQuizId },
      fetchPolicy: 'network-only',
    }
  )

  if (loading) {
    return (
      <Layout displayName={displayName}>
        <Loader data={{ cy: 'adaptive-evaluation-loading' }} />
      </Layout>
    )
  }

  const results = data?.adaptivePracticeQuizCohortResults

  if (error || !results) {
    return (
      <Layout displayName={displayName}>
        <UserNotification
          type="error"
          message={error?.message ?? t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  const overallDistribution = results.distributions.find(
    (distribution) => distribution.nodeKind === AdaptiveEstimateNodeKind.Overall
  )

  return (
    <Layout
      displayName={displayName}
      className={{ children: 'bg-white' }}
      data={{ cy: 'adaptive-practice-quiz-evaluation' }}
    >
      <main className="mx-auto w-full max-w-7xl" data-cy="adaptive-evaluation">
        <header className="pb-2">
          <H1 className={{ root: 'mb-1 break-words' }}>{displayName}</H1>
          <p className="text-gray-600">
            {t('manage.evaluation.adaptive.title')}
          </p>
        </header>

        {results.suppressed ? (
          <UserNotification
            type="info"
            message={t('manage.evaluation.adaptive.suppression.cohort')}
            data={{ cy: 'adaptive-evaluation-cohort-suppressed' }}
          />
        ) : null}

        <AttemptSummary
          summary={results.attemptSummary}
          cohortSize={results.cohortSize ?? null}
        />
        <AdaptivePilotMetrics
          metrics={results.pilotMetrics}
          items={results.itemDiagnostics}
        />

        <section
          className="border-t border-gray-200 py-6"
          data-cy="adaptive-evaluation-overall-distribution"
        >
          <H3>{t('manage.evaluation.adaptive.overallDistribution')}</H3>
          {overallDistribution ? (
            <AdaptiveDistributionBars
              distribution={overallDistribution}
              dataCy="adaptive-evaluation-distribution-overall"
            />
          ) : (
            <p className="text-sm text-gray-600">
              {t('manage.evaluation.adaptive.noDistributionData')}
            </p>
          )}
        </section>

        <AdaptiveCompetenceDistributions
          distributions={results.distributions}
        />
        <StopAndQualitySummary
          summary={results.attemptSummary}
          cohortSize={results.cohortSize ?? null}
        />
      </main>
    </Layout>
  )
}

export default AdaptivePracticeQuizEvaluation

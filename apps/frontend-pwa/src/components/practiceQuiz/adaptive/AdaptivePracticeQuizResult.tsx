import { useQuery } from '@apollo/client'
import {
  AdaptiveResultConfidence,
  QAdaptivePracticeQuizResultDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import AdaptiveCompetenceProfile from './AdaptiveCompetenceProfile'
import AdaptiveResultTrajectoryChart from './AdaptiveResultTrajectoryChart'

function AdaptivePracticeQuizResult({
  attemptId,
  canStartNewAttempt,
  startingNewAttempt,
  onStartNewAttempt,
}: {
  attemptId: string
  canStartNewAttempt: boolean
  startingNewAttempt: boolean
  onStartNewAttempt: () => void
}) {
  const t = useTranslations()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { data, loading, error } = useQuery(
    QAdaptivePracticeQuizResultDocument,
    {
      variables: { attemptId },
      fetchPolicy: 'network-only',
    }
  )
  const result = data?.adaptivePracticeQuizResult

  useEffect(() => {
    if (result) headingRef.current?.focus()
  }, [result])

  if (loading) return <Loader />
  if (error || !result) {
    return (
      <UserNotification
        type="error"
        message={t('pwa.practiceQuiz.adaptive.errors.result')}
      />
    )
  }

  const incomplete =
    result.confidence === AdaptiveResultConfidence.InsufficientData ||
    !result.levelLabel

  return (
    <section
      className="mx-auto w-full max-w-5xl space-y-8"
      data-cy="adaptive-practice-quiz-result"
    >
      <div className="border-b pb-6">
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mb-[0.2em] font-sans text-xl font-bold outline-none"
        >
          {t('pwa.practiceQuiz.adaptive.result.title')}
        </h2>
        <p className="mt-1 text-slate-700">{result.practiceQuizName}</p>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-600">
              {t('pwa.practiceQuiz.adaptive.profile.overall')}
            </div>
            <div
              className="mt-1 text-3xl font-bold text-slate-900"
              data-cy="adaptive-result-overall-level"
            >
              {incomplete
                ? t('pwa.practiceQuiz.adaptive.result.incompleteHeadline')
                : result.levelLabel}
            </div>
          </div>
          <div className="space-y-1 text-sm text-slate-700 sm:text-right">
            <div>
              {t('pwa.practiceQuiz.adaptive.result.answeredQuestions', {
                count: result.answeredQuestions,
              })}
            </div>
            <div>
              {t(`pwa.practiceQuiz.adaptive.confidence.${result.confidence}`)}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            {t(`pwa.practiceQuiz.adaptive.stopReasons.${result.stopReason}`)}
          </p>
          {result.nearBoundary && (
            <p className="border-primary-100 border-l-4 pl-3">
              {t('pwa.practiceQuiz.adaptive.nearBoundary.description')}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <H3>{t('pwa.practiceQuiz.adaptive.trajectory.title')}</H3>
        <AdaptiveResultTrajectoryChart
          levelBands={result.levelBands}
          trajectory={result.trajectory}
          overall={{
            answeredQuestions: result.answeredQuestions,
            position: result.position,
            lowerPosition: result.lowerPosition,
            upperPosition: result.upperPosition,
            levelLabel: result.levelLabel,
          }}
        />
      </div>

      <div className="space-y-3 border-t pt-6">
        <H3>{t('pwa.practiceQuiz.adaptive.profile.title')}</H3>
        <AdaptiveCompetenceProfile
          overall={{
            name: t('pwa.practiceQuiz.adaptive.profile.overall'),
            responseCount: result.answeredQuestions,
            levelLabel: result.levelLabel,
            confidence: result.confidence,
            nearBoundary: result.nearBoundary,
            position: result.position,
            lowerPosition: result.lowerPosition,
            upperPosition: result.upperPosition,
          }}
          levelBands={result.levelBands}
          nodes={result.competenceProfile}
        />
      </div>

      {canStartNewAttempt && (
        <div className="flex justify-end border-t pt-6">
          <Button
            primary
            fluid
            loading={startingNewAttempt}
            onClick={onStartNewAttempt}
            data={{ cy: 'start-new-adaptive-practice-quiz-attempt' }}
            className={{ root: 'sm:w-auto' }}
          >
            <Button.Label>
              {t('pwa.practiceQuiz.adaptive.actions.practiceAgain')}
            </Button.Label>
          </Button>
        </div>
      )}
    </section>
  )
}

export default AdaptivePracticeQuizResult

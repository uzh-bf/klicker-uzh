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
  const { data, loading, error, refetch } = useQuery(
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
      <div className="flex flex-col items-start gap-3">
        <UserNotification
          type="error"
          message={t('pwa.practiceQuiz.adaptive.errors.result')}
        />
        <Button
          type="button"
          onClick={() => void refetch()}
          disabled={loading}
          loading={loading}
          data={{ cy: 'retry-adaptive-practice-quiz-result' }}
        >
          <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
        </Button>
      </div>
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
          className="focus:outline-primary-80 mb-[0.2em] rounded-sm font-sans text-xl font-bold focus:outline focus:outline-2 focus:outline-offset-2"
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
                : t(
                    `pwa.practiceQuiz.adaptive.result.interpretation.${result.levelInterpretation}.headline`,
                    { level: result.levelLabel ?? '' }
                  )}
            </div>
            {!incomplete && (
              <p
                className="mt-2 max-w-2xl text-sm text-slate-700"
                data-cy="adaptive-result-level-interpretation"
              >
                {t(
                  `pwa.practiceQuiz.adaptive.result.interpretation.${result.levelInterpretation}.description`
                )}
              </p>
            )}
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

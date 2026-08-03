import { useQuery } from '@apollo/client'
import {
  AdaptivePracticeQuizResultClassification,
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

  const researchOnly =
    result.classification ===
    AdaptivePracticeQuizResultClassification.ResearchOnly
  const resultLabel = (() => {
    switch (result.classification) {
      case AdaptivePracticeQuizResultClassification.Classified:
        return t(
          `pwa.practiceQuiz.adaptive.result.interpretation.${result.levelInterpretation}.headline`,
          { level: result.levelLabel ?? '' }
        )
      case AdaptivePracticeQuizResultClassification.BetweenLevels:
        return t('pwa.practiceQuiz.adaptive.result.betweenHeadline', {
          levels: result.leadingLevelLabels.join(' / '),
        })
      case AdaptivePracticeQuizResultClassification.PoolLimited:
        return t('pwa.practiceQuiz.adaptive.result.poolLimitedHeadline')
      case AdaptivePracticeQuizResultClassification.ResearchOnly:
        return t('pwa.practiceQuiz.adaptive.result.researchHeadline')
      case AdaptivePracticeQuizResultClassification.InsufficientEvidence:
        return t('pwa.practiceQuiz.adaptive.result.incompleteHeadline')
    }
  })()

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
              {resultLabel}
            </div>
            {!researchOnly && (
              <p
                className="mt-2 max-w-2xl text-sm text-slate-700"
                data-cy="adaptive-result-level-interpretation"
              >
                {t(CLASSIFICATION_COPY[result.classification].description)}
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
              {t(CLASSIFICATION_COPY[result.classification].label)}
              {typeof result.classificationProbability === 'number' && (
                <span>
                  {' '}
                  {t('pwa.practiceQuiz.adaptive.result.probability', {
                    probability: Math.round(
                      result.classificationProbability * 100
                    ),
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p>
            {t(`pwa.practiceQuiz.adaptive.stopReasons.${result.stopReason}`)}
          </p>
          {result.classification ===
            AdaptivePracticeQuizResultClassification.BetweenLevels && (
            <p className="border-primary-100 border-l-4 pl-3">
              {t('pwa.practiceQuiz.adaptive.nearBoundary.description')}
            </p>
          )}
        </div>
      </div>

      {!researchOnly && (
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
              levelLabel:
                result.levelLabel ?? result.leadingLevelLabels.join(' / '),
            }}
          />
        </div>
      )}

      {!researchOnly && (
        <div className="space-y-3 border-t pt-6">
          <H3>{t('pwa.practiceQuiz.adaptive.profile.title')}</H3>
          <AdaptiveCompetenceProfile
            overall={{
              name: t('pwa.practiceQuiz.adaptive.profile.overall'),
              responseCount: result.answeredQuestions,
              classification: result.classification,
              levelLabel: result.levelLabel,
              leadingLevelLabels: result.leadingLevelLabels,
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
      )}

      {!researchOnly && (
        <div className="border-t pt-6" data-cy="adaptive-result-next-step">
          <H3>{t('pwa.practiceQuiz.adaptive.result.nextStep.title')}</H3>
          <p className="mt-2 text-slate-700">
            {t(CLASSIFICATION_COPY[result.classification].nextStep)}
          </p>
        </div>
      )}

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

const CLASSIFICATION_COPY = {
  [AdaptivePracticeQuizResultClassification.Classified]: {
    label: 'pwa.practiceQuiz.adaptive.result.classification.CLASSIFIED.label',
    description:
      'pwa.practiceQuiz.adaptive.result.classification.CLASSIFIED.description',
    nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.CLASSIFIED',
  },
  [AdaptivePracticeQuizResultClassification.BetweenLevels]: {
    label:
      'pwa.practiceQuiz.adaptive.result.classification.BETWEEN_LEVELS.label',
    description:
      'pwa.practiceQuiz.adaptive.result.classification.BETWEEN_LEVELS.description',
    nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.BETWEEN_LEVELS',
  },
  [AdaptivePracticeQuizResultClassification.InsufficientEvidence]: {
    label:
      'pwa.practiceQuiz.adaptive.result.classification.INSUFFICIENT_EVIDENCE.label',
    description:
      'pwa.practiceQuiz.adaptive.result.classification.INSUFFICIENT_EVIDENCE.description',
    nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.INSUFFICIENT_EVIDENCE',
  },
  [AdaptivePracticeQuizResultClassification.PoolLimited]: {
    label: 'pwa.practiceQuiz.adaptive.result.classification.POOL_LIMITED.label',
    description:
      'pwa.practiceQuiz.adaptive.result.classification.POOL_LIMITED.description',
    nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.POOL_LIMITED',
  },
  [AdaptivePracticeQuizResultClassification.ResearchOnly]: {
    label:
      'pwa.practiceQuiz.adaptive.result.classification.RESEARCH_ONLY.label',
    description:
      'pwa.practiceQuiz.adaptive.result.classification.RESEARCH_ONLY.description',
    nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.RESEARCH_ONLY',
  },
} as const

export default AdaptivePracticeQuizResult

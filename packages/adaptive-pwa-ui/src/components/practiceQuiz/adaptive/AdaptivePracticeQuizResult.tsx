import { useQuery } from '@apollo/client'
import {
  AdaptivePracticeQuizResultClassification,
  QAdaptivePracticeQuizResultWithPlacementPilotDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import AdaptiveCompetenceProfile from './AdaptiveCompetenceProfile'
import AdaptiveTestingHistory from './AdaptiveTestingHistory'
import { getAdaptiveReportedLevelLabel } from './adaptiveReportedLevel'
import {
  getAdaptiveEstimatedLevelText,
  getAdaptiveRangeText,
  getAdaptiveResultState,
} from './adaptiveResultState'
import { getAdaptiveEstimatedLevelRange } from './adaptiveResultUncertainty'

function AdaptivePracticeQuizResult({
  attemptId,
  canStartNewAttempt,
  nextAttemptAvailableAt,
  startingNewAttempt,
  onStartNewAttempt,
}: {
  attemptId: string
  canStartNewAttempt: boolean
  nextAttemptAvailableAt: string | null
  startingNewAttempt: boolean
  onStartNewAttempt: () => void
}) {
  const t = useTranslations()
  const format = useFormatter()
  const headingRef = useRef<HTMLHeadingElement>(null)
  const { data, loading, error, refetch } = useQuery(
    QAdaptivePracticeQuizResultWithPlacementPilotDocument,
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
        <UserNotification type="error">
          {t('pwa.practiceQuiz.adaptive.errors.result')}
        </UserNotification>
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
  const placementPilot = result.isPlacementPilot
  const estimatedLevelRange =
    researchOnly || placementPilot
      ? null
      : getAdaptiveEstimatedLevelRange({
          lowerPosition: result.lowerPosition,
          upperPosition: result.upperPosition,
          levelBands: result.levelBands,
        })
  // Overall presentation state: determined, finished with an estimate that is
  // not determined, or no usable estimate. Placement pilots keep their copy.
  const overallState = placementPilot
    ? null
    : getAdaptiveResultState({
        classification: result.classification,
        levelLabel: result.levelLabel,
        responseCount: result.answeredQuestions,
        position: result.position,
        lowerPosition: result.lowerPosition,
        upperPosition: result.upperPosition,
        levelBands: result.levelBands,
      })
  const estimatedState =
    overallState?.kind === 'ESTIMATED' ? overallState : null
  const estimatedText = estimatedState
    ? getAdaptiveEstimatedLevelText({
        state: estimatedState,
        levelBands: result.levelBands,
        rough: false,
      })
    : null
  const estimatedLabel = estimatedText
    ? t(estimatedText.key, {
        level: t(estimatedText.level.key, estimatedText.level.values),
      })
    : null
  const formatRange = (lowerLevelLabel: string, upperLevelLabel: string) => {
    const range = getAdaptiveRangeText({
      lowerLevelLabel,
      upperLevelLabel,
      levelBands: result.levelBands,
    })
    switch (range.key) {
      case 'pwa.practiceQuiz.adaptive.profile.likelyRange':
        return `${range.values.lower} – ${range.values.upper}`
      case 'pwa.practiceQuiz.adaptive.profile.likelyLevel':
        return range.values.level
      case 'pwa.practiceQuiz.adaptive.profile.likelyOrBelow':
        return t('pwa.practiceQuiz.adaptive.profile.levelOrBelow', range.values)
      case 'pwa.practiceQuiz.adaptive.profile.likelyOrAbove':
        return t('pwa.practiceQuiz.adaptive.profile.levelOrAbove', range.values)
    }
  }
  const copy = estimatedState
    ? NOT_DETERMINED_COPY
    : CLASSIFICATION_COPY[result.classification]
  const resultLabel = placementPilot
    ? (() => {
        switch (result.classification) {
          case AdaptivePracticeQuizResultClassification.Classified:
            return t(
              'pwa.practiceQuiz.adaptive.result.placementPilot.estimatedLevel',
              { level: result.levelLabel ?? '' }
            )
          case AdaptivePracticeQuizResultClassification.BetweenLevels:
            return t(
              'pwa.practiceQuiz.adaptive.result.placementPilot.adjacentRange',
              { levels: result.leadingLevelLabels.join(' / ') }
            )
          default:
            return t(
              'pwa.practiceQuiz.adaptive.result.placementPilot.noEvidence'
            )
        }
      })()
    : (() => {
        switch (result.classification) {
          case AdaptivePracticeQuizResultClassification.Classified: {
            const level = result.levelLabel
              ? getAdaptiveReportedLevelLabel({
                  levelLabel: result.levelLabel,
                  levelBands: result.levelBands,
                  toleranceBands: result.classificationToleranceBands,
                  classified: true,
                })
              : null
            return t(
              `pwa.practiceQuiz.adaptive.result.interpretation.${result.levelInterpretation}.headline`,
              { level: level ? t(level.key, level.values) : '' }
            )
          }
          case AdaptivePracticeQuizResultClassification.BetweenLevels:
            return t('pwa.practiceQuiz.adaptive.result.betweenHeadline', {
              levels: result.leadingLevelLabels.join(' / '),
            })
          case AdaptivePracticeQuizResultClassification.PoolLimited:
            return t('pwa.practiceQuiz.adaptive.result.poolLimitedHeadline')
          case AdaptivePracticeQuizResultClassification.ResearchOnly:
            return t('pwa.practiceQuiz.adaptive.result.researchHeadline')
          case AdaptivePracticeQuizResultClassification.InsufficientEvidence:
            return (
              estimatedLabel ??
              t('pwa.practiceQuiz.adaptive.result.incompleteHeadline')
            )
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
        {placementPilot ? (
          <UserNotification
            type="info"
            message={t(
              'pwa.practiceQuiz.adaptive.result.placementPilot.notice'
            )}
            data={{ cy: 'adaptive-placement-pilot-notice' }}
          />
        ) : null}
        {result.stopReason === 'TIME_LIMIT' ? (
          <UserNotification
            type="warning"
            message={t(
              result.answeredQuestions === 0
                ? 'pwa.practiceQuiz.adaptive.result.timeLimit.zeroAnswered'
                : 'pwa.practiceQuiz.adaptive.result.timeLimit.answered'
            )}
            data={{ cy: 'adaptive-result-time-limit-notice' }}
          />
        ) : null}

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
            {!researchOnly && !placementPilot && (
              <p
                className="mt-2 max-w-2xl text-sm text-slate-700"
                data-cy="adaptive-result-level-interpretation"
              >
                {t(copy.description)}
              </p>
            )}
            {estimatedLevelRange && (
              <div
                className="mt-4 max-w-2xl border-l-4 border-primary-100 bg-primary-20 px-4 py-3"
                data-cy="adaptive-result-estimated-level-range"
              >
                <div className="text-sm font-semibold text-slate-900">
                  {t('pwa.practiceQuiz.adaptive.result.uncertainty.title')}
                </div>
                <p className="mt-1 text-slate-900">
                  {formatRange(
                    estimatedLevelRange.lowerLevelLabel,
                    estimatedLevelRange.upperLevelLabel
                  )}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {t(
                    'pwa.practiceQuiz.adaptive.result.uncertainty.description'
                  )}
                </p>
              </div>
            )}
          </div>
          <div className="space-y-1 text-sm text-slate-700 sm:text-right">
            <div>
              {t('pwa.practiceQuiz.adaptive.result.answeredQuestions', {
                count: result.answeredQuestions,
              })}
            </div>
            {!placementPilot ? (
              <div>
                {t(copy.label)}
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
            ) : null}
          </div>
        </div>

        <div className="mt-4 space-y-2 text-sm text-slate-700">
          {placementPilot ? (
            <p>
              {t('pwa.practiceQuiz.adaptive.result.placementPilot.resultHelp')}
            </p>
          ) : (
            <p>
              {t(`pwa.practiceQuiz.adaptive.stopReasons.${result.stopReason}`)}
            </p>
          )}
          {!placementPilot &&
            result.classification ===
              AdaptivePracticeQuizResultClassification.BetweenLevels && (
              <p className="border-primary-100 border-l-4 pl-3">
                {t('pwa.practiceQuiz.adaptive.nearBoundary.description')}
              </p>
            )}
        </div>
      </div>

      {!researchOnly && (
        <div className="space-y-3 border-t pt-6">
          <H3>{t('pwa.practiceQuiz.adaptive.profile.title')}</H3>
          <p className="text-sm text-slate-600">
            {t('pwa.practiceQuiz.adaptive.profile.evidenceHelp')}
          </p>
          <AdaptiveCompetenceProfile
            isPlacementPilot={placementPilot}
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
            toleranceBands={result.classificationToleranceBands}
          />
        </div>
      )}

      {/* Only returned by the server when ADAPTIVE_QUIZ_SHOW_SOLUTIONS=true. */}
      {result.testingHistory && (
        <div
          className="space-y-3 rounded border border-amber-300 bg-amber-50 p-4 text-sm"
          data-cy="adaptive-result-testing-info"
        >
          <div>
            <h3 className="font-semibold">
              {t('pwa.practiceQuiz.adaptive.question.testingInfo')}
            </h3>
            <p className="text-slate-600">
              {t('pwa.practiceQuiz.adaptive.question.testingInfoDescription')}
            </p>
          </div>
          <AdaptiveTestingHistory history={result.testingHistory} />
        </div>
      )}

      {!researchOnly && !placementPilot && (
        <div className="border-t pt-6" data-cy="adaptive-result-next-step">
          <H3>{t('pwa.practiceQuiz.adaptive.result.nextStep.title')}</H3>
          <p className="mt-2 text-slate-700">{t(copy.nextStep)}</p>
        </div>
      )}

      {!canStartNewAttempt && (
        <p
          className="border-t pt-6 text-sm text-slate-700"
          data-cy="adaptive-retake-availability"
        >
          {nextAttemptAvailableAt
            ? t('pwa.practiceQuiz.adaptive.result.retakeAvailableAt', {
                date: format.dateTime(new Date(nextAttemptAvailableAt), {
                  dateStyle: 'long',
                  timeStyle: 'short',
                }),
              })
            : t('pwa.practiceQuiz.adaptive.result.retakeUnavailable')}
        </p>
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

// Finished attempt whose overall estimate exists but is not determined.
const NOT_DETERMINED_COPY = {
  label: 'pwa.practiceQuiz.adaptive.result.notDetermined.label',
  description: 'pwa.practiceQuiz.adaptive.result.notDetermined.description',
  nextStep: 'pwa.practiceQuiz.adaptive.result.nextStep.INSUFFICIENT_EVIDENCE',
} as const

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

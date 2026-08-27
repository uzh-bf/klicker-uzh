import {
  FreeTextCorrectnessCategory,
  FreeTextEvaluationStatus,
  type FreeTextPracticeStateDataFragment,
} from '@klicker-uzh/graphql/dist/ops'
import FreeTextRubricBreakdown from '@klicker-uzh/shared-components/src/evaluation/FreeTextRubricBreakdown'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'

function FreeTextRetryPanel({
  state,
  editing,
  detailsOpen,
  answerChanged,
  loading,
  error,
  onTryAgain,
  onSubmitAnswer,
  onRetryEvaluation,
  onRevealSolution,
  onToggleDetails,
  onPracticeAgain,
}: {
  state: FreeTextPracticeStateDataFragment
  editing: boolean
  detailsOpen: boolean
  answerChanged: boolean
  loading: boolean
  error?: unknown
  onTryAgain: () => void
  onSubmitAnswer: () => void
  onRetryEvaluation: () => void
  onRevealSolution: () => void
  onToggleDetails: () => void
  onPracticeAgain: () => void
}) {
  const t = useTranslations()
  const attempt = state.currentAttempt
  const pending = attempt?.evaluationStatus === FreeTextEvaluationStatus.Pending
  const unavailable =
    attempt?.evaluationStatus === FreeTextEvaluationStatus.Unavailable
  const evaluated =
    attempt?.evaluationStatus === FreeTextEvaluationStatus.Evaluated
  const explanationId = `semantic-solution-feedback-${state.cycleId}`

  let defaultOutcome = t('pwa.practiceQuiz.semanticIncorrect')
  if (attempt?.correctness === FreeTextCorrectnessCategory.Correct) {
    defaultOutcome = t('pwa.practiceQuiz.semanticCorrect')
  } else if (attempt?.correctness === FreeTextCorrectnessCategory.Partial) {
    defaultOutcome = t('pwa.practiceQuiz.semanticPartiallyCorrect')
  }
  const outcomeMessage = attempt?.outcomeBandLabel || defaultOutcome
  let notificationType: 'info' | 'warning' | 'success' | 'error' = 'info'
  if (unavailable) {
    notificationType = 'warning'
  } else if (attempt?.correctness === FreeTextCorrectnessCategory.Correct) {
    notificationType = 'success'
  } else if (attempt?.correctness === FreeTextCorrectnessCategory.Partial) {
    notificationType = 'warning'
  } else if (evaluated) {
    notificationType = 'error'
  }

  let notificationMessage = t('pwa.practiceQuiz.semanticReady')
  if (pending) {
    notificationMessage = t('pwa.practiceQuiz.semanticPending')
  } else if (unavailable) {
    notificationMessage = t('pwa.practiceQuiz.semanticUnavailable')
  } else if (evaluated) {
    notificationMessage = outcomeMessage
  }

  return (
    <section
      className="mt-3 rounded-md border border-gray-300 bg-gray-50 p-3"
      data-cy="semantic-free-text-retry-panel"
    >
      <div aria-live="polite" aria-atomic="true">
        <UserNotification
          type={notificationType}
          message={notificationMessage}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <span data-cy="semantic-attempts-used">
          {t('pwa.practiceQuiz.semanticAttemptsUsed', {
            used: state.attemptsUsed,
            limit: state.attemptLimit,
          })}
        </span>
        <span data-cy="semantic-attempts-remaining">
          {t('pwa.practiceQuiz.semanticAttemptsRemaining', {
            remaining: state.attemptsRemaining,
          })}
        </span>
        {attempt &&
          ((attempt.pointsAwarded ?? 0) !== 0 || attempt.xpAwarded !== 0) && (
            <span data-cy="semantic-reward-delta">
              {t('pwa.practiceQuiz.semanticRewardDelta', {
                points: attempt.pointsAwarded ?? 0,
                xp: attempt.xpAwarded,
              })}
            </span>
          )}
      </div>

      {!!error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {t('pwa.practiceQuiz.semanticActionFailed')}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {state.canSubmitAnswer && attempt && !editing && (
          <Button
            primary
            disabled={loading}
            onClick={onTryAgain}
            data={{ cy: 'semantic-try-again' }}
          >
            {t('pwa.practiceQuiz.semanticTryAgain')}
          </Button>
        )}
        {state.canSubmitAnswer && editing && (
          <Button
            primary
            loading={loading}
            disabled={loading || !answerChanged}
            onClick={onSubmitAnswer}
            data={{ cy: 'semantic-submit-improved-answer' }}
          >
            {attempt
              ? t('pwa.practiceQuiz.semanticSubmitImprovedAnswer')
              : t('pwa.practiceQuiz.semanticSubmitAnswer')}
          </Button>
        )}
        {state.canRetryEvaluation && (
          <Button
            primary
            loading={loading}
            disabled={loading}
            onClick={onRetryEvaluation}
            data={{ cy: 'semantic-retry-evaluation' }}
          >
            {t('pwa.practiceQuiz.semanticRetryEvaluation')}
          </Button>
        )}
        {state.canRevealSolution && (
          <Button
            disabled={loading}
            onClick={onRevealSolution}
            data={{ cy: 'semantic-show-solution' }}
          >
            {t('pwa.practiceQuiz.semanticShowSolution')}
          </Button>
        )}
        {state.solutionAuthorized && (
          <Button
            disabled={loading}
            onClick={onToggleDetails}
            aria-controls={explanationId}
            aria-expanded={detailsOpen}
            data={{ cy: 'semantic-toggle-explanation' }}
          >
            {detailsOpen
              ? t('pwa.practiceQuiz.semanticHideExplanation')
              : t('pwa.practiceQuiz.semanticViewExplanation')}
          </Button>
        )}
        {state.canPracticeAgain && (
          <Button
            disabled={loading}
            onClick={onPracticeAgain}
            data={{ cy: 'semantic-practice-again' }}
          >
            {t('pwa.practiceQuiz.semanticPracticeAgain')}
          </Button>
        )}
      </div>

      {state.solutionAuthorized && detailsOpen && (
        <div id={explanationId} className="mt-4">
          <FreeTextRubricBreakdown result={attempt?.structuredResult} />
        </div>
      )}

      {state.attempts.length > 0 && (
        <details className="mt-4" data-cy="semantic-attempt-history">
          <summary
            className="cursor-pointer text-sm font-semibold"
            data-cy="semantic-attempt-history-toggle"
          >
            {t('pwa.practiceQuiz.semanticAttemptHistory')}
          </summary>
          <ol className="mt-2 flex list-decimal flex-col gap-2 pl-5">
            {state.attempts.map((historyAttempt) => {
              let historyMessage =
                historyAttempt.outcomeBandLabel ||
                t('pwa.practiceQuiz.semanticHistoryEvaluated')
              if (
                historyAttempt.evaluationStatus ===
                FreeTextEvaluationStatus.Pending
              ) {
                historyMessage = t('pwa.practiceQuiz.semanticHistoryPending')
              } else if (
                historyAttempt.evaluationStatus ===
                FreeTextEvaluationStatus.Unavailable
              ) {
                historyMessage = t(
                  'pwa.practiceQuiz.semanticHistoryUnavailable'
                )
              }

              return (
                <li key={historyAttempt.id} className="text-sm">
                  <div className="whitespace-pre-wrap break-words">
                    {historyAttempt.answer}
                  </div>
                  <div className="text-xs text-gray-600">{historyMessage}</div>
                </li>
              )
            })}
          </ol>
        </details>
      )}
    </section>
  )
}

export default FreeTextRetryPanel

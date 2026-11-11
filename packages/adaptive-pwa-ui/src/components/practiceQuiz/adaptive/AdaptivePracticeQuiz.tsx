import { useMutation, useQuery } from '@apollo/client'
import {
  AdaptivePracticeQuizAttemptStatus,
  type AdaptivePracticeQuizResponseInput,
  type FAdaptivePracticeQuizAttemptStateWithRuntimeLimitsFragment,
  MRestartAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument,
  MResumeAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument,
  MStartAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument,
  MSubmitAdaptivePracticeQuizResponseWithRuntimeLimitsDocument,
  QAdaptivePracticeQuizAttemptStateWithRuntimeLimitsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { PracticeQuizCard } from '@klicker-uzh/shared-components/src/practiceQuiz/PracticeQuizOverviewParts'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useAdaptivePwaHost } from '../../../ports'
import AdaptivePracticeQuizIntro from './AdaptivePracticeQuizIntro'
import AdaptivePracticeQuizQuestion from './AdaptivePracticeQuizQuestion'
import AdaptivePracticeQuizResult from './AdaptivePracticeQuizResult'
import { isAdaptiveBusyError } from './adaptiveBusyError'

export type AdaptivePracticeQuizProgress = {
  status: 'overview' | 'in-progress' | 'completed'
  currentStep: number
  totalSteps: number
}

interface AdaptivePracticeQuizProps {
  practiceQuizId: string
  name: string
  displayName: string
  description?: string | null
  maximumQuestions: number
  retakeCooldownDays?: number | null
  previewOnly?: boolean
  embedded?: boolean
  onProgressChange?: (progress: AdaptivePracticeQuizProgress) => void
}

type AdaptiveActionError = 'start' | 'resume' | 'startOver' | 'submit'

function AdaptivePracticeQuiz({
  practiceQuizId,
  name,
  displayName,
  description,
  maximumQuestions,
  retakeCooldownDays,
  previewOnly = false,
  embedded = false,
  onProgressChange,
}: AdaptivePracticeQuizProps) {
  const { PreviewMessage } = useAdaptivePwaHost()
  const t = useTranslations()
  const [attempt, setAttempt] =
    useState<FAdaptivePracticeQuizAttemptStateWithRuntimeLimitsFragment | null>(
      null
    )
  const [showQuestion, setShowQuestion] = useState(false)
  const [actionError, setActionError] = useState<AdaptiveActionError | null>(
    null
  )
  // Set when the last failed action was a retryable "quiz is busy" error.
  const [actionBusy, setActionBusy] = useState(false)
  const failAction = (action: AdaptiveActionError, error: unknown) => {
    setActionError(action)
    setActionBusy(isAdaptiveBusyError(error))
  }
  const mutationStateApplied = useRef(false)
  const [now, setNow] = useState(() => Date.now())
  const deadline = attempt?.deadlineAt
    ? new Date(attempt.deadlineAt).getTime()
    : null
  const remainingSeconds =
    deadline === null ? null : Math.max(0, Math.ceil((deadline - now) / 1000))
  const expired =
    remainingSeconds === 0 &&
    attempt?.status === AdaptivePracticeQuizAttemptStatus.InProgress

  const { data, loading, error, refetch } = useQuery(
    QAdaptivePracticeQuizAttemptStateWithRuntimeLimitsDocument,
    {
      variables: { practiceQuizId },
      skip: previewOnly,
      fetchPolicy: 'network-only',
    }
  )
  const [startAttempt, { loading: starting }] = useMutation(
    MStartAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument
  )
  const [resumeAttempt, { loading: resuming }] = useMutation(
    MResumeAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument
  )
  const [restartAttempt, { loading: restarting }] = useMutation(
    MRestartAdaptivePracticeQuizAttemptWithRuntimeLimitsDocument
  )
  const [submitResponse, { loading: submitting }] = useMutation(
    MSubmitAdaptivePracticeQuizResponseWithRuntimeLimitsDocument
  )

  useEffect(() => {
    if (
      deadline === null ||
      attempt?.status !== AdaptivePracticeQuizAttemptStatus.InProgress
    )
      return
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    setNow(Date.now())
    return () => window.clearInterval(interval)
  }, [deadline, attempt?.status])

  useEffect(() => {
    if (!expired || !attempt) return
    let cancelled = false
    let inFlight = false
    const finish = async () => {
      if (inFlight) return
      inFlight = true
      mutationStateApplied.current = true
      try {
        const response = await resumeAttempt({
          variables: { attemptId: attempt.attemptId },
        })
        const next = response.data?.resumeAdaptivePracticeQuizAttempt
        if (!cancelled && next) {
          setAttempt(next)
          setActionError(null)
        }
      } catch {
        if (!cancelled) setActionError('resume')
      } finally {
        inFlight = false
      }
    }
    void finish()
    const retry = window.setInterval(() => void finish(), 5000)
    return () => {
      cancelled = true
      window.clearInterval(retry)
    }
  }, [expired, attempt?.attemptId, resumeAttempt])

  useEffect(() => {
    if (!previewOnly && data && !mutationStateApplied.current) {
      setAttempt(data.adaptivePracticeQuizAttemptState ?? null)
    }
  }, [data, previewOnly])

  useEffect(() => {
    if (!onProgressChange) return

    if (attempt?.status === AdaptivePracticeQuizAttemptStatus.Completed) {
      onProgressChange({
        status: 'completed',
        currentStep: attempt.answeredQuestions,
        totalSteps: attempt.maximumQuestions,
      })
      return
    }

    if (attempt?.status === AdaptivePracticeQuizAttemptStatus.InProgress) {
      onProgressChange({
        status: 'in-progress',
        currentStep: showQuestion
          ? (attempt.questionNumber ?? attempt.answeredQuestions + 1)
          : attempt.answeredQuestions,
        totalSteps: attempt.maximumQuestions,
      })
      return
    }

    onProgressChange({
      status: 'overview',
      currentStep: 0,
      totalSteps: maximumQuestions,
    })
  }, [attempt, maximumQuestions, onProgressChange, showQuestion])

  const handleStart = async () => {
    setActionError(null)
    mutationStateApplied.current = true
    try {
      const result = await startAttempt({ variables: { practiceQuizId } })
      const next = result.data?.startAdaptivePracticeQuizAttempt
      if (!next) throw new Error('Adaptive attempt did not start.')
      setAttempt(next)
      setShowQuestion(true)
    } catch (error) {
      failAction('start', error)
    }
  }

  const handleResume = async () => {
    if (!attempt) return
    setActionError(null)
    mutationStateApplied.current = true
    try {
      const result = await resumeAttempt({
        variables: { attemptId: attempt.attemptId },
      })
      const next = result.data?.resumeAdaptivePracticeQuizAttempt
      if (!next) throw new Error('Adaptive attempt did not resume.')
      setAttempt(next)
      setShowQuestion(true)
    } catch (error) {
      failAction('resume', error)
    }
  }

  const handleRestart = async () => {
    if (!attempt) return
    const previousAttemptId = attempt.attemptId
    setActionError(null)
    mutationStateApplied.current = true
    try {
      const result = await restartAttempt({
        variables: { attemptId: attempt.attemptId },
      })
      const next = result.data?.restartAdaptivePracticeQuizAttempt
      if (!next) throw new Error('Adaptive attempt did not restart.')
      setAttempt(next)
      setShowQuestion(true)
    } catch (error) {
      failAction('startOver', error)
      const refreshed = await refetch().catch(() => null)
      const next = refreshed?.data.adaptivePracticeQuizAttemptState
      if (
        next?.status === AdaptivePracticeQuizAttemptStatus.InProgress &&
        next.attemptId !== previousAttemptId
      ) {
        setAttempt(next)
        setShowQuestion(true)
        setActionError(null)
      }
    }
  }

  const handleSubmit = async (
    response: AdaptivePracticeQuizResponseInput,
    elapsedSeconds: number
  ) => {
    if (!attempt?.servedItem || (deadline !== null && Date.now() >= deadline))
      return
    setActionError(null)
    mutationStateApplied.current = true
    try {
      const result = await submitResponse({
        variables: {
          attemptId: attempt.attemptId,
          servedItemId: attempt.servedItem.poolItemId,
          response,
          elapsedSeconds,
        },
      })
      const next = result.data?.submitAdaptivePracticeQuizResponse
      if (!next) throw new Error('Adaptive response returned no state.')
      setAttempt(next)
      setShowQuestion(
        next.status === AdaptivePracticeQuizAttemptStatus.InProgress
      )
    } catch (error) {
      failAction('submit', error)
      const refreshed = await refetch().catch(() => null)
      const next = refreshed?.data.adaptivePracticeQuizAttemptState
      if (next) {
        setAttempt(next)
        setShowQuestion(
          next.status === AdaptivePracticeQuizAttemptStatus.InProgress
        )
        if (
          next.status === AdaptivePracticeQuizAttemptStatus.Completed ||
          next.servedItem?.poolItemId !== attempt.servedItem.poolItemId
        ) {
          setActionError(null)
        }
      }
    }
  }

  const actionLoading = starting || resuming || restarting

  return (
    <PracticeQuizCard embedded={embedded}>
      {previewOnly && (
        <PreviewMessage
          activityType={t('shared.generic.practiceQuiz')}
          name={name}
          displayName={displayName}
        />
      )}

      {!previewOnly && loading && <Loader />}

      {!previewOnly && error && (
        <div className="flex flex-col items-start gap-3">
          <UserNotification
            type="error"
            message={t('pwa.practiceQuiz.adaptive.unavailable.description')}
          />
          <Button
            type="button"
            onClick={() => void refetch()}
            disabled={loading}
            loading={loading}
            data={{ cy: 'retry-adaptive-practice-quiz-state' }}
          >
            <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
          </Button>
        </div>
      )}

      {actionError &&
        actionError !== 'submit' &&
        !showQuestion &&
        (actionBusy ? (
          <div className="flex flex-col items-start gap-3">
            <UserNotification
              type="warning"
              message={t('pwa.practiceQuiz.adaptive.errors.busy')}
              data={{ cy: 'adaptive-practice-quiz-busy' }}
            />
            <Button
              type="button"
              onClick={() =>
                void {
                  start: handleStart,
                  resume: handleResume,
                  startOver: handleRestart,
                }[actionError]()
              }
              disabled={actionLoading}
              loading={actionLoading}
              data={{ cy: 'retry-adaptive-practice-quiz-action' }}
            >
              <Button.Label>{t('shared.generic.tryAgain')}</Button.Label>
            </Button>
          </div>
        ) : (
          <UserNotification
            type="error"
            message={t(`pwa.practiceQuiz.adaptive.errors.${actionError}`)}
          />
        ))}

      {(previewOnly || (!loading && !error)) &&
        attempt?.status !== AdaptivePracticeQuizAttemptStatus.Completed &&
        (!showQuestion || !attempt?.servedItem) && (
          <AdaptivePracticeQuizIntro
            displayName={displayName}
            description={description}
            maximumQuestions={attempt?.maximumQuestions ?? maximumQuestions}
            retakeCooldownDays={retakeCooldownDays}
            hasAttempt={
              attempt?.status === AdaptivePracticeQuizAttemptStatus.InProgress
            }
            previewOnly={previewOnly}
            loading={actionLoading}
            onStart={handleStart}
            onResume={handleResume}
            onRestart={handleRestart}
          />
        )}

      {attempt?.status === AdaptivePracticeQuizAttemptStatus.InProgress &&
        remainingSeconds !== null && (
          <div
            className="rounded border border-gray-200 px-4 py-3 text-sm"
            data-cy="adaptive-time-remaining"
          >
            <p className="font-semibold tabular-nums">
              {t('pwa.practiceQuiz.adaptive.question.remainingTime', {
                time: formatCountdown(remainingSeconds),
              })}
            </p>
            {expired && (
              <p>{t('pwa.practiceQuiz.adaptive.question.timeLimitReached')}</p>
            )}
            {expired && actionError && (
              <p role="alert">{t('pwa.practiceQuiz.adaptive.errors.resume')}</p>
            )}
          </div>
        )}
      {attempt?.status === AdaptivePracticeQuizAttemptStatus.InProgress &&
        !expired &&
        showQuestion &&
        attempt.servedItem && (
          <div className="space-y-4">
            {attempt.submittedResponseFeedback && (
              <UserNotification
                type={
                  attempt.submittedResponseFeedback.correct ? 'success' : 'info'
                }
                data={{ cy: 'adaptive-submitted-response-feedback' }}
              >
                <div className="space-y-1">
                  <div className="font-semibold">
                    {t(
                      `pwa.practiceQuiz.adaptive.feedback.${
                        attempt.submittedResponseFeedback.correct
                          ? 'correct'
                          : 'incorrect'
                      }`
                    )}
                  </div>
                  <div>
                    {t('pwa.practiceQuiz.adaptive.feedback.score', {
                      score: Math.round(
                        attempt.submittedResponseFeedback.score * 100
                      ),
                    })}
                  </div>
                  {attempt.submittedResponseFeedback.feedback.map(
                    (feedback, index) => (
                      <div key={`${index}-${feedback}`}>{feedback}</div>
                    )
                  )}
                </div>
              </UserNotification>
            )}
            <AdaptivePracticeQuizQuestion
              key={attempt.servedItem.poolItemId}
              item={attempt.servedItem}
              questionNumber={
                attempt.questionNumber ?? attempt.answeredQuestions + 1
              }
              answeredQuestions={attempt.answeredQuestions}
              maximumQuestions={attempt.maximumQuestions}
              elapsedSeconds={attempt.elapsedSeconds ?? null}
              showTimer={attempt.showTimer}
              submitting={submitting}
              submissionError={actionError === 'submit'}
              submissionBusy={actionError === 'submit' && actionBusy}
              onSubmit={handleSubmit}
            />
          </div>
        )}

      {attempt?.status === AdaptivePracticeQuizAttemptStatus.Completed && (
        <AdaptivePracticeQuizResult
          attemptId={attempt.attemptId}
          canStartNewAttempt={attempt.canStartNewAttempt}
          nextAttemptAvailableAt={attempt.nextAttemptAvailableAt}
          startingNewAttempt={starting}
          onStartNewAttempt={handleStart}
        />
      )}
    </PracticeQuizCard>
  )
}

export default AdaptivePracticeQuiz

function formatCountdown(seconds: number) {
  return [
    Math.floor(seconds / 3600),
    Math.floor(seconds / 60) % 60,
    seconds % 60,
  ]
    .map((part) => String(part).padStart(2, '0'))
    .join(':')
}

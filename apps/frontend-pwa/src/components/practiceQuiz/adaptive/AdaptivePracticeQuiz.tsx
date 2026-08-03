import { useMutation, useQuery } from '@apollo/client'
import {
  AdaptivePracticeQuizAttemptStatus,
  AdaptivePracticeQuizResponseInput,
  FAdaptivePracticeQuizAttemptStateFragment,
  MRestartAdaptivePracticeQuizAttemptDocument,
  MResumeAdaptivePracticeQuizAttemptDocument,
  MStartAdaptivePracticeQuizAttemptDocument,
  MSubmitAdaptivePracticeQuizResponseDocument,
  QAdaptivePracticeQuizAttemptStateDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import PreviewMessage from '../../common/PreviewMessage'
import AdaptivePracticeQuizIntro from './AdaptivePracticeQuizIntro'
import AdaptivePracticeQuizQuestion from './AdaptivePracticeQuizQuestion'
import AdaptivePracticeQuizResult from './AdaptivePracticeQuizResult'

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
  previewOnly = false,
  embedded = false,
  onProgressChange,
}: AdaptivePracticeQuizProps) {
  const t = useTranslations()
  const [attempt, setAttempt] =
    useState<FAdaptivePracticeQuizAttemptStateFragment | null>(null)
  const [showQuestion, setShowQuestion] = useState(false)
  const [actionError, setActionError] = useState<AdaptiveActionError | null>(
    null
  )
  const mutationStateApplied = useRef(false)

  const { data, loading, error, refetch } = useQuery(
    QAdaptivePracticeQuizAttemptStateDocument,
    {
      variables: { practiceQuizId },
      skip: previewOnly,
      fetchPolicy: 'network-only',
    }
  )
  const [startAttempt, { loading: starting }] = useMutation(
    MStartAdaptivePracticeQuizAttemptDocument
  )
  const [resumeAttempt, { loading: resuming }] = useMutation(
    MResumeAdaptivePracticeQuizAttemptDocument
  )
  const [restartAttempt, { loading: restarting }] = useMutation(
    MRestartAdaptivePracticeQuizAttemptDocument
  )
  const [submitResponse, { loading: submitting }] = useMutation(
    MSubmitAdaptivePracticeQuizResponseDocument
  )

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
    } catch {
      setActionError('start')
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
    } catch {
      setActionError('resume')
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
    } catch {
      setActionError('startOver')
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
    if (!attempt?.servedItem) return
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
    } catch {
      setActionError('submit')
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
    <div className="flex-1">
      <div
        className={`w-full space-y-5 md:mx-auto md:mb-4 md:max-w-6xl md:rounded md:p-8 md:pt-6 ${
          embedded ? '' : 'md:border'
        }`}
      >
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

        {actionError && actionError !== 'submit' && !showQuestion && (
          <UserNotification
            type="error"
            message={t(`pwa.practiceQuiz.adaptive.errors.${actionError}`)}
          />
        )}

        {(previewOnly || (!loading && !error)) &&
          attempt?.status !== AdaptivePracticeQuizAttemptStatus.Completed &&
          (!showQuestion || !attempt?.servedItem) && (
            <AdaptivePracticeQuizIntro
              displayName={displayName}
              description={description}
              maximumQuestions={attempt?.maximumQuestions ?? maximumQuestions}
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
          showQuestion &&
          attempt.servedItem && (
            <div className="space-y-4">
              {attempt.submittedResponseFeedback && (
                <UserNotification
                  type={
                    attempt.submittedResponseFeedback.correct
                      ? 'success'
                      : 'info'
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
                onSubmit={handleSubmit}
              />
            </div>
          )}

        {attempt?.status === AdaptivePracticeQuizAttemptStatus.Completed && (
          <AdaptivePracticeQuizResult
            attemptId={attempt.attemptId}
            canStartNewAttempt={attempt.canStartNewAttempt}
            startingNewAttempt={starting}
            onStartNewAttempt={handleStart}
          />
        )}
      </div>
    </div>
  )
}

export default AdaptivePracticeQuiz

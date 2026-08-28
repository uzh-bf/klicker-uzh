import { useLazyQuery, useMutation } from '@apollo/client'
import {
  DecideSemanticEvaluationConsentDocument,
  type ElementInstance,
  ElementType,
  FreeTextEvaluationStatus,
  SemanticFreeTextCapabilityV2Document,
} from '@klicker-uzh/graphql/dist/ops'
import StudentElement, {
  type StackStudentResponseType,
} from '@klicker-uzh/shared-components/src/StudentElement'
import { useTranslations } from 'next-intl'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'
import FreeTextRetryPanel from './FreeTextRetryPanel'
import SemanticEvaluationConsentModal from './SemanticEvaluationConsentModal'
import useFreeTextPracticeState from './useFreeTextPracticeState'

function runHandledAction(action: () => Promise<unknown>) {
  void action().catch(() => undefined)
}

function PracticeQuizElement({
  element,
  elementIx,
  studentResponse,
  setStudentResponse,
  stackStorage,
  semanticEnabled,
  preview,
}: {
  element: ElementInstance
  elementIx: number
  studentResponse: StackStudentResponseType
  setStudentResponse: Dispatch<SetStateAction<StackStudentResponseType>>
  stackStorage?: StackStudentResponseType
  semanticEnabled: boolean
  preview?: boolean
}) {
  const t = useTranslations()
  const evaluation = stackStorage?.[element.id]?.evaluation
  const initialState =
    evaluation?.__typename === 'FreeTextInstanceEvaluation'
      ? evaluation.semanticState
      : undefined
  const {
    state,
    loading,
    error,
    actionLoading,
    actionError,
    submitAnswer,
    retryEvaluation,
    revealSolution,
    startPracticeCycle,
  } = useFreeTextPracticeState({
    instanceId: element.id,
    enabled: semanticEnabled,
    initialState,
  })
  const [loadSemanticCapability, capabilityResult] = useLazyQuery(
    SemanticFreeTextCapabilityV2Document,
    { fetchPolicy: 'network-only' }
  )
  const [decideConsentMutation, consentResult] = useMutation(
    DecideSemanticEvaluationConsentDocument
  )
  const [consentRecoveryOpen, setConsentRecoveryOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const answerStartedAt = useRef(Date.now())
  const response = studentResponse[element.id]?.response
  const answer = typeof response === 'string' ? response : ''

  const setAnswer = useCallback(
    (value: string, valid: boolean) => {
      setStudentResponse((current) => ({
        ...current,
        [element.id]: {
          type: ElementType.FreeText,
          response: value,
          valid,
        },
      }))
    },
    [element.id, setStudentResponse]
  )

  const cycleId = state?.cycleId
  const currentAttemptId = state?.currentAttempt?.id
  const currentEvaluationStatus = state?.currentAttempt?.evaluationStatus
  const canSubmitAnswer = state?.canSubmitAnswer

  useEffect(() => {
    if (!cycleId) return

    if (!currentAttemptId && canSubmitAnswer) {
      answerStartedAt.current = Date.now()
      setAnswer('', false)
      setEditing(true)
    } else if (
      currentEvaluationStatus === FreeTextEvaluationStatus.Pending ||
      !canSubmitAnswer
    ) {
      setEditing(false)
    }
  }, [
    canSubmitAnswer,
    currentAttemptId,
    currentEvaluationStatus,
    cycleId,
    setAnswer,
  ])

  const beginRetry = () => {
    const previousAnswer = state?.currentAttempt?.answer ?? ''
    answerStartedAt.current = Date.now()
    setAnswer(previousAnswer, true)
    setEditing(true)
  }

  const submitImprovedAnswer = async () => {
    const valid = studentResponse[element.id]?.valid === true
    if (!valid || !answer.trim()) return

    try {
      await submitAnswer({
        answer,
        answerTime: (Date.now() - answerStartedAt.current) / 1000,
      })
    } finally {
      setEditing(false)
    }
  }

  const practiceAgain = async () => {
    setDetailsOpen(false)
    await startPracticeCycle()
  }

  const reviewConsent = async () => {
    const { data } = await loadSemanticCapability()
    if (data?.semanticFreeTextCapability) {
      setConsentRecoveryOpen(true)
    }
  }

  const decideRecoveryConsent = async (accepted: boolean) => {
    const capability = capabilityResult.data?.semanticFreeTextCapability
    if (!capability) return

    await decideConsentMutation({
      variables: {
        disclosureVersion: capability.disclosureVersion,
        accepted,
      },
      refetchQueries: [SemanticFreeTextCapabilityV2Document],
      awaitRefetchQueries: true,
    })
    setConsentRecoveryOpen(false)

    if (accepted) {
      await retryEvaluation()
    }
  }

  return (
    <>
      <StudentElement
        element={element}
        elementIx={elementIx}
        studentResponse={studentResponse}
        setStudentResponse={setStudentResponse}
        stackStorage={stackStorage}
        preview={preview}
        freeTextPracticeState={state}
        freeTextInputEditable={editing}
        showFreeTextSemanticDetails={detailsOpen}
      />

      {semanticEnabled && state && !preview && (
        <FreeTextRetryPanel
          state={state}
          editing={editing}
          detailsOpen={detailsOpen}
          answerChanged={
            studentResponse[element.id]?.valid === true &&
            answer.trim().length > 0 &&
            answer !== state.currentAttempt?.answer
          }
          loading={
            loading ||
            actionLoading ||
            capabilityResult.loading ||
            consentResult.loading
          }
          error={
            error ||
            actionError ||
            capabilityResult.error ||
            consentResult.error
          }
          onTryAgain={beginRetry}
          onSubmitAnswer={() => runHandledAction(submitImprovedAnswer)}
          onRetryEvaluation={() => runHandledAction(retryEvaluation)}
          onReviewConsent={() => runHandledAction(reviewConsent)}
          onRevealSolution={() => runHandledAction(revealSolution)}
          onToggleDetails={() => setDetailsOpen((open) => !open)}
          onPracticeAgain={() => runHandledAction(practiceAgain)}
        />
      )}
      {consentRecoveryOpen &&
        capabilityResult.data?.semanticFreeTextCapability && (
          <SemanticEvaluationConsentModal
            provider={capabilityResult.data.semanticFreeTextCapability.provider}
            disclosureVersion={
              capabilityResult.data.semanticFreeTextCapability.disclosureVersion
            }
            loading={consentResult.loading}
            error={!!consentResult.error}
            onAccept={() => runHandledAction(() => decideRecoveryConsent(true))}
            onDecline={() =>
              runHandledAction(() => decideRecoveryConsent(false))
            }
            acceptLabel={t('pwa.practiceQuiz.semanticConsentAcceptRetryAction')}
          />
        )}
    </>
  )
}

export default PracticeQuizElement

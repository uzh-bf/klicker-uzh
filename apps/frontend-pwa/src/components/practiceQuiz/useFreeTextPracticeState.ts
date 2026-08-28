import { useMutation, useQuery } from '@apollo/client'
import {
  FreeTextEvaluationStatus,
  type FreeTextPracticeStateDataFragment,
  FreeTextPracticeStateDocument,
  RetryFreeTextEvaluationDocument,
  RevealFreeTextSolutionDocument,
  StartFreeTextPracticeCycleDocument,
  SubmitFreeTextAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createFreeTextSubmissionId } from './createFreeTextSubmissionId'
import { preferLatestFreeTextPracticeState } from './freeTextPracticeStateOrder'

type SemanticState = FreeTextPracticeStateDataFragment | null

function useFreeTextPracticeState({
  instanceId,
  enabled,
  initialState,
}: {
  instanceId: number
  enabled: boolean
  initialState?: SemanticState
}) {
  const [state, setState] = useState<SemanticState>(
    initialState?.instanceId === instanceId ? initialState : null
  )
  const submissionRef = useRef<{ answer: string; id: string } | null>(null)
  const submissionInstanceIdRef = useRef(instanceId)
  const pending =
    state?.currentAttempt?.evaluationStatus === FreeTextEvaluationStatus.Pending

  const acceptState = useCallback(
    (incoming: SemanticState) => {
      setState((current) =>
        preferLatestFreeTextPracticeState(instanceId, current, incoming)
      )
    },
    [instanceId]
  )

  const { data, loading, error, refetch } = useQuery(
    FreeTextPracticeStateDocument,
    {
      variables: { instanceId },
      skip: !enabled,
      fetchPolicy: 'network-only',
      pollInterval: pending ? 1500 : 0,
      notifyOnNetworkStatusChange: true,
    }
  )
  const [submitMutation, submitResult] = useMutation(
    SubmitFreeTextAttemptDocument
  )
  const [retryMutation, retryResult] = useMutation(
    RetryFreeTextEvaluationDocument
  )
  const [revealMutation, revealResult] = useMutation(
    RevealFreeTextSolutionDocument
  )
  const [startMutation, startResult] = useMutation(
    StartFreeTextPracticeCycleDocument
  )
  useEffect(() => {
    if (submissionInstanceIdRef.current !== instanceId) {
      submissionRef.current = null
      submissionInstanceIdRef.current = instanceId
    }
  }, [instanceId])

  useEffect(() => {
    if (initialState !== undefined) {
      acceptState(initialState)
    }
  }, [acceptState, initialState])

  useEffect(() => {
    const incomingState = data?.freeTextPracticeState
    if (incomingState !== undefined) {
      acceptState(incomingState)
    }
  }, [acceptState, data])

  const currentAttemptId = state?.currentAttempt?.id
  const cycleId = state?.cycleId

  const submitAnswer = useCallback(
    async ({ answer, answerTime }: { answer: string; answerTime: number }) => {
      if (submissionRef.current?.answer !== answer) {
        submissionRef.current = {
          answer,
          id: createFreeTextSubmissionId(),
        }
      }

      const result = await submitMutation({
        variables: {
          instanceId,
          answer,
          answerTime,
          clientSubmissionId: submissionRef.current.id,
        },
      })
      const nextState = result.data?.submitFreeTextAttempt
      if (nextState) {
        acceptState(nextState)
      }
      return nextState ?? null
    },
    [acceptState, instanceId, submitMutation]
  )

  const retryEvaluation = useCallback(async () => {
    if (!currentAttemptId) return null

    const result = await retryMutation({
      variables: { attemptId: currentAttemptId },
    })
    const nextState = result.data?.retryFreeTextEvaluation
    if (nextState) {
      acceptState(nextState)
    }
    return nextState ?? null
  }, [acceptState, currentAttemptId, retryMutation])

  const revealSolution = useCallback(async () => {
    if (!cycleId) return null

    const result = await revealMutation({
      variables: { cycleId },
    })
    const nextState = result.data?.revealFreeTextSolution
    if (nextState) {
      acceptState(nextState)
    }
    return nextState ?? null
  }, [acceptState, cycleId, revealMutation])

  const startPracticeCycle = useCallback(async () => {
    const result = await startMutation({ variables: { instanceId } })
    const nextState = result.data?.startFreeTextPracticeCycle
    if (nextState) {
      submissionRef.current = null
      acceptState(nextState)
    }
    return nextState ?? null
  }, [acceptState, instanceId, startMutation])

  const refresh = useCallback(async () => {
    if (!enabled) return null
    const refreshed = await refetch()
    const nextState = refreshed.data.freeTextPracticeState ?? null
    acceptState(nextState)
    return nextState
  }, [acceptState, enabled, refetch])

  return {
    state,
    loading: loading && state === null,
    error,
    actionLoading:
      submitResult.loading ||
      retryResult.loading ||
      revealResult.loading ||
      startResult.loading,
    actionError:
      submitResult.error ||
      retryResult.error ||
      revealResult.error ||
      startResult.error,
    submitAnswer,
    retryEvaluation,
    revealSolution,
    startPracticeCycle,
    refresh,
  }
}

export default useFreeTextPracticeState

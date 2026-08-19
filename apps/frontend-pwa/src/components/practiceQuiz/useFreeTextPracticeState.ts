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

type SemanticState = FreeTextPracticeStateDataFragment | null

const CYCLE_STATUS_RANK: Record<string, number> = {
  ACTIVE: 0,
  CORRECT: 1,
  EXHAUSTED: 1,
  SOLUTION_REVEALED: 1,
}

const EVALUATION_STATUS_RANK: Record<string, number> = {
  PENDING: 0,
  UNAVAILABLE: 1,
  EVALUATED: 1,
}

function preferLatestState(
  current: SemanticState,
  incoming: SemanticState
): SemanticState {
  if (!incoming) return current
  if (!current) return incoming
  if (incoming.cycleOrdinal !== current.cycleOrdinal) {
    return incoming.cycleOrdinal > current.cycleOrdinal ? incoming : current
  }

  const incomingAttempt = incoming.currentAttempt
  const currentAttempt = current.currentAttempt
  if ((incomingAttempt?.ordinal ?? 0) !== (currentAttempt?.ordinal ?? 0)) {
    return (incomingAttempt?.ordinal ?? 0) > (currentAttempt?.ordinal ?? 0)
      ? incoming
      : current
  }
  if (
    (incomingAttempt?.evaluationRevision ?? 0) !==
    (currentAttempt?.evaluationRevision ?? 0)
  ) {
    return (incomingAttempt?.evaluationRevision ?? 0) >
      (currentAttempt?.evaluationRevision ?? 0)
      ? incoming
      : current
  }

  const incomingCycleRank = CYCLE_STATUS_RANK[incoming.cycleStatus] ?? 0
  const currentCycleRank = CYCLE_STATUS_RANK[current.cycleStatus] ?? 0
  if (incomingCycleRank !== currentCycleRank) {
    return incomingCycleRank > currentCycleRank ? incoming : current
  }
  const incomingEvaluationRank = incomingAttempt
    ? (EVALUATION_STATUS_RANK[incomingAttempt.evaluationStatus] ?? 0)
    : 0
  const currentEvaluationRank = currentAttempt
    ? (EVALUATION_STATUS_RANK[currentAttempt.evaluationStatus] ?? 0)
    : 0
  return incomingEvaluationRank >= currentEvaluationRank ? incoming : current
}

function createSubmissionId() {
  if (typeof globalThis.crypto?.randomUUID !== 'function') {
    throw new Error('This browser cannot create a secure submission ID')
  }

  return globalThis.crypto.randomUUID()
}

function useFreeTextPracticeState({
  instanceId,
  enabled,
  initialState,
}: {
  instanceId: number
  enabled: boolean
  initialState?: SemanticState
}) {
  const [state, setState] = useState<SemanticState>(initialState ?? null)
  const submissionRef = useRef<{ answer: string; id: string } | null>(null)
  const pending =
    state?.currentAttempt?.evaluationStatus === FreeTextEvaluationStatus.Pending

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
    if (initialState !== undefined) {
      setState((current) => preferLatestState(current, initialState))
    }
  }, [initialState])

  useEffect(() => {
    const incomingState = data?.freeTextPracticeState
    if (incomingState !== undefined) {
      setState((current) => preferLatestState(current, incomingState))
    }
  }, [data])

  const currentAttemptId = state?.currentAttempt?.id
  const cycleId = state?.cycleId

  const submitAnswer = useCallback(
    async ({ answer, answerTime }: { answer: string; answerTime: number }) => {
      if (submissionRef.current?.answer !== answer) {
        submissionRef.current = { answer, id: createSubmissionId() }
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
        setState((current) => preferLatestState(current, nextState))
      }
      return nextState ?? null
    },
    [instanceId, submitMutation]
  )

  const retryEvaluation = useCallback(async () => {
    if (!currentAttemptId) return null

    const result = await retryMutation({
      variables: { attemptId: currentAttemptId },
    })
    const nextState = result.data?.retryFreeTextEvaluation
    if (nextState) {
      setState((current) => preferLatestState(current, nextState))
    }
    return nextState ?? null
  }, [currentAttemptId, retryMutation])

  const revealSolution = useCallback(async () => {
    if (!cycleId) return null

    const result = await revealMutation({
      variables: { cycleId },
    })
    const nextState = result.data?.revealFreeTextSolution
    if (nextState) {
      setState((current) => preferLatestState(current, nextState))
    }
    return nextState ?? null
  }, [cycleId, revealMutation])

  const startPracticeCycle = useCallback(async () => {
    const result = await startMutation({ variables: { instanceId } })
    const nextState = result.data?.startFreeTextPracticeCycle
    if (nextState) {
      submissionRef.current = null
      setState((current) => preferLatestState(current, nextState))
    }
    return nextState ?? null
  }, [instanceId, startMutation])

  const refresh = useCallback(async () => {
    if (!enabled) return null
    const refreshed = await refetch()
    const nextState = refreshed.data.freeTextPracticeState ?? null
    setState((current) => preferLatestState(current, nextState))
    return nextState
  }, [enabled, refetch])

  return {
    state,
    loading,
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

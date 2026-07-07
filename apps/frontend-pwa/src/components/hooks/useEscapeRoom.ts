import { useMutation } from '@apollo/client'
import {
  EscapeRoomStatus,
  ResetEscapeRoomAttemptDocument,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect, useState } from 'react'

export function useEscapeRoom({
  activity,
  activityType,
  refetch,
}: {
  activity: any
  activityType: 'practiceQuiz' | 'microLearning' | 'groupActivity'
  refetch: () => void
}) {
  const [startAttemptMutation, { loading: starting }] = useMutation(
    StartEscapeRoomAttemptDocument
  )
  const [resetAttemptMutation, { loading: resetting }] = useMutation(
    ResetEscapeRoomAttemptDocument
  )

  const attempts = activity?.escapeRoomAttempts ?? []
  const attempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const isEscapeRoom = !!activity?.escapeRoomConfig
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)

  const startAttempt = async () => {
    const variables: Record<string, string> = {}
    if (activityType === 'practiceQuiz') {
      variables.practiceQuizId = activity.id
    } else if (activityType === 'microLearning') {
      variables.microLearningId = activity.id
    } else if (activityType === 'groupActivity') {
      variables.groupActivityId = activity.id
    }

    await startAttemptMutation({ variables })
    await refetch()
  }

  const resetAttempt = async () => {
    const variables: Record<string, string> = {}
    if (activityType === 'practiceQuiz') {
      variables.practiceQuizId = activity.id
    } else if (activityType === 'microLearning') {
      variables.microLearningId = activity.id
    } else if (activityType === 'groupActivity') {
      variables.groupActivityId = activity.id
    }

    await resetAttemptMutation({ variables })
    await refetch()
  }

  useEffect(() => {
    if (
      !isEscapeRoom ||
      !attempt ||
      attempt.status !== EscapeRoomStatus.InProgress
    ) {
      setRemainingSeconds(null)
      return
    }

    const calculateRemaining = () => {
      const started = new Date(attempt.startedAt).getTime()
      const limit = attempt.timeLimit
      const penalty = attempt.penaltySeconds
      const deadline = started + (limit - penalty) * 1000
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemainingSeconds(remaining)

      if (remaining <= 0) {
        // If expired locally, trigger refetch to update status on server/client
        refetch()
      }
    }

    calculateRemaining()
    const interval = setInterval(calculateRemaining, 1000)

    return () => clearInterval(interval)
  }, [isEscapeRoom, attempt, refetch])

  const isStarted = !!attempt
  const isCompleted = attempt?.status === EscapeRoomStatus.Completed
  const isExpired =
    attempt?.status === EscapeRoomStatus.Expired ||
    (attempt?.status === EscapeRoomStatus.InProgress &&
      remainingSeconds !== null &&
      remainingSeconds <= 0)

  return {
    attempt,
    isStarted,
    isCompleted,
    isExpired,
    remainingSeconds,
    startAttempt,
    resetAttempt,
    loading: starting || resetting,
  }
}

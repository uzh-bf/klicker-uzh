import { useMutation } from '@apollo/client'
import {
  EscapeRoomStatus,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect, useRef, useState } from 'react'

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

  const attempts = activity?.escapeRoomAttempts ?? []
  const attempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const isEscapeRoom = !!activity?.escapeRoomConfig
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  // Guard so the expiry refetch fires exactly once per attempt, not every tick.
  const expiryHandledRef = useRef(false)

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

  useEffect(() => {
    if (
      !isEscapeRoom ||
      !attempt ||
      attempt.status !== EscapeRoomStatus.InProgress
    ) {
      setRemainingSeconds(null)
      return
    }

    // Fresh in-progress attempt: allow one expiry refetch again.
    expiryHandledRef.current = false

    const calculateRemaining = () => {
      const started = new Date(attempt.startedAt).getTime()
      const limit = attempt.timeLimit
      const penalty = attempt.penaltySeconds
      const deadline = started + (limit - penalty) * 1000
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setRemainingSeconds(remaining)

      // On local expiry, refetch ONCE to sync the server-side status; without
      // the guard this fired every second while status stayed InProgress.
      if (remaining <= 0 && !expiryHandledRef.current) {
        expiryHandledRef.current = true
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
    loading: starting,
  }
}

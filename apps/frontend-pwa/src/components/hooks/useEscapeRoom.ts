import { useMutation } from '@apollo/client'
import {
  EscapeRoomAttempt,
  EscapeRoomStatus,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useEffect, useRef, useState } from 'react'

// Minimal shape the hook actually reads off an escape-room-capable activity.
// Pick ties the attempt fields to the generated schema so a rename breaks here.
type EscapeRoomActivityInput = {
  id: string
  escapeRoomConfig?: unknown
  escapeRoomAttempts?: Array<
    Pick<
      EscapeRoomAttempt,
      // fields the hook reads directly ...
      | 'id'
      | 'status'
      | 'remainingSeconds'
      | 'expiresInSeconds'
      // ... plus the stats the returned attempt feeds into EscapeRoomOverlay
      | 'startedAt'
      | 'completedAt'
      | 'penaltySeconds'
      | 'hintsUsed'
    >
  > | null
}

export function useEscapeRoom({
  activity,
  activityType,
  refetch,
}: {
  activity: EscapeRoomActivityInput | null | undefined
  activityType: 'practiceQuiz' | 'microLearning'
  refetch: () => Promise<unknown>
}) {
  const [startAttemptMutation, { loading: starting }] = useMutation(
    StartEscapeRoomAttemptDocument
  )

  const attempts = activity?.escapeRoomAttempts ?? []
  const attempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const isEscapeRoom = !!activity?.escapeRoomConfig
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
  // Guard so the expiry refetch fires exactly once per attempt, not every tick.
  const expiryHandledAttemptIdRef = useRef<string | null>(null)

  const startAttempt = async () => {
    if (!activity) return
    const variables: Record<string, string> = {}
    if (activityType === 'practiceQuiz') {
      variables.practiceQuizId = activity.id
    } else {
      variables.microLearningId = activity.id
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
      setExpiresInSeconds(null)
      return
    }

    // The server supplies the authoritative remaining duration. Animate from
    // that snapshot with a monotonic clock so client wall-clock skew/changes
    // cannot add or remove time between refetches.
    const receivedAt = performance.now()
    const calculateRemaining = () => {
      const elapsed = (performance.now() - receivedAt) / 1000
      const remaining = Math.max(
        0,
        Math.ceil(attempt.remainingSeconds - elapsed)
      )
      const expiresIn = Math.max(
        0,
        Math.ceil(attempt.expiresInSeconds - elapsed)
      )
      setRemainingSeconds(remaining)
      setExpiresInSeconds(expiresIn)

      // On local expiry, refetch ONCE to sync the server-side status; without
      // the guard this fired every second while status stayed InProgress.
      if (expiresIn <= 0 && expiryHandledAttemptIdRef.current !== attempt.id) {
        expiryHandledAttemptIdRef.current = attempt.id
        void refetch()
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
      expiresInSeconds !== null &&
      expiresInSeconds <= 0)

  return {
    attempt,
    isStarted,
    isCompleted,
    isExpired,
    remainingSeconds,
    startAttempt,
    loading: starting,
    refetch,
  }
}

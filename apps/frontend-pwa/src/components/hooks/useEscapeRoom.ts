import { useMutation, useQuery } from '@apollo/client'
import {
  EscapeRoomAttempt,
  EscapeRoomSessionPhase,
  EscapeRoomStatus,
  GetEscapeRoomSessionPhaseDocument,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { getEscapeRoomLockoutRemainingSeconds } from '@lib/escapeRoomLockout'
import { useEffect, useRef, useState } from 'react'

// How often a group in a session-clock escape room asks for the session phase.
const SESSION_PHASE_POLL_MS = 3000

// Minimal shape the hook actually reads off an escape-room-capable activity.
// Pick ties the attempt fields to the generated schema so a rename breaks here.
type EscapeRoomActivityInput = {
  id: string
  escapeRoomConfig?: {
    bonusSeconds?: number | null
    lockoutSeconds?: number | null
    // Group Activity session clock; the stored phase is the fallback until the
    // first poll answers.
    sessionClock?: boolean
    sessionPhase?: EscapeRoomSessionPhase
  } | null
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
      | 'timeLimit'
      | 'lockoutUntil'
      | 'completedAt'
      | 'penaltySeconds'
      | 'hintsUsed'
      | 'stageOutcomes'
    > &
      // selected by the Group Activity details only
      Partial<
        Pick<EscapeRoomAttempt, 'lockoutRemainingSeconds' | 'sessionPhase'>
      >
  > | null
}

// A stage with an outcome (solved, revealed, skipped or bonus answered) is
// cleared. Stage keys are the stack id in Practice Quiz and Microlearning and
// the element instance id in Group Activity.
export function getStageOutcome(
  attempt: Pick<EscapeRoomAttempt, 'stageOutcomes'> | null | undefined,
  stageKey: string | number
) {
  return attempt?.stageOutcomes?.find(
    (entry) => entry.stageKey === String(stageKey)
  )
}

export function isStageCleared(
  attempt: Pick<EscapeRoomAttempt, 'stageOutcomes'> | null | undefined,
  stageKey: string | number
) {
  return !!getStageOutcome(attempt, stageKey)?.outcome
}

// The last stage is the bonus stage when the rules grant bonus time. It is not
// a required stage and only becomes answerable once the attempt is completed.
export function hasBonusStage(
  config: { bonusSeconds?: number | null } | null | undefined,
  numOfStages: number
) {
  return config?.bonusSeconds != null && numOfStages > 1
}

// Scoring rules and stage state that ElementStack needs for one stack. Skipping
// is only offered while the attempt runs and never on the bonus stage, and the
// bonus stage has no wrong-attempt limit.
export function getEscapeRoomStageRules({
  config,
  attempt,
  stageKey,
  isBonusStage,
}: {
  config: {
    hintPenalties: number[]
    maxWrongAttempts?: number | null
    revealPenalty: number
    skipPenalty?: number | null
  }
  attempt:
    | Pick<EscapeRoomAttempt, 'status' | 'stageOutcomes'>
    | null
    | undefined
  stageKey: string | number
  isBonusStage: boolean
}) {
  return {
    hintPenalties: config.hintPenalties,
    maxWrongAttempts: isBonusStage ? null : (config.maxWrongAttempts ?? null),
    revealPenalty: config.revealPenalty,
    skipPenalty:
      isBonusStage || attempt?.status !== EscapeRoomStatus.InProgress
        ? null
        : (config.skipPenalty ?? null),
    stageOutcome: getStageOutcome(attempt, stageKey),
  }
}

export function useEscapeRoom({
  activity,
  activityType,
  groupId,
  refetch,
}: {
  activity: EscapeRoomActivityInput | null | undefined
  activityType: 'practiceQuiz' | 'microLearning' | 'groupActivity'
  groupId?: string
  refetch: () => Promise<unknown>
}) {
  const [startAttemptMutation, { loading: starting }] = useMutation(
    StartEscapeRoomAttemptDocument
  )

  const attempts = activity?.escapeRoomAttempts ?? []
  const attempt = attempts.length > 0 ? attempts[attempts.length - 1] : null

  const isEscapeRoom = !!activity?.escapeRoomConfig
  const isGroup = activityType === 'groupActivity'
  const hasSessionClock =
    isGroup && !!groupId && !!activity?.escapeRoomConfig?.sessionClock
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  // Guard so the expiry refetch fires exactly once per attempt, not every tick.
  const expiryHandledAttemptIdRef = useRef<string | null>(null)

  // Cheap phase poll for the lobby and pauses; the full activity details are
  // refetched only when the phase changes. Null without a session clock.
  const { data: phaseData, stopPolling } = useQuery(
    GetEscapeRoomSessionPhaseDocument,
    {
      variables: {
        groupActivityId: activity?.id ?? '',
        groupId: groupId ?? '',
      },
      skip: !hasSessionClock || !activity,
      pollInterval: SESSION_PHASE_POLL_MS,
      fetchPolicy: 'network-only',
    }
  )
  const detailsPhase =
    attempt?.sessionPhase ?? activity?.escapeRoomConfig?.sessionPhase ?? null
  const polledPhase = hasSessionClock
    ? (phaseData?.escapeRoomSessionPhase ?? null)
    : null
  const sessionPhase: EscapeRoomSessionPhase | null = hasSessionClock
    ? (polledPhase ?? detailsPhase)
    : null
  const knownPhaseRef = useRef<EscapeRoomSessionPhase | null>(null)
  useEffect(() => {
    if (!polledPhase) return
    const known = knownPhaseRef.current ?? detailsPhase
    knownPhaseRef.current = polledPhase
    if (known && known !== polledPhase) void refetch()
    // the end is final, so nothing is left to poll for
    if (polledPhase === EscapeRoomSessionPhase.Ended) stopPolling()
  }, [polledPhase, detailsPhase, refetch, stopPolling])

  // The countdown only advances while the session runs; without a session
  // clock it always does.
  const clockAdvances =
    !hasSessionClock || sessionPhase === EscapeRoomSessionPhase.Running

  const startAttempt = async () => {
    if (!activity) return
    const variables: Record<string, string> = {}
    if (activityType === 'practiceQuiz') {
      variables.practiceQuizId = activity.id
    } else if (activityType === 'microLearning') {
      variables.microLearningId = activity.id
    } else {
      if (!groupId) {
        throw new Error('A group ID is required to start a group escape room')
      }
      variables.groupActivityId = activity.id
      variables.groupId = groupId
    }

    await startAttemptMutation({ variables })
    await refetch()
  }

  useEffect(() => {
    // A completed attempt keeps its clock while a bonus stage can still be
    // answered.
    const clockRuns =
      attempt?.status === EscapeRoomStatus.InProgress ||
      (attempt?.status === EscapeRoomStatus.Completed &&
        activity?.escapeRoomConfig?.bonusSeconds != null)
    if (!isEscapeRoom || !attempt || !clockRuns) {
      setRemainingSeconds(null)
      setExpiresInSeconds(null)
      setLockoutRemaining(0)
      return
    }

    // The server supplies the authoritative remaining duration. Animate from
    // that snapshot with a monotonic clock so client wall-clock skew/changes
    // cannot add or remove time between refetches.
    const receivedAt = performance.now()
    const calculateRemaining = () => {
      const elapsed = clockAdvances
        ? (performance.now() - receivedAt) / 1000
        : 0
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
      // the lockout comes from the same server snapshot, never the device clock
      setLockoutRemaining(
        isGroup && typeof attempt.lockoutRemainingSeconds === 'number'
          ? Math.max(0, Math.ceil(attempt.lockoutRemainingSeconds - elapsed))
          : getEscapeRoomLockoutRemainingSeconds({
              lockoutUntil: attempt.lockoutUntil,
              startedAt: attempt.startedAt,
              timeLimit: attempt.timeLimit,
              remainingSeconds: attempt.remainingSeconds,
              lockoutSeconds: activity?.escapeRoomConfig?.lockoutSeconds ?? 0,
              receivedAtMs: receivedAt,
              nowMs: performance.now(),
            })
      )

      // On local expiry, refetch ONCE to sync the server-side status; without
      // the guard this fired every second while status stayed InProgress.
      if (
        clockAdvances &&
        expiresIn <= 0 &&
        expiryHandledAttemptIdRef.current !== attempt.id
      ) {
        expiryHandledAttemptIdRef.current = attempt.id
        void refetch()
      }
    }

    calculateRemaining()
    if (!clockAdvances) return

    const interval = setInterval(calculateRemaining, 1000)

    return () => clearInterval(interval)
  }, [
    isEscapeRoom,
    isGroup,
    clockAdvances,
    attempt,
    activity?.escapeRoomConfig?.bonusSeconds,
    activity?.escapeRoomConfig?.lockoutSeconds,
    refetch,
  ])

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
    lockoutRemaining,
    sessionPhase,
    startAttempt,
    loading: starting,
    refetch,
  }
}

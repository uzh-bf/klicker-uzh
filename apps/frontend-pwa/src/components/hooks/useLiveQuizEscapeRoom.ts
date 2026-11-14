import { ApolloError, useMutation } from '@apollo/client'
import { formatDuration } from '@components/practiceQuiz/EscapeRoomOverlay'
import {
  ElementInstance,
  EscapeRoomAttempt,
  EscapeRoomStatus,
  RequestEscapeRoomHintDocument,
  SkipEscapeRoomStageDocument,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { getEscapeRoomLockoutRemainingSeconds } from '@lib/escapeRoomLockout'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

export type LiveQuizEscapeRoomAttempt = Pick<
  EscapeRoomAttempt,
  | 'id'
  | 'startedAt'
  | 'timeLimit'
  | 'penaltySeconds'
  | 'remainingSeconds'
  | 'expiresInSeconds'
  | 'hintsUsed'
  | 'status'
  | 'lockoutUntil'
  | 'completedAt'
  | 'stageOutcomes'
>

// The escape room fields of the Response API answer
export type LiveQuizEscapeRoomResponse = {
  completed?: boolean
  lockoutUntil?: string
  // null when the tries are unlimited or the stage is cleared
  attemptsLeft?: number | null
  revealed?: boolean
  revealedSolution?: unknown
  penaltySeconds?: number
  bonus?: 'correct' | 'wrong' | null
}

// Rules of the block's escape room as selected for the student
export type LiveQuizEscapeRoomConfig = {
  timeLimit: number
  hintPenalty: number
  hintPenalties: number[]
  lockoutSeconds: number
  wrongAnswerPenalty?: number | null
  maxWrongAttempts?: number | null
  revealPenalty?: number | null
  skipPenalty?: number | null
  bonusSeconds?: number | null
  introText?: string | null
}

const BONUS_OUTCOMES = ['BONUS_CORRECT', 'BONUS_WRONG']

function getRevealedHintMap(instances: ElementInstance[]) {
  return Object.fromEntries(
    instances.flatMap((instance) => {
      const hints =
        instance.revealedHints ??
        (instance.revealedHint ? [instance.revealedHint] : [])
      return hints.length > 0 ? [[instance.id, hints] as const] : []
    })
  )
}

export function useLiveQuizEscapeRoom({
  blockId,
  config,
  initialAttempt,
  instances,
  currentInstance,
  refetch,
}: {
  blockId?: number
  config?: LiveQuizEscapeRoomConfig | null
  initialAttempt?: LiveQuizEscapeRoomAttempt | null
  instances: ElementInstance[]
  currentInstance?: ElementInstance
  refetch?: () => Promise<unknown>
}) {
  const t = useTranslations()
  const [startMutation, { loading: starting }] = useMutation(
    StartEscapeRoomAttemptDocument
  )
  const [hintMutation, { loading: requestingHint }] = useMutation(
    RequestEscapeRoomHintDocument
  )
  const [skipMutation, { loading: skipping }] = useMutation(
    SkipEscapeRoomStageDocument
  )
  const [attempt, setAttempt] = useState(initialAttempt ?? null)
  const [isCompleted, setIsCompleted] = useState(
    initialAttempt?.status === EscapeRoomStatus.Completed
  )
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const [revealedHints, setRevealedHints] = useState<Record<number, string[]>>(
    getRevealedHintMap(instances)
  )
  // Tries left after the latest wrong answer, kept for the stage it applies to
  const [triesLeft, setTriesLeft] = useState<{
    instanceId: number
    count: number
  } | null>(null)
  // A reveal holds the stage on screen until the student moves on, so the
  // solution can be read before the next stage or the ending replaces it.
  const [reveal, setReveal] = useState<{
    instanceId: number
    solution: unknown
  } | null>(null)
  const [bonusResult, setBonusResult] = useState<string | null>(null)
  const serverAttemptProjection = initialAttempt
    ? [
        initialAttempt.id,
        initialAttempt.status,
        initialAttempt.remainingSeconds,
        initialAttempt.expiresInSeconds,
        initialAttempt.penaltySeconds,
        initialAttempt.lockoutUntil,
        initialAttempt.completedAt,
        initialAttempt.hintsUsed.join(','),
        initialAttempt.stageOutcomes
          .map(
            (entry) =>
              `${entry.stageKey}:${entry.outcome}:${entry.wrongAttempts}`
          )
          .join(','),
      ].join('|')
    : ''
  const serverAttemptProjectionRef = useRef(serverAttemptProjection)
  const expiryHandledAttemptIdRef = useRef<string | null>(null)
  const revealedHintProjection = instances
    .map(
      (instance) =>
        `${instance.id}:${(instance.revealedHints ?? []).join(',')}:${instance.revealedHint ?? ''}`
    )
    .join('|')

  useEffect(() => {
    if (serverAttemptProjectionRef.current === serverAttemptProjection) return

    serverAttemptProjectionRef.current = serverAttemptProjection
    setAttempt(initialAttempt ?? null)
    setIsCompleted(initialAttempt?.status === EscapeRoomStatus.Completed)
    setLockoutRemaining(0)
  }, [initialAttempt, serverAttemptProjection])

  useEffect(() => {
    setRevealedHints(getRevealedHintMap(instances))
  }, [instances, revealedHintProjection])

  useEffect(() => {
    if (!config || !attempt || attempt.status !== EscapeRoomStatus.InProgress) {
      setRemainingSeconds(null)
      setExpiresInSeconds(null)
      return
    }

    const receivedAt = performance.now()
    const tick = () => {
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
      // derived from the server snapshot, never the device clock
      setLockoutRemaining(
        getEscapeRoomLockoutRemainingSeconds({
          lockoutUntil: attempt.lockoutUntil,
          startedAt: attempt.startedAt,
          timeLimit: attempt.timeLimit,
          remainingSeconds: attempt.remainingSeconds,
          lockoutSeconds: config.lockoutSeconds ?? 0,
          receivedAtMs: receivedAt,
          nowMs: performance.now(),
        })
      )
      if (expiresIn <= 0 && expiryHandledAttemptIdRef.current !== attempt.id) {
        expiryHandledAttemptIdRef.current = attempt.id
        void refetch?.()
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [attempt, config, refetch])

  const startAttempt = useCallback(async () => {
    if (!blockId) return
    try {
      const result = await startMutation({
        variables: { elementBlockId: blockId },
      })
      if (result.data?.startEscapeRoomAttempt) {
        await refetch?.()
        setAttempt(result.data.startEscapeRoomAttempt)
        setIsCompleted(false)
      }
    } catch {
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
    }
  }, [blockId, refetch, startMutation, t])

  const requestHint = useCallback(async () => {
    if (!blockId || !currentInstance) return
    try {
      const result = await hintMutation({
        variables: { elementBlockId: blockId, instanceId: currentInstance.id },
      })
      const payload = result.data?.requestEscapeRoomHint
      if (!payload) return
      setRevealedHints((current) => ({
        ...current,
        [currentInstance.id]: payload.hints,
      }))
      setAttempt(payload.attempt)
    } catch {
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
    }
  }, [blockId, currentInstance, hintMutation, t])

  const skipPenalty = config?.skipPenalty ?? 0
  const skipStage = useCallback(async () => {
    if (!blockId) return
    try {
      const result = await skipMutation({
        variables: { elementBlockId: blockId },
      })
      const skipped = result.data?.skipEscapeRoomStage
      if (!skipped) return
      setAttempt(skipped)
      setTriesLeft(null)
      if (skipped.status === EscapeRoomStatus.Completed) setIsCompleted(true)
      toast({
        message: t('pwa.practiceQuiz.escapeRoomSkippedToast', {
          duration: formatDuration(skipPenalty, t),
        }),
        type: 'warning',
      })
      await refetch?.()
    } catch (error) {
      const code = (error instanceof ApolloError ? error.graphQLErrors : [])
        .map((err) => err.extensions?.code)
        .find((value) => typeof value === 'string')
      toast({
        message:
          code === 'ESCAPE_ROOM_SKIP_DISABLED'
            ? t('pwa.practiceQuiz.escapeRoomSkipDisabledToast')
            : code === 'ESCAPE_ROOM_EXPIRED'
              ? t('pwa.practiceQuiz.escapeRoomExpiredToast')
              : code === 'ESCAPE_ROOM_GATED'
                ? t('pwa.practiceQuiz.escapeRoomGatedToast')
                : t('shared.generic.systemError'),
        type: 'error',
      })
    }
  }, [blockId, skipPenalty, refetch, skipMutation, t])

  // Leaves a revealed stage once the student has read the solution
  const continueAfterReveal = useCallback(async () => {
    await refetch?.()
    setReveal(null)
    setTriesLeft(null)
  }, [refetch])

  const lockoutSeconds = config?.lockoutSeconds ?? 0
  const onResponse = useCallback(
    (result: LiveQuizEscapeRoomResponse, instanceId?: number) => {
      if (result.completed) setIsCompleted(true)
      if (instanceId !== undefined) {
        if (result.revealed) {
          setReveal({ instanceId, solution: result.revealedSolution ?? null })
        } else if (typeof result.attemptsLeft === 'number') {
          setTriesLeft({ instanceId, count: result.attemptsLeft })
        }
      }
      if (result.bonus) {
        setBonusResult(
          result.bonus === 'correct' ? 'BONUS_CORRECT' : 'BONUS_WRONG'
        )
      }
      const penaltySeconds = result.penaltySeconds
      if (typeof penaltySeconds === 'number') {
        setAttempt((current) =>
          current && current.penaltySeconds !== penaltySeconds
            ? { ...current, penaltySeconds }
            : current
        )
      }
      if (!result.lockoutUntil) return

      // The lockout starts when the server grades the answer, so the server
      // clock stood at lockoutUntil minus the lockout length. Moving the
      // snapshot there keeps the countdown exact without a refetch.
      const serverNowMs =
        new Date(result.lockoutUntil).getTime() - lockoutSeconds * 1000
      setAttempt((current) => {
        // a rejected resubmit returns the running lockout, which says nothing
        // about the current server time
        if (!current || current.lockoutUntil === result.lockoutUntil) {
          return current
        }
        const remainingSeconds = Math.max(
          0,
          Math.ceil(
            current.timeLimit -
              (serverNowMs - new Date(current.startedAt).getTime()) / 1000
          )
        )
        return {
          ...current,
          lockoutUntil: result.lockoutUntil,
          remainingSeconds,
          // the expiry clock restarts with the snapshot, so it moves along
          expiresInSeconds:
            remainingSeconds +
            (current.expiresInSeconds - current.remainingSeconds),
        }
      })
    },
    [lockoutSeconds]
  )

  const attemptBonusOutcome =
    attempt?.stageOutcomes.find((entry) =>
      BONUS_OUTCOMES.includes(entry.outcome ?? '')
    )?.outcome ?? null
  const bonusOutcome = attemptBonusOutcome ?? bonusResult
  const bonusPending =
    config?.bonusSeconds != null &&
    (isCompleted || attempt?.status === EscapeRoomStatus.Completed) &&
    !bonusOutcome
  const currentOutcome = currentInstance
    ? attempt?.stageOutcomes.find(
        (entry) => entry.stageKey === String(currentInstance.id)
      )
    : undefined
  // the answer feedback of the stage on screen, if any
  const currentTriesLeft =
    triesLeft && triesLeft.instanceId === currentInstance?.id
      ? triesLeft.count
      : null

  return {
    attempt,
    // the ending waits for a held reveal
    isCompleted: isCompleted && !reveal,
    reveal: reveal && reveal.instanceId === currentInstance?.id ? reveal : null,
    bonusOutcome,
    bonusPending,
    wrongAttempts: currentOutcome?.wrongAttempts ?? 0,
    triesLeft: currentTriesLeft,
    skipping,
    skipStage,
    continueAfterReveal,
    isExpired:
      attempt?.status === EscapeRoomStatus.Expired ||
      (attempt?.status === EscapeRoomStatus.InProgress &&
        expiresInSeconds !== null &&
        expiresInSeconds <= 0),
    remainingSeconds,
    lockoutRemaining,
    revealedHints,
    starting,
    requestingHint,
    startAttempt,
    requestHint,
    onResponse,
  }
}

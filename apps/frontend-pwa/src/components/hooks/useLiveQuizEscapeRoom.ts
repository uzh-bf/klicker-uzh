import { useMutation } from '@apollo/client'
import {
  ElementInstance,
  EscapeRoomAttempt,
  EscapeRoomStatus,
  RequestEscapeRoomHintDocument,
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
>

export type LiveQuizEscapeRoomResponse = {
  completed?: boolean
  lockoutUntil?: string
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
  config?: {
    timeLimit: number
    hintPenalty: number
    lockoutSeconds?: number
  } | null
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
  const [attempt, setAttempt] = useState(initialAttempt ?? null)
  const [isCompleted, setIsCompleted] = useState(
    initialAttempt?.status === EscapeRoomStatus.Completed
  )
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null)
  const [expiresInSeconds, setExpiresInSeconds] = useState<number | null>(null)
  const [lockoutRemaining, setLockoutRemaining] = useState(0)
  const [revealedHints, setRevealedHints] = useState<Record<number, string>>(
    Object.fromEntries(
      instances.flatMap((instance) =>
        instance.revealedHint
          ? [[instance.id, instance.revealedHint] as const]
          : []
      )
    )
  )
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
      ].join('|')
    : ''
  const serverAttemptProjectionRef = useRef(serverAttemptProjection)
  const expiryHandledAttemptIdRef = useRef<string | null>(null)
  const revealedHintProjection = instances
    .map((instance) => `${instance.id}:${instance.revealedHint ?? ''}`)
    .join('|')

  useEffect(() => {
    if (serverAttemptProjectionRef.current === serverAttemptProjection) return

    serverAttemptProjectionRef.current = serverAttemptProjection
    setAttempt(initialAttempt ?? null)
    setIsCompleted(initialAttempt?.status === EscapeRoomStatus.Completed)
    setLockoutRemaining(0)
  }, [initialAttempt, serverAttemptProjection])

  useEffect(() => {
    setRevealedHints(
      Object.fromEntries(
        instances.flatMap((instance) =>
          instance.revealedHint
            ? [[instance.id, instance.revealedHint] as const]
            : []
        )
      )
    )
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
        [currentInstance.id]: payload.hint,
      }))
      setAttempt(payload.attempt)
    } catch {
      toast({
        message: t('pwa.assessment.submissionGeneralError'),
        type: 'error',
      })
    }
  }, [blockId, currentInstance, hintMutation, t])

  const lockoutSeconds = config?.lockoutSeconds ?? 0
  const onResponse = useCallback(
    (result: LiveQuizEscapeRoomResponse) => {
      if (result.completed) setIsCompleted(true)
      if (!result.lockoutUntil) return

      // The lockout starts when the server grades the answer, so the server
      // clock stood at lockoutUntil minus the lockout length. Moving the
      // snapshot there keeps the countdown exact without a refetch.
      const serverNowMs =
        new Date(result.lockoutUntil).getTime() - lockoutSeconds * 1000
      setAttempt((current) =>
        current
          ? {
              ...current,
              lockoutUntil: result.lockoutUntil,
              remainingSeconds: Math.max(
                0,
                Math.ceil(
                  current.timeLimit -
                    (serverNowMs - new Date(current.startedAt).getTime()) / 1000
                )
              ),
            }
          : current
      )
    },
    [lockoutSeconds]
  )

  return {
    attempt,
    isCompleted,
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

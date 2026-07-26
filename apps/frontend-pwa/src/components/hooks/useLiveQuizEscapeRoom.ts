import { useMutation } from '@apollo/client'
import {
  ElementInstance,
  EscapeRoomStatus,
  RequestEscapeRoomHintDocument,
  StartEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

export type LiveQuizEscapeRoomAttempt = {
  id: string
  startedAt: string
  timeLimit: number
  penaltySeconds: number
  hintsUsed: string[]
  status: EscapeRoomStatus
  lockoutUntil?: string | null
  completedAt?: string | null
}

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
  config?: { timeLimit: number; hintPenalty: number } | null
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
  const serverAttemptIdRef = useRef(initialAttempt?.id ?? null)
  const revealedHintProjection = instances
    .map((instance) => `${instance.id}:${instance.revealedHint ?? ''}`)
    .join('|')

  useEffect(() => {
    const nextServerAttemptId = initialAttempt?.id ?? null
    if (serverAttemptIdRef.current === nextServerAttemptId) return

    serverAttemptIdRef.current = nextServerAttemptId
    setAttempt(initialAttempt ?? null)
    setIsCompleted(initialAttempt?.status === EscapeRoomStatus.Completed)
    setLockoutRemaining(0)
  }, [initialAttempt])

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
    if (!config || !attempt) {
      setRemainingSeconds(null)
      return
    }
    const tick = () => {
      const elapsed =
        (Date.now() - new Date(attempt.startedAt).getTime()) / 1000
      setRemainingSeconds(
        Math.max(
          0,
          Math.ceil(attempt.timeLimit - attempt.penaltySeconds - elapsed)
        )
      )
      setLockoutRemaining(
        attempt.lockoutUntil
          ? Math.max(
              0,
              Math.ceil(
                (new Date(attempt.lockoutUntil).getTime() - Date.now()) / 1000
              )
            )
          : 0
      )
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [attempt, config])

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

  const onResponse = useCallback((result: LiveQuizEscapeRoomResponse) => {
    if (result.completed) setIsCompleted(true)
    if (!result.lockoutUntil) return

    setLockoutRemaining(
      Math.max(
        0,
        Math.ceil((new Date(result.lockoutUntil).getTime() - Date.now()) / 1000)
      )
    )
    setAttempt((current) =>
      current ? { ...current, lockoutUntil: result.lockoutUntil } : current
    )
  }, [])

  return {
    attempt,
    isCompleted,
    isExpired:
      attempt?.status === EscapeRoomStatus.Expired || remainingSeconds === 0,
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

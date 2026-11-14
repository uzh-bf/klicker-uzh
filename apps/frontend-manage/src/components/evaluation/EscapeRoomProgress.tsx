import { useMutation } from '@apollo/client'
import {
  EscapeRoomProgressStatus,
  EscapeRoomProgress as EscapeRoomProgressType,
  ResetEscapeRoomAttemptDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface EscapeRoomProgressProps {
  activityType: 'practiceQuiz' | 'microLearning'
  activityId: string
  progress: EscapeRoomProgressType
  onReset: () => Promise<unknown>
  canReset?: boolean
}

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function StatusPill({ status }: { status: EscapeRoomProgressStatus }) {
  const t = useTranslations()
  const map: Record<
    EscapeRoomProgressStatus,
    { label: string; className: string }
  > = {
    [EscapeRoomProgressStatus.NotStarted]: {
      label: t('manage.evaluation.escapeRoomStatusNotStarted'),
      className: 'bg-gray-100 text-gray-700',
    },
    [EscapeRoomProgressStatus.InProgress]: {
      label: t('manage.evaluation.escapeRoomStatusInProgress'),
      className: 'bg-blue-100 text-blue-800',
    },
    [EscapeRoomProgressStatus.Completed]: {
      label: t('manage.evaluation.escapeRoomStatusCompleted'),
      className: 'bg-green-100 text-green-800',
    },
    [EscapeRoomProgressStatus.Expired]: {
      label: t('manage.evaluation.escapeRoomStatusExpired'),
      className: 'bg-red-100 text-red-800',
    },
  }
  const entry = map[status]
  return (
    <span
      className={twMerge(
        'inline-block rounded-full px-2 py-0.5 text-xs font-bold',
        entry.className
      )}
    >
      {entry.label}
    </span>
  )
}

function EscapeRoomProgress({
  activityType,
  activityId,
  progress,
  onReset,
  canReset = false,
}: EscapeRoomProgressProps) {
  const t = useTranslations()
  const [resetEscapeRoomAttempt] = useMutation(ResetEscapeRoomAttemptDocument)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [resettingId, setResettingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { totalStacks, attempts } = progress

  async function handleReset(attempt: (typeof attempts)[number]) {
    if (!attempt.id) return
    setResettingId(attempt.id)
    setError(null)
    try {
      await resetEscapeRoomAttempt({
        variables: {
          ...(activityType === 'microLearning'
            ? { microLearningId: activityId }
            : { practiceQuizId: activityId }),
          participantId: attempt.participantId ?? undefined,
        },
      })
      await onReset()
    } catch {
      setError(t('manage.evaluation.escapeRoomResetError'))
    } finally {
      setResettingId(null)
      setConfirmingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl">
        <div className="mb-2 text-sm text-gray-600">
          {t('manage.evaluation.escapeRoomProgressDescription')}
        </div>

        {error && (
          <UserNotification
            type="error"
            message={error}
            className={{ root: 'mb-2' }}
          />
        )}

        {attempts.length === 0 ? (
          <UserNotification
            type="info"
            message={t('manage.evaluation.escapeRoomNoAttempts')}
          />
        ) : (
          <div className="overflow-x-auto rounded border">
            <table
              className="w-full text-sm"
              data-cy="escape-room-progress-table"
            >
              <thead>
                <tr className="border-b bg-gray-50 text-left">
                  <th className="p-2 font-bold">
                    {t('manage.evaluation.escapeRoomColParticipant')}
                  </th>
                  <th className="p-2 font-bold">
                    {t('manage.evaluation.escapeRoomColStatus')}
                  </th>
                  <th className="p-2 font-bold">
                    {t('manage.evaluation.escapeRoomColProgress')}
                  </th>
                  <th className="p-2 text-right font-bold">
                    {t('manage.evaluation.escapeRoomColHints')}
                  </th>
                  <th className="p-2 text-right font-bold">
                    {t('manage.evaluation.escapeRoomColPenalty')}
                  </th>
                  <th className="p-2 text-right font-bold">
                    {t('manage.evaluation.escapeRoomColTime')}
                  </th>
                  <th className="p-2 text-right font-bold">
                    {t('manage.evaluation.escapeRoomColActions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((attempt) => {
                  const pct =
                    totalStacks > 0
                      ? Math.round((attempt.clearedStacks / totalStacks) * 100)
                      : 0
                  const lockedOut = attempt.lockoutUntil != null
                  return (
                    <tr
                      key={attempt.id ?? `participant-${attempt.participantId}`}
                      className="border-b last:border-b-0"
                      data-cy={`escape-room-attempt-${attempt.displayName}`}
                    >
                      <td className="p-2">
                        <div className="font-bold">{attempt.displayName}</div>
                        {lockedOut && (
                          <div className="text-xs text-red-600">
                            {t('manage.evaluation.escapeRoomLockedOut')}
                          </div>
                        )}
                      </td>
                      <td className="p-2">
                        <StatusPill status={attempt.status} />
                      </td>
                      <td className="p-2">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="bg-primary-60 h-full"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="whitespace-nowrap text-xs text-gray-600">
                            {attempt.clearedStacks} / {totalStacks}
                          </span>
                        </div>
                      </td>
                      <td className="p-2 text-right">
                        {attempt.hintsUsedCount}
                      </td>
                      <td className="p-2 text-right">
                        {attempt.penaltySeconds > 0
                          ? `+${formatDuration(attempt.penaltySeconds)}`
                          : '–'}
                      </td>
                      <td className="p-2 text-right">
                        {attempt.timeSpentSeconds != null
                          ? formatDuration(attempt.timeSpentSeconds)
                          : '–'}
                      </td>
                      <td className="p-2 text-right">
                        {attempt.id != null && confirmingId === attempt.id ? (
                          <div className="flex justify-end gap-1">
                            <Button
                              className={{
                                root: 'bg-red-600 px-2 py-1 text-xs text-white',
                              }}
                              loading={resettingId === attempt.id}
                              onClick={() => handleReset(attempt)}
                              data={{
                                cy: `escape-room-reset-confirm-${attempt.displayName}`,
                              }}
                            >
                              <Button.Label>
                                {t('manage.evaluation.escapeRoomResetConfirm')}
                              </Button.Label>
                            </Button>
                            <Button
                              basic
                              className={{ root: 'px-2 py-1 text-xs' }}
                              onClick={() => setConfirmingId(null)}
                              data={{
                                cy: `escape-room-reset-cancel-${attempt.displayName}`,
                              }}
                            >
                              <Button.Label>
                                {t('shared.generic.cancel')}
                              </Button.Label>
                            </Button>
                          </div>
                        ) : attempt.id && canReset ? (
                          <Button
                            className={{ root: 'px-2 py-1 text-xs' }}
                            disabled={resettingId !== null}
                            onClick={() => setConfirmingId(attempt.id ?? null)}
                            data={{
                              cy: `escape-room-reset-${attempt.displayName}`,
                            }}
                          >
                            <Button.Label>
                              {t('manage.evaluation.escapeRoomReset')}
                            </Button.Label>
                          </Button>
                        ) : (
                          '–'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EscapeRoomProgress

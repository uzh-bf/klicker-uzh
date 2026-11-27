import { useMutation } from '@apollo/client'
import {
  EscapeRoomSessionPhase,
  PublicationStatus,
  SetEscapeRoomSessionPhaseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

interface EscapeRoomSessionControlsProps {
  groupActivityId: string
  sessionPhase: EscapeRoomSessionPhase
  status: PublicationStatus
  scheduledEndAt: string
  onChanged: () => Promise<unknown>
}

// The stored phase stays RUNNING or PAUSED when the window passes or the
// activity ends; the server treats that as ended, so the bar does too.
function EscapeRoomSessionControls({
  groupActivityId,
  sessionPhase,
  status,
  scheduledEndAt,
  onChanged,
}: EscapeRoomSessionControlsProps) {
  const t = useTranslations()
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [setPhase, { loading }] = useMutation(SetEscapeRoomSessionPhaseDocument)

  const phase =
    status !== PublicationStatus.Published ||
    dayjs().isAfter(dayjs(scheduledEndAt))
      ? EscapeRoomSessionPhase.Ended
      : sessionPhase

  const transition = async (next: EscapeRoomSessionPhase) => {
    try {
      await setPhase({ variables: { groupActivityId, phase: next } })
    } catch (error) {
      toast({
        type: 'error',
        message: t('manage.groupActivity.escapeSessionError'),
        options: { duration: 6000 },
      })
    }
    await onChanged()
  }

  const phaseLabels: Record<EscapeRoomSessionPhase, string> = {
    [EscapeRoomSessionPhase.Lobby]: t(
      'manage.groupActivity.escapeSessionPhaseLobby'
    ),
    [EscapeRoomSessionPhase.Running]: t(
      'manage.groupActivity.escapeSessionPhaseRunning'
    ),
    [EscapeRoomSessionPhase.Paused]: t(
      'manage.groupActivity.escapeSessionPhasePaused'
    ),
    [EscapeRoomSessionPhase.Ended]: t(
      'manage.groupActivity.escapeSessionPhaseEnded'
    ),
  }

  return (
    <div
      className="flex flex-row flex-wrap items-center gap-4 border-b p-4"
      data-cy="escape-session-controls"
      data-phase={phase}
    >
      <div className="font-bold">
        {t('manage.groupActivity.escapeSessionTitle')}
      </div>
      <div>
        {t('manage.groupActivity.escapeSessionPhase')}:{' '}
        <span className="font-bold" data-cy="escape-session-phase">
          {phaseLabels[phase]}
        </span>
      </div>
      <div className="text-gray-700">
        {t('manage.groupActivity.escapeSessionWindowEnd', {
          datetime: dayjs(scheduledEndAt).format('DD.MM.YYYY, HH:mm'),
        })}
      </div>
      <div className="ml-auto flex flex-row gap-2">
        {phase === EscapeRoomSessionPhase.Lobby && (
          <Button
            primary
            disabled={loading}
            onClick={() => transition(EscapeRoomSessionPhase.Running)}
            data={{ cy: 'escape-session-start' }}
          >
            <Button.Label>
              {t('manage.groupActivity.escapeSessionStart')}
            </Button.Label>
          </Button>
        )}
        {phase === EscapeRoomSessionPhase.Running && (
          <Button
            disabled={loading}
            onClick={() => transition(EscapeRoomSessionPhase.Paused)}
            data={{ cy: 'escape-session-pause' }}
          >
            <Button.Label>
              {t('manage.groupActivity.escapeSessionPause')}
            </Button.Label>
          </Button>
        )}
        {phase === EscapeRoomSessionPhase.Paused && (
          <Button
            primary
            disabled={loading}
            onClick={() => transition(EscapeRoomSessionPhase.Running)}
            data={{ cy: 'escape-session-resume' }}
          >
            <Button.Label>
              {t('manage.groupActivity.escapeSessionResume')}
            </Button.Label>
          </Button>
        )}
        {(phase === EscapeRoomSessionPhase.Running ||
          phase === EscapeRoomSessionPhase.Paused) && (
          <Button
            disabled={loading}
            onClick={() => setConfirmEnd(true)}
            data={{ cy: 'escape-session-end' }}
          >
            <Button.Label>
              {t('manage.groupActivity.escapeSessionEnd')}
            </Button.Label>
          </Button>
        )}
      </div>
      {confirmEnd && (
        <Modal
          open
          title={t('manage.groupActivity.escapeSessionEnd')}
          primaryLabel={t('shared.generic.confirm')}
          primaryLoading={loading}
          onPrimaryAction={async () => {
            await transition(EscapeRoomSessionPhase.Ended)
            setConfirmEnd(false)
          }}
          dataPrimaryAction={{ cy: 'confirm-escape-session-end' }}
          secondaryLabel={t('shared.generic.cancel')}
          onSecondaryAction={() => setConfirmEnd(false)}
          dataSecondaryAction={{ cy: 'cancel-escape-session-end' }}
          onClose={() => setConfirmEnd(false)}
          hideCloseButton={true}
          className={{ content: 'max-w-xl' }}
        >
          <div className="text-base">
            {t('manage.groupActivity.escapeSessionEndConfirm')}
          </div>
        </Modal>
      )}
    </div>
  )
}

export default EscapeRoomSessionControls

import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

// Skipping clears the current stage at a ranked-time penalty, so it needs an
// explicit second click before the mutation runs.
export default function EscapeRoomSkipButton({
  penalty,
  loading = false,
  onSkip,
}: {
  penalty: number
  loading?: boolean
  onSkip: () => Promise<void>
}) {
  const t = useTranslations()
  const [confirming, setConfirming] = useState(false)

  if (!confirming) {
    return (
      <Button
        basic
        className={{ root: 'self-start' }}
        onClick={() => setConfirming(true)}
        data={{ cy: 'escape-room-skip' }}
      >
        <Button.Label>
          {t('pwa.practiceQuiz.escapeRoomSkip', { penalty })}
        </Button.Label>
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <UserNotification
        type="warning"
        message={t('pwa.practiceQuiz.escapeRoomSkipConfirm', { penalty })}
      />
      <div className="flex flex-row gap-2">
        <Button
          loading={loading}
          disabled={loading}
          onClick={async () => {
            await onSkip()
            setConfirming(false)
          }}
          data={{ cy: 'escape-room-skip-confirm' }}
        >
          <Button.Label>
            {t('pwa.practiceQuiz.escapeRoomSkipConfirmButton')}
          </Button.Label>
        </Button>
        <Button basic disabled={loading} onClick={() => setConfirming(false)}>
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

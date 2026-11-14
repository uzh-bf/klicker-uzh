import { faForward, faLightbulb } from '@fortawesome/free-solid-svg-icons'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { formatDuration } from './EscapeRoomOverlay'

// The one "show hint" control of every escape room mode; it always names its
// ranked-time price.
export function EscapeRoomHintButton({
  penalty,
  next = false,
  loading = false,
  disabled = false,
  onClick,
  dataCy,
}: {
  penalty: number
  next?: boolean
  loading?: boolean
  disabled?: boolean
  onClick: () => void
  dataCy: string
}) {
  const t = useTranslations()
  return (
    <Button
      basic
      className={{ root: 'self-start' }}
      loading={loading}
      disabled={disabled}
      onClick={onClick}
      data={{ cy: dataCy }}
      data-seconds={penalty}
    >
      <Button.Icon icon={faLightbulb} />
      <Button.Label>
        {t(
          next
            ? 'pwa.practiceQuiz.escapeRoomNextHint'
            : 'pwa.practiceQuiz.escapeRoomRequestHint',
          { duration: formatDuration(penalty, t) }
        )}
      </Button.Label>
    </Button>
  )
}

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
  const duration = formatDuration(penalty, t)

  if (!confirming) {
    return (
      <Button
        className={{ root: 'self-start' }}
        onClick={() => setConfirming(true)}
        data={{ cy: 'escape-room-skip' }}
        data-seconds={penalty}
      >
        <Button.Icon icon={faForward} />
        <Button.Label>
          {t('pwa.practiceQuiz.escapeRoomSkip', { duration })}
        </Button.Label>
      </Button>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <UserNotification
        type="warning"
        message={t('pwa.practiceQuiz.escapeRoomSkipConfirm', { duration })}
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
          data-seconds={penalty}
        >
          <Button.Label>
            {t('pwa.practiceQuiz.escapeRoomSkipConfirmButton')}
          </Button.Label>
        </Button>
        <Button
          basic
          disabled={loading}
          onClick={() => setConfirming(false)}
          data={{ cy: 'escape-room-skip-cancel' }}
        >
          <Button.Label>{t('shared.generic.cancel')}</Button.Label>
        </Button>
      </div>
    </div>
  )
}

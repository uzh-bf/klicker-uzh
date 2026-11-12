import EscapeRoomOverlay, {
  formatDuration,
} from '@components/practiceQuiz/EscapeRoomOverlay'
import { EscapeRoomHintButton } from '@components/practiceQuiz/EscapeRoomSkipButton'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { getLiveEscapeRoomStages } from '@lib/escapeRoomStages'
import { UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { useLiveQuizEscapeRoom } from '../hooks/useLiveQuizEscapeRoom'

type LiveQuizEscapeRoomController = ReturnType<typeof useLiveQuizEscapeRoom>

type EscapeRoomConfig = {
  timeLimit: number
  hintPenalty: number
  hintPenalties: number[]
  lockoutSeconds: number
  introText?: string | null
}

export function LiveQuizEscapeRoomOverlay({
  controller,
  config,
  title,
  clearedInstances,
  totalInstances,
}: {
  controller: LiveQuizEscapeRoomController
  config: EscapeRoomConfig
  title?: string
  clearedInstances: number
  totalInstances: number
}) {
  const t = useTranslations()
  const isEnded = controller.isCompleted || controller.isExpired
  // The ending is dismissed for the attempt state it was dismissed in; any
  // change (new attempt, reset, other ending) brings it back.
  const endingKey = `${controller.attempt?.id ?? ''}|${controller.isCompleted}|${controller.isExpired}`
  const [dismissedEndingKey, setDismissedEndingKey] = useState<string | null>(
    null
  )
  if (isEnded && dismissedEndingKey === endingKey) return null

  return (
    <EscapeRoomOverlay
      mode="liveQuiz"
      title={title}
      rules={config}
      exit={
        isEnded
          ? {
              label: t('pwa.practiceQuiz.escapeRoomContinue'),
              onClick: () => setDismissedEndingKey(endingKey),
            }
          : undefined
      }
      isStarted={!!controller.attempt}
      isCompleted={controller.isCompleted}
      isExpired={controller.isExpired}
      remainingSeconds={controller.remainingSeconds}
      onStart={controller.startAttempt}
      loading={controller.starting}
      attempt={controller.attempt}
      stages={getLiveEscapeRoomStages({
        clearedCount: clearedInstances,
        totalCount: totalInstances,
      })}
      introText={config.introText}
    />
  )
}

export function LiveQuizEscapeRoomQuestionControls({
  controller,
  config,
  currentInstance,
}: {
  controller: LiveQuizEscapeRoomController
  config: EscapeRoomConfig
  currentInstance: ElementInstance
}) {
  const t = useTranslations()
  return (
    <>
      <div aria-live="polite">
        {controller.lockoutRemaining > 0 && (
          <>
            <UserNotification
              type="error"
              className={{ root: 'mt-3' }}
              message={t('pwa.practiceQuiz.escapeRoomIncorrectToast')}
              data={{ cy: 'escape-room-incorrect-notice' }}
            />
            <UserNotification
              type="warning"
              className={{ root: 'mt-2' }}
              message={t('pwa.practiceQuiz.escapeRoomLockoutCountdown', {
                duration: formatDuration(controller.lockoutRemaining, t),
              })}
              data={{ cy: 'escape-room-lockout-countdown' }}
            />
          </>
        )}
      </div>
      {controller.attempt && currentInstance.options?.hasHint && (
        <div className="mt-3 flex flex-col">
          {controller.revealedHints[currentInstance.id] ? (
            <UserNotification
              type="info"
              message={controller.revealedHints[currentInstance.id]}
            />
          ) : (
            <EscapeRoomHintButton
              penalty={config.hintPenalty}
              loading={controller.requestingHint}
              disabled={controller.lockoutRemaining > 0}
              onClick={controller.requestHint}
              dataCy="live-quiz-escape-room-hint"
            />
          )}
        </div>
      )}
    </>
  )
}

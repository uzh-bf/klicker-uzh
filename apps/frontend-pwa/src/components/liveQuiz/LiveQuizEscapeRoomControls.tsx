import EscapeRoomOverlay from '@components/practiceQuiz/EscapeRoomOverlay'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import type { useLiveQuizEscapeRoom } from '../hooks/useLiveQuizEscapeRoom'

type LiveQuizEscapeRoomController = ReturnType<typeof useLiveQuizEscapeRoom>

type EscapeRoomConfig = {
  timeLimit: number
  hintPenalty: number
  introText?: string | null
}

export function LiveQuizEscapeRoomOverlay({
  controller,
  config,
  clearedInstances,
  totalInstances,
}: {
  controller: LiveQuizEscapeRoomController
  config: EscapeRoomConfig
  clearedInstances: number
  totalInstances: number
}) {
  return (
    <EscapeRoomOverlay
      isStarted={!!controller.attempt}
      isCompleted={controller.isCompleted}
      isExpired={controller.isExpired}
      remainingSeconds={controller.remainingSeconds}
      timeLimit={config.timeLimit}
      hintPenalty={config.hintPenalty}
      onStart={controller.startAttempt}
      loading={controller.starting}
      attempt={controller.attempt}
      clearedStacks={clearedInstances}
      totalStacks={totalInstances}
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
      {controller.lockoutRemaining > 0 && (
        <UserNotification
          type="warning"
          className={{ root: 'mt-3' }}
          message={t('pwa.practiceQuiz.escapeRoomLockoutCountdown', {
            seconds: controller.lockoutRemaining,
          })}
        />
      )}
      {controller.attempt && currentInstance.options?.hasHint && (
        <div className="mt-3">
          {controller.revealedHints[currentInstance.id] ? (
            <UserNotification
              type="info"
              message={controller.revealedHints[currentInstance.id]}
            />
          ) : (
            <Button
              basic
              loading={controller.requestingHint}
              disabled={controller.lockoutRemaining > 0}
              onClick={controller.requestHint}
              data={{ cy: 'live-quiz-escape-room-hint' }}
            >
              {t('pwa.practiceQuiz.escapeRoomRequestHint', {
                penalty: config.hintPenalty,
              })}
            </Button>
          )}
        </div>
      )}
    </>
  )
}

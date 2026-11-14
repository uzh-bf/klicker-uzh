import EscapeRoomOverlay, {
  formatDuration,
} from '@components/practiceQuiz/EscapeRoomOverlay'
import EscapeRoomSkipButton, {
  EscapeRoomHintButton,
} from '@components/practiceQuiz/EscapeRoomSkipButton'
import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { getLiveEscapeRoomStages } from '@lib/escapeRoomStages'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type {
  LiveQuizEscapeRoomConfig as EscapeRoomConfig,
  useLiveQuizEscapeRoom,
} from '../hooks/useLiveQuizEscapeRoom'

type LiveQuizEscapeRoomController = ReturnType<typeof useLiveQuizEscapeRoom>

type SolutionItem = { text: string; markdown: boolean }

// The solution returned with a reveal as readable items. Choice indices are
// resolved to the choice texts; element types without a short solution
// (selection, case study) show none.
function getRevealedSolutionItems(
  instance: ElementInstance,
  solution: unknown
): SolutionItem[] {
  if (!Array.isArray(solution)) return []
  const data = instance.elementData
  if (data.__typename === 'ChoicesElementData') {
    return data.options.choices
      .filter((choice) => solution.includes(choice.ix))
      .map((choice) => ({ text: choice.value, markdown: true }))
  }
  if (data.__typename === 'NumericalElementData') {
    return solution.flatMap((entry): SolutionItem[] => {
      if (typeof entry === 'number') {
        return [{ text: String(entry), markdown: false }]
      }
      if (entry && typeof entry === 'object') {
        const { min, max } = entry as {
          min?: number | null
          max?: number | null
        }
        return [{ text: `${min ?? '…'} – ${max ?? '…'}`, markdown: false }]
      }
      return []
    })
  }
  if (data.__typename === 'FreeTextElementData') {
    return solution
      .filter((entry): entry is string => typeof entry === 'string')
      .map((text) => ({ text, markdown: false }))
  }
  return []
}

export function LiveQuizEscapeRoomOverlay({
  controller,
  config,
  title,
  clearedInstances,
  totalInstances,
  hasVisibleStage,
}: {
  controller: LiveQuizEscapeRoomController
  config: EscapeRoomConfig
  title?: string
  clearedInstances: number
  totalInstances: number
  // whether the server currently offers a stage to answer
  hasVisibleStage: boolean
}) {
  const t = useTranslations()
  const isEnded = controller.isCompleted || controller.isExpired
  // The ending is dismissed for the attempt state it was dismissed in; any
  // change (new attempt, reset, other ending) brings it back.
  const endingKey = `${controller.attempt?.id ?? ''}|${controller.isCompleted}|${controller.isExpired}|${controller.bonusOutcome ?? ''}`
  const [dismissedEndingKey, setDismissedEndingKey] = useState<string | null>(
    null
  )
  if (isEnded && dismissedEndingKey === endingKey) return null

  const stages = getLiveEscapeRoomStages({
    clearedCount: clearedInstances,
    totalCount: totalInstances,
    hasBonus: (config.bonusSeconds ?? 0) > 0,
    stageOutcomes: controller.attempt?.stageOutcomes,
  })

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
      stages={stages}
      bonus={
        config.bonusSeconds && stages.bonusCount > 0
          ? {
              seconds: config.bonusSeconds,
              available: controller.bonusPending && hasVisibleStage,
              outcome: controller.bonusOutcome,
              onStart: () => setDismissedEndingKey(endingKey),
            }
          : undefined
      }
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
  const reveal = controller.reveal
  const isRunning = !!controller.attempt && !controller.isCompleted
  const hints = controller.revealedHints[currentInstance.id] ?? []
  const nextHintPenalty =
    config.hintPenalties[hints.length] ?? config.hintPenalty
  const triesLeft =
    controller.triesLeft ??
    (typeof config.maxWrongAttempts === 'number'
      ? Math.max(config.maxWrongAttempts - controller.wrongAttempts, 0)
      : null)

  if (reveal) {
    const items = getRevealedSolutionItems(currentInstance, reveal.solution)
    return (
      <div className="mt-3 flex flex-col gap-2" aria-live="polite">
        <UserNotification
          type="warning"
          message={t('pwa.practiceQuiz.escapeRoomRevealedNotice', {
            duration: formatDuration(config.revealPenalty ?? 0, t),
          })}
          data={{ cy: 'escape-room-revealed-notice' }}
        />
        {items.length > 0 && (
          <div
            className="rounded-md border border-slate-300 bg-slate-50 p-3 text-sm"
            data-cy="escape-room-revealed-solution"
          >
            <div className="font-semibold">
              {t('pwa.practiceQuiz.escapeRoomRevealedSolution')}
            </div>
            <ul className="list-disc pl-5">
              {items.map((item, ix) => (
                <li key={ix}>
                  {item.markdown ? <Markdown content={item.text} /> : item.text}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button
          primary
          className={{ root: 'self-start' }}
          onClick={controller.continueAfterReveal}
          data={{ cy: 'escape-room-revealed-continue' }}
        >
          <Button.Label>{t('shared.generic.continue')}</Button.Label>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div aria-live="polite">
        {isRunning && triesLeft !== null && (
          <UserNotification
            type="info"
            className={{ root: 'mt-3' }}
            message={t('pwa.practiceQuiz.escapeRoomTriesLeft', {
              count: triesLeft,
            })}
            data={{ cy: 'escape-room-tries-left' }}
          />
        )}
        {controller.lockoutRemaining > 0 && (
          <>
            <UserNotification
              type="error"
              className={{ root: 'mt-3' }}
              message={t('pwa.practiceQuiz.escapeRoomIncorrectToast')}
              data={{ cy: 'escape-room-incorrect-notice' }}
            />
            <div aria-live="off">
              <UserNotification
                type="warning"
                className={{ root: 'mt-2' }}
                message={t('pwa.practiceQuiz.escapeRoomLockoutCountdown', {
                  duration: formatDuration(controller.lockoutRemaining, t),
                })}
                data={{ cy: 'escape-room-lockout-countdown' }}
              />
            </div>
          </>
        )}
      </div>
      {isRunning && currentInstance.options?.hasHint && (
        <div className="mt-3 flex flex-col gap-2">
          {hints.map((hint, hintIx) => (
            <UserNotification
              key={hintIx}
              type="info"
              message={hint}
              data={{ cy: `live-quiz-escape-room-hint-text-${hintIx}` }}
            />
          ))}
          {hints.length < (currentInstance.options.hintCount ?? 1) && (
            <EscapeRoomHintButton
              penalty={nextHintPenalty}
              next={hints.length > 0}
              loading={controller.requestingHint}
              disabled={
                controller.requestingHint ||
                controller.lockoutRemaining > 0 ||
                controller.isExpired
              }
              onClick={controller.requestHint}
              dataCy={
                hints.length === 0
                  ? 'live-quiz-escape-room-hint'
                  : 'live-quiz-escape-room-next-hint'
              }
            />
          )}
        </div>
      )}
      {isRunning &&
        !controller.isExpired &&
        typeof config.skipPenalty === 'number' && (
          <div className="mt-3 flex flex-col">
            <EscapeRoomSkipButton
              penalty={config.skipPenalty}
              loading={controller.skipping}
              onSkip={controller.skipStage}
            />
          </div>
        )}
    </>
  )
}

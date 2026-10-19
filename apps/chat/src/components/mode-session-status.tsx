'use client'

import { useAuiState } from '@assistant-ui/react'
import { ClockIcon, LanguagesIcon } from 'lucide-react'
import { useNow, useTranslations } from 'next-intl'
import type { FC } from 'react'
import { resolveSelectedMode } from '@/src/lib/config/modes'
import { readMeetingClock } from '@/src/lib/meetingClock'
import type { MeetingClockAnchor } from '@/src/stores/chatStore'
import { useSettingsStore } from '@/src/stores/settingsStore'
import { useEffectiveModeOptions } from './mode-options-context'

type ThreadMessageView = {
  role: string
  createdAt?: Date
  metadata?: { custom?: { meetingClock?: MeetingClockAnchor | null } }
}

/**
 * The clock start for the visible branch. A streamed answer carries the
 * server's start and clock offset; a reloaded thread falls back to its first
 * user message, whose timestamp the server stored and also counts from.
 */
function findMeetingClockStart(
  messages: readonly ThreadMessageView[]
): { startedAt: Date; skewMs: number } | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const anchor = messages[index]?.metadata?.custom?.meetingClock
    if (anchor) {
      return { startedAt: new Date(anchor.startedAt), skewMs: anchor.skewMs }
    }
  }

  const firstUserMessage = messages.find((message) => message.role === 'user')
  return firstUserMessage?.createdAt
    ? { startedAt: new Date(firstUserMessage.createdAt), skewMs: 0 }
    : null
}

/**
 * Shows participants the reply language and meeting clock the lecturer set
 * for the selected custom mode, so they see what the model is told. Renders
 * nothing for modes without either setting.
 */
export const ModeSessionStatus: FC = () => {
  const t = useTranslations()
  const selectedMode = useSettingsStore((state) => state.selectedMode)
  const modeOptions = useEffectiveModeOptions()
  const messages = useAuiState(
    (s) => s.thread.messages
  ) as readonly ThreadMessageView[]
  const now = useNow({ updateInterval: 30_000 })

  const option = modeOptions[resolveSelectedMode(modeOptions, selectedMode)]
  if (!option?.replyLanguage && !option?.meetingClock) return null

  const clockStart = option.meetingClock
    ? findMeetingClockStart(messages)
    : null
  const reading = clockStart
    ? readMeetingClock(clockStart.startedAt, clockStart.skewMs, now)
    : null

  return (
    <div
      data-cy="chat-mode-session-status"
      className="text-muted-foreground mt-1 flex w-full max-w-3xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-2 text-xs"
    >
      {option.replyLanguage ? (
        <span
          className="inline-flex items-center gap-1"
          data-cy="chat-mode-reply-language"
        >
          <LanguagesIcon aria-hidden className="size-3.5" />
          {t(
            option.replyLanguage === 'en'
              ? 'chat.composer.replyLanguageEn'
              : 'chat.composer.replyLanguageDe'
          )}
        </span>
      ) : null}
      {option.meetingClock ? (
        <span
          className="inline-flex items-center gap-1"
          data-cy="chat-mode-meeting-clock"
        >
          <ClockIcon aria-hidden className="size-3.5" />
          {reading
            ? t('chat.composer.meetingClockElapsed', {
                minutes: reading.elapsedMinutes,
              })
            : t('chat.composer.meetingClockNotStarted')}
          {reading && option.meetingClock === 'ELAPSED_AND_TIME'
            ? ` · ${t('chat.composer.meetingClockTime', { time: reading.timeOfDay })}`
            : null}
        </span>
      ) : null}
    </div>
  )
}

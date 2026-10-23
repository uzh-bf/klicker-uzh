import type { Locale } from '@klicker-uzh/prisma/client'
import type { ChatbotCustomModeMeetingClock } from '@klicker-uzh/types'
import {
  elapsedMeetingMinutes,
  MEETING_CLOCK_TIME_ZONE,
  meetingTimeOfDay,
} from '@/src/lib/meetingClock'
import { renderPromptTemplate } from '@/src/lib/server/promptTemplates'

// Model-facing names of the languages a lecturer can fix for a custom mode.
const LOCKED_LANGUAGE_NAMES: Record<Locale, string> = {
  en: 'English',
  de: 'German',
}

/**
 * Appended to every chatbot system prompt so the response language follows
 * the user rather than the language of the persona or retrieved material.
 * This cannot live only in `DEFAULT_PROMPT`: standard-mode lecturer guidance
 * and custom personas are separate prompt layers, and neither owns platform
 * language policy.
 */
const LANGUAGE_STYLE_CONTRACT = renderPromptTemplate('language-style', {
  lockedLanguage: null,
})

/**
 * Appends the conversation-language and Swiss Standard German contract to
 * `systemPrompt`. It is unconditional because it must survive every stored
 * lecturer prompt and does not depend on which tools are available. A custom
 * mode whose lecturer fixed a reply language gets the locked variant, which
 * is still platform-owned and keeps the Swiss Standard German rule.
 */
export function withLanguageStyleContract(
  systemPrompt: string,
  lockedLanguage: Locale | null = null
): string {
  const contract = lockedLanguage
    ? renderPromptTemplate('language-style', {
        lockedLanguage: LOCKED_LANGUAGE_NAMES[lockedLanguage],
      })
    : LANGUAGE_STYLE_CONTRACT
  const trimmedBase = systemPrompt.trimEnd()
  return trimmedBase.length > 0 ? `${trimmedBase}\n\n${contract}` : contract
}

/**
 * Restates the reply-language rule as the last message of every model step.
 * The rule in the system prompt alone loses to long other-language material,
 * such as retrieved passages, that the model reads just before answering.
 * The model identifies the language itself, so the reminder works for any
 * language the user writes in.
 */
export const REPLY_LANGUAGE_REMINDER = {
  role: 'system',
  content: renderPromptTemplate('reply-language-reminder', {
    lockedLanguage: null,
  }),
} as const

export type ReplyLanguageReminder = { role: 'system'; content: string }

/**
 * The reply-language reminder for a turn. Without a locked language or a
 * meeting clock it is exactly `REPLY_LANGUAGE_REMINDER`. A meeting clock line
 * goes before the language rule, which stays last for the recency reason
 * above.
 */
export function replyLanguageReminder(
  lockedLanguage: Locale | null,
  meetingClockLine: string | null = null
): ReplyLanguageReminder {
  if (!lockedLanguage && !meetingClockLine) return REPLY_LANGUAGE_REMINDER

  const languageReminder = lockedLanguage
    ? renderPromptTemplate('reply-language-reminder', {
        lockedLanguage: LOCKED_LANGUAGE_NAMES[lockedLanguage],
      })
    : REPLY_LANGUAGE_REMINDER.content
  return {
    role: 'system',
    content: meetingClockLine
      ? `${meetingClockLine}\n\n${languageReminder}`
      : languageReminder,
  }
}

/**
 * Formats the server-computed time facts of a custom mode with a meeting
 * clock. Elapsed time counts whole minutes from the participant's first
 * message, so opening a chat early does not start the clock; without one it
 * is zero. Lecturers keep meeting length and phases in their persona.
 */
export function formatMeetingClock(
  meetingClock: ChatbotCustomModeMeetingClock | null,
  firstUserMessageAt: Date | null,
  now: Date
): string | null {
  if (!meetingClock) return null

  return renderPromptTemplate('meeting-clock', {
    elapsedMinutes: elapsedMeetingMinutes(firstUserMessageAt ?? now, now),
    currentTime:
      meetingClock === 'ELAPSED_AND_TIME' ? meetingTimeOfDay(now) : null,
    timeZone: MEETING_CLOCK_TIME_ZONE,
  })
}

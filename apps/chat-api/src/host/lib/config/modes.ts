export type ChatModeReplyLanguage = 'en' | 'de'
export type ChatModeMeetingClock = 'ELAPSED' | 'ELAPSED_AND_TIME'

export interface ChatModeOption {
  description: string
  name?: string
  welcomeMessage?: string
  starterPrompts?: string[]
  // Shown to participants so they see the language and time the model uses.
  replyLanguage?: ChatModeReplyLanguage
  meetingClock?: ChatModeMeetingClock
}

export type ChatModeOptions = Record<string, ChatModeOption>

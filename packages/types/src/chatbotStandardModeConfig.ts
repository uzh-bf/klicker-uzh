import type { Locale } from '@klicker-uzh/prisma/client'

export const CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH = 1000

/**
 * The normalized, platform-constrained configuration for standard chat modes.
 * Persona fields are shared because they describe the course context rather
 * than a mode-specific instruction.
 */
export type ChatbotStandardModeConfig = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  quizzerEnabled: boolean
  writingCoachEnabled: boolean
  courseName: string | null
  subjectDomain: string | null
  languageOfInstruction: Locale | null
  scopeNote: string | null
}

/** Historical JSON records may predate Writing Coach. */
export type StoredChatbotStandardModeConfig = Omit<
  ChatbotStandardModeConfig,
  'writingCoachEnabled'
> & { writingCoachEnabled?: boolean }

/** Replacement input; omitted Writing Coach preserves the stored choice. */
export type ChatbotStandardModeConfigInput = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  quizzerEnabled: boolean
  writingCoachEnabled?: boolean | null
  courseName?: string | null
  subjectDomain?: string | null
  languageOfInstruction?: Locale | null
  scopeNote?: string | null
}

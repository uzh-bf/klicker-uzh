import type { Locale } from '@klicker-uzh/prisma/client'

/**
 * The persisted, platform-constrained configuration for standard chat modes.
 * Persona fields are shared because they describe the course context rather
 * than a mode-specific instruction.
 */
export type ChatbotStandardModeConfig = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  courseName: string | null
  subjectDomain: string | null
  languageOfInstruction: Locale | null
  scopeNote: string | null
}

/** Full replacement input accepted by the owner-facing GraphQL mutation. */
export type ChatbotStandardModeConfigInput = {
  tutorEnabled: boolean
  explainerEnabled: boolean
  courseName?: string | null
  subjectDomain?: string | null
  languageOfInstruction?: Locale | null
  scopeNote?: string | null
}

import type { Locale } from '@klicker-uzh/prisma/client'
import type {
  ChatbotStandardModeConfig,
  ChatbotStandardModeConfigInput,
} from '@klicker-uzh/types'

export const CHATBOT_STANDARD_MODE_COURSE_NAME_MAX_LENGTH = 160
export const CHATBOT_STANDARD_MODE_SUBJECT_DOMAIN_MAX_LENGTH = 160
export const CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH = 1000

const supportedLocales = new Set<Locale>(['en', 'de'])

export class ChatbotStandardModeConfigValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ChatbotStandardModeConfigValidationError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeSingleLineText(
  value: unknown,
  fieldName: string,
  maxLength: number
) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ChatbotStandardModeConfigValidationError(
      `${fieldName} must be a string or null`
    )
  }

  const normalized = value.trim()
  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new ChatbotStandardModeConfigValidationError(
      `${fieldName} must be a single line`
    )
  }
  if (normalized.length > maxLength) {
    throw new ChatbotStandardModeConfigValidationError(
      `${fieldName} must be at most ${maxLength} characters long`
    )
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeScopeNote(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new ChatbotStandardModeConfigValidationError(
      'scopeNote must be a string or null'
    )
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH) {
    throw new ChatbotStandardModeConfigValidationError(
      `scopeNote must be at most ${CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH} characters long`
    )
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeLocale(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string' || !supportedLocales.has(value as Locale)) {
    throw new ChatbotStandardModeConfigValidationError(
      'languageOfInstruction must be en, de, or null'
    )
  }

  return value as Locale
}

function parseConfig(value: unknown): ChatbotStandardModeConfig {
  if (!isRecord(value)) {
    throw new ChatbotStandardModeConfigValidationError(
      'standardModeConfig must be an object'
    )
  }
  if (typeof value.tutorEnabled !== 'boolean') {
    throw new ChatbotStandardModeConfigValidationError(
      'tutorEnabled must be a boolean'
    )
  }
  if (typeof value.explainerEnabled !== 'boolean') {
    throw new ChatbotStandardModeConfigValidationError(
      'explainerEnabled must be a boolean'
    )
  }
  if (!value.tutorEnabled && !value.explainerEnabled) {
    throw new ChatbotStandardModeConfigValidationError(
      'At least one standard mode must be enabled'
    )
  }

  return {
    tutorEnabled: value.tutorEnabled,
    explainerEnabled: value.explainerEnabled,
    courseName: normalizeSingleLineText(
      value.courseName,
      'courseName',
      CHATBOT_STANDARD_MODE_COURSE_NAME_MAX_LENGTH
    ),
    subjectDomain: normalizeSingleLineText(
      value.subjectDomain,
      'subjectDomain',
      CHATBOT_STANDARD_MODE_SUBJECT_DOMAIN_MAX_LENGTH
    ),
    languageOfInstruction: normalizeLocale(value.languageOfInstruction),
    scopeNote: normalizeScopeNote(value.scopeNote),
  }
}

/** Strictly validates and canonicalizes a full owner mutation replacement. */
export function parseChatbotStandardModeConfigInput(
  value: ChatbotStandardModeConfigInput | unknown
): ChatbotStandardModeConfig {
  return parseConfig(value)
}

/**
 * Tolerantly normalizes persisted JSON. Invalid rows are treated as legacy
 * rows so a bad value cannot disable every mode or expose raw JSON.
 */
export function normalizeChatbotStandardModeConfig(
  value: unknown
): ChatbotStandardModeConfig | null {
  if (value === null || value === undefined) {
    return null
  }

  try {
    return parseConfig(value)
  } catch {
    return null
  }
}

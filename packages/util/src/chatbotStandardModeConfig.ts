import type { Locale } from '@klicker-uzh/prisma/client'
import type {
  ChatbotStandardModeConfig,
  ChatbotStandardModeConfigInput,
} from '@klicker-uzh/types'

export const CHATBOT_STANDARD_MODE_COURSE_NAME_MAX_LENGTH = 160
export const CHATBOT_STANDARD_MODE_SUBJECT_DOMAIN_MAX_LENGTH = 160
export const CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH = 1000

const supportedLocales = new Set<Locale>(['en', 'de'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isLegacyModeEnabled(systemPrompts: unknown, mode: string): boolean {
  const prompts = isRecord(systemPrompts) ? systemPrompts : null
  const modeConfig = isRecord(prompts?.[mode]) ? prompts[mode] : null
  return modeConfig?.enabled !== false
}

function defaultConfig(systemPrompts: unknown): ChatbotStandardModeConfig {
  return {
    tutorEnabled: isLegacyModeEnabled(systemPrompts, 'tutor'),
    explainerEnabled: isLegacyModeEnabled(systemPrompts, 'explainer'),
    quizzerEnabled: isLegacyModeEnabled(systemPrompts, 'quizzer'),
    courseName: null,
    subjectDomain: null,
    languageOfInstruction: null,
    scopeNote: null,
  }
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
    throw new Error(`${fieldName} must be a string or null`)
  }

  const normalized = value.trim()
  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error(`${fieldName} must be a single line`)
  }
  if (normalized.length > maxLength) {
    throw new Error(`${fieldName} must be at most ${maxLength} characters long`)
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeScopeNote(value: unknown) {
  if (value === undefined || value === null) {
    return null
  }
  if (typeof value !== 'string') {
    throw new Error('scopeNote must be a string or null')
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH) {
    throw new Error(
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
    throw new Error('languageOfInstruction must be en, de, or null')
  }

  return value as Locale
}

function parseConfig(value: unknown): ChatbotStandardModeConfig {
  if (!isRecord(value)) {
    throw new Error('standardModeConfig must be an object')
  }
  if (typeof value.tutorEnabled !== 'boolean') {
    throw new Error('tutorEnabled must be a boolean')
  }
  if (typeof value.explainerEnabled !== 'boolean') {
    throw new Error('explainerEnabled must be a boolean')
  }
  if (typeof value.quizzerEnabled !== 'boolean') {
    throw new Error('quizzerEnabled must be a boolean')
  }
  if (!value.tutorEnabled && !value.explainerEnabled) {
    throw new Error('Tutor or Explainer must remain enabled')
  }

  return {
    tutorEnabled: value.tutorEnabled,
    explainerEnabled: value.explainerEnabled,
    quizzerEnabled: value.quizzerEnabled,
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

function parsePersistedConfig(
  value: unknown,
  systemPrompts: unknown
): ChatbotStandardModeConfig {
  if (!isRecord(value)) {
    throw new Error('standardModeConfig must be an object')
  }
  if (typeof value.tutorEnabled !== 'boolean') {
    throw new Error('tutorEnabled must be a boolean')
  }
  if (typeof value.explainerEnabled !== 'boolean') {
    throw new Error('explainerEnabled must be a boolean')
  }
  if (!value.tutorEnabled && !value.explainerEnabled) {
    throw new Error('Tutor or Explainer must remain enabled')
  }

  let quizzerEnabled: boolean
  if (typeof value.quizzerEnabled === 'boolean') {
    quizzerEnabled = value.quizzerEnabled
  } else if (value.quizzerEnabled === undefined) {
    quizzerEnabled = isLegacyModeEnabled(systemPrompts, 'quizzer')
  } else {
    throw new Error('quizzerEnabled must be a boolean')
  }

  return {
    tutorEnabled: value.tutorEnabled,
    explainerEnabled: value.explainerEnabled,
    quizzerEnabled,
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

/**
 * Tolerantly normalizes persisted JSON. Invalid rows are treated as legacy
 * rows so a bad value cannot disable every mode or expose raw JSON.
 */
export function normalizeChatbotStandardModeConfig(
  value: unknown,
  systemPrompts: unknown = null
): ChatbotStandardModeConfig {
  if (value === null || value === undefined) return defaultConfig(systemPrompts)

  try {
    return parsePersistedConfig(value, systemPrompts)
  } catch {
    return defaultConfig(systemPrompts)
  }
}

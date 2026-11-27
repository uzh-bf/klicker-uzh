import type { Locale } from '@klicker-uzh/prisma/client'
import {
  CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH,
  type ChatbotStandardModeConfig,
  type ChatbotStandardModeConfigInput,
  type StoredChatbotStandardModeConfig,
} from '@klicker-uzh/types'

export const CHATBOT_STANDARD_MODE_COURSE_NAME_MAX_LENGTH = 160
export const CHATBOT_STANDARD_MODE_SUBJECT_DOMAIN_MAX_LENGTH = 160
export { CHATBOT_STANDARD_MODE_SCOPE_NOTE_MAX_LENGTH } from '@klicker-uzh/types'

/**
 * Mode keys the standard-mode configuration governs. The chat runtime's prompt
 * registry has to offer exactly these keys, and its test suite asserts that.
 */
export const CHATBOT_STANDARD_MODE_KEYS = [
  'tutor',
  'explainer',
  'quizzer',
  'writing-coach',
] as const

export type ChatbotStandardModeKey = (typeof CHATBOT_STANDARD_MODE_KEYS)[number]

/**
 * Standard modes that carry their own knowledge-base retrieval binding. Quizzer
 * stays out because it inherits the Tutor binding under ADR 0021.
 */
export const CHATBOT_KB_RETRIEVAL_MODE_KEYS = ['tutor', 'explainer'] as const

export function isChatbotStandardModeKey(
  mode: string
): mode is ChatbotStandardModeKey {
  return (CHATBOT_STANDARD_MODE_KEYS as readonly string[]).includes(mode)
}

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
    writingCoachEnabled: false,
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

type ChatbotStandardModeConfigSource = 'input' | 'stored'

function parseExplicitModeSelection(
  value: Record<string, unknown>,
  source: ChatbotStandardModeConfigSource
) {
  const hasMarker = Object.hasOwn(value, 'explicitModeSelection')
  if (source === 'input') {
    if (hasMarker) {
      throw new Error('explicitModeSelection is internal and cannot be set')
    }
    return false
  }

  if (!hasMarker) return false
  if (value.explicitModeSelection !== true) {
    throw new Error('explicitModeSelection must be exactly true')
  }

  return true
}

function parseConfig(
  value: unknown,
  options: {
    source: ChatbotStandardModeConfigSource
    systemPrompts?: unknown
  }
): ChatbotStandardModeConfig {
  if (!isRecord(value)) {
    throw new Error('standardModeConfig must be an object')
  }
  const persistedValue =
    options.source === 'stored' && value.quizzerEnabled === undefined
      ? {
          ...value,
          quizzerEnabled: isLegacyModeEnabled(options.systemPrompts, 'quizzer'),
        }
      : value

  if (typeof persistedValue.tutorEnabled !== 'boolean') {
    throw new Error('tutorEnabled must be a boolean')
  }
  if (typeof persistedValue.explainerEnabled !== 'boolean') {
    throw new Error('explainerEnabled must be a boolean')
  }
  if (typeof persistedValue.quizzerEnabled !== 'boolean') {
    throw new Error('quizzerEnabled must be a boolean')
  }
  if (
    persistedValue.writingCoachEnabled != null &&
    typeof persistedValue.writingCoachEnabled !== 'boolean'
  ) {
    throw new Error('writingCoachEnabled must be a boolean')
  }
  const writingCoachEnabled = persistedValue.writingCoachEnabled === true
  const explicitModeSelection = parseExplicitModeSelection(
    persistedValue,
    options.source
  )
  if (
    explicitModeSelection &&
    (value.quizzerEnabled === undefined ||
      value.writingCoachEnabled === undefined)
  ) {
    throw new Error(
      'explicitModeSelection requires a complete four-mode configuration'
    )
  }
  if (
    options.source === 'stored' &&
    !persistedValue.tutorEnabled &&
    !persistedValue.explainerEnabled &&
    !writingCoachEnabled &&
    !explicitModeSelection
  ) {
    throw new Error('Tutor, Explainer or Writing Coach must remain enabled')
  }
  if (
    explicitModeSelection &&
    (persistedValue.tutorEnabled ||
      persistedValue.explainerEnabled ||
      writingCoachEnabled)
  ) {
    throw new Error(
      'explicitModeSelection requires Tutor, Explainer and Writing Coach to be disabled'
    )
  }

  return {
    tutorEnabled: persistedValue.tutorEnabled,
    explainerEnabled: persistedValue.explainerEnabled,
    quizzerEnabled: persistedValue.quizzerEnabled,
    writingCoachEnabled,
    courseName: normalizeSingleLineText(
      persistedValue.courseName,
      'courseName',
      CHATBOT_STANDARD_MODE_COURSE_NAME_MAX_LENGTH
    ),
    subjectDomain: normalizeSingleLineText(
      persistedValue.subjectDomain,
      'subjectDomain',
      CHATBOT_STANDARD_MODE_SUBJECT_DOMAIN_MAX_LENGTH
    ),
    languageOfInstruction: normalizeLocale(
      persistedValue.languageOfInstruction
    ),
    scopeNote: normalizeScopeNote(persistedValue.scopeNote),
  }
}

/** Strictly validates and canonicalizes a full owner mutation replacement. */
export function parseChatbotStandardModeConfigInput(
  value: ChatbotStandardModeConfigInput | unknown
): ChatbotStandardModeConfig {
  return parseConfig(value, { source: 'input' })
}

/** Strictly validates a value already stored in live or revision JSON. */
export function parseStoredChatbotStandardModeConfig(
  value: unknown,
  systemPrompts: unknown = null
): ChatbotStandardModeConfig {
  return parseConfig(value, { source: 'stored', systemPrompts })
}

/** Serializes an owner's full replacement with intent for a deliberate all-off choice. */
export function parseChatbotStandardModeConfigForStorage(
  value: ChatbotStandardModeConfigInput | unknown
): ChatbotStandardModeConfig &
  Pick<StoredChatbotStandardModeConfig, 'explicitModeSelection'> {
  const config = parseConfig(value, { source: 'input' })
  if (
    config.tutorEnabled ||
    config.explainerEnabled ||
    config.writingCoachEnabled
  ) {
    return config
  }

  return { ...config, explicitModeSelection: true }
}

export type ChatbotStandardModeFlags = Pick<
  ChatbotStandardModeConfig,
  'tutorEnabled' | 'explainerEnabled' | 'quizzerEnabled' | 'writingCoachEnabled'
>

/** Returns the standard flags a participant actually receives. */
export function getEffectiveChatbotStandardModeFlags(
  value: unknown,
  systemPrompts: unknown = null
): ChatbotStandardModeFlags {
  const config = normalizeChatbotStandardModeConfig(value, systemPrompts)
  return {
    tutorEnabled: config.tutorEnabled,
    explainerEnabled: config.explainerEnabled,
    quizzerEnabled: config.quizzerEnabled,
    writingCoachEnabled: config.writingCoachEnabled,
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
    return parseStoredChatbotStandardModeConfig(value, systemPrompts)
  } catch {
    return defaultConfig(systemPrompts)
  }
}

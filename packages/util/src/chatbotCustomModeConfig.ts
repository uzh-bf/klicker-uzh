import { randomUUID } from 'node:crypto'
import type {
  ChatbotCustomMode,
  ChatbotCustomModeConfig,
  ChatbotCustomModeConfigInput,
} from '@klicker-uzh/types'

import {
  CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_MAX_COUNT,
  CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH,
} from './chatbotCustomModeLimits.js'

export * from './chatbotCustomModeLimits.js'

// Custom mode names must stay distinguishable from the built-in modes, so the
// reserved names are the standard mode identifiers the runtime already offers.
const RESERVED_MODE_NAMES = new Set(['tutor', 'explainer', 'quizzer'])

const MODE_KEY_PREFIX = 'cm_'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeName(value: unknown): string {
  if (typeof value !== 'string') {
    throw new Error('name must be a string')
  }

  const normalized = value.trim()
  if (normalized.length === 0) {
    throw new Error('name must not be empty')
  }
  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error('name must be a single line')
  }
  if (normalized.length > CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH) {
    throw new Error(
      `name must be at most ${CHATBOT_CUSTOM_MODE_NAME_MAX_LENGTH} characters long`
    )
  }

  return normalized
}

function normalizeDescription(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new Error('description must be a string or null')
  }

  const normalized = value.trim()
  if (normalized.includes('\n') || normalized.includes('\r')) {
    throw new Error('description must be a single line')
  }
  if (normalized.length > CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH) {
    throw new Error(
      `description must be at most ${CHATBOT_CUSTOM_MODE_DESCRIPTION_MAX_LENGTH} characters long`
    )
  }

  return normalized.length > 0 ? normalized : null
}

function normalizePersonaText(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new Error('personaText must be a string or null')
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH) {
    throw new Error(
      `personaText must be at most ${CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH} characters long`
    )
  }

  return normalized.length > 0 ? normalized : null
}

/** Mints a stable, opaque mode key; this is what messages persist. */
export function generateChatbotCustomModeKey(): string {
  return `${MODE_KEY_PREFIX}${randomUUID()}`
}

function assertUniqueNames(modes: ChatbotCustomMode[]): void {
  const seen = new Set<string>()
  for (const mode of modes) {
    const name = mode.name.toLowerCase()
    if (RESERVED_MODE_NAMES.has(name)) {
      throw new Error(`Mode name "${mode.name}" is reserved`)
    }
    if (seen.has(name)) {
      throw new Error(`Mode name "${mode.name}" is used more than once`)
    }
    seen.add(name)
  }
}

/**
 * Strictly validates and canonicalizes a full replacement of the custom modes.
 * A mode that carries the key of a mode already stored keeps that key, so a
 * rename never changes the identity stored on messages; every other mode is
 * assigned a freshly minted key.
 */
export function parseChatbotCustomModeConfigInput(
  value: ChatbotCustomModeConfigInput | unknown,
  existing: ChatbotCustomModeConfig | null = null
): ChatbotCustomModeConfig {
  if (!isRecord(value) || !Array.isArray(value.modes)) {
    throw new Error('modes must be an array')
  }
  if (value.modes.length > CHATBOT_CUSTOM_MODE_MAX_COUNT) {
    throw new Error(
      `at most ${CHATBOT_CUSTOM_MODE_MAX_COUNT} custom modes are supported`
    )
  }

  const existingKeys = new Set((existing?.modes ?? []).map((mode) => mode.key))
  const usedKeys = new Set<string>()
  const modes = value.modes.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`mode ${index + 1} must be an object`)
    }

    const providedKey = typeof entry.key === 'string' ? entry.key : null
    const key =
      providedKey !== null && existingKeys.has(providedKey)
        ? providedKey
        : generateChatbotCustomModeKey()
    if (usedKeys.has(key)) {
      throw new Error('each mode must reference a distinct stored mode')
    }
    usedKeys.add(key)

    return {
      key,
      name: normalizeName(entry.name),
      description: normalizeDescription(entry.description),
      personaText: normalizePersonaText(entry.personaText),
    }
  })

  assertUniqueNames(modes)
  return { modes }
}

function normalizeStoredMode(value: unknown): ChatbotCustomMode | null {
  if (!isRecord(value)) return null
  if (typeof value.key !== 'string') return null

  const key = value.key.trim()
  if (key.length === 0) return null

  try {
    return {
      key,
      name: normalizeName(value.name),
      description: normalizeDescription(value.description),
      personaText: normalizePersonaText(value.personaText),
    }
  } catch {
    return null
  }
}

/**
 * Tolerantly normalizes persisted JSON. Malformed entries are dropped so a bad
 * stored value cannot brick the whole revision, mirroring the standard-mode
 * reader; strict rejection stays on the write path.
 */
export function normalizeChatbotCustomModeConfig(
  value: unknown
): ChatbotCustomModeConfig | null {
  if (value === null || value === undefined) return null
  if (!isRecord(value) || !Array.isArray(value.modes)) return null

  const modes: ChatbotCustomMode[] = []
  const keys = new Set<string>()
  const names = new Set<string>()
  for (const entry of value.modes) {
    if (modes.length >= CHATBOT_CUSTOM_MODE_MAX_COUNT) break
    const mode = normalizeStoredMode(entry)
    if (!mode) continue

    const name = mode.name.toLowerCase()
    if (RESERVED_MODE_NAMES.has(name)) continue
    if (keys.has(mode.key) || names.has(name)) continue

    keys.add(mode.key)
    names.add(name)
    modes.push(mode)
  }

  return { modes }
}

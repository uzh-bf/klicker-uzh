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
  CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT,
  CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH,
  CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH,
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

function normalizePersonaText(
  value: unknown,
  maxLength: number
): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new Error('personaText must be a string or null')
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > maxLength) {
    throw new Error(`personaText must be at most ${maxLength} characters long`)
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeWelcomeMessage(value: unknown): string | null {
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') {
    throw new Error('welcomeMessage must be a string or null')
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length > CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH) {
    throw new Error(
      `welcomeMessage must be at most ${CHATBOT_CUSTOM_MODE_WELCOME_MESSAGE_MAX_LENGTH} characters long`
    )
  }

  return normalized.length > 0 ? normalized : null
}

function normalizeStarterPrompt(value: unknown, index: number): string {
  if (typeof value !== 'string') {
    throw new Error(`starterPrompts entry ${index + 1} must be a string`)
  }

  const normalized = value.replace(/\r\n?/g, '\n').trim()
  if (normalized.length === 0) {
    throw new Error(`starterPrompts entry ${index + 1} must not be empty`)
  }
  if (normalized.length > CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH) {
    throw new Error(
      `starterPrompts entry ${index + 1} must be at most ${CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH} characters long`
    )
  }

  return normalized
}

function normalizeStarterPrompts(value: unknown): string[] | null {
  if (value === undefined || value === null) return null
  if (!Array.isArray(value)) {
    throw new Error('starterPrompts must be an array')
  }
  if (value.length > CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT) {
    throw new Error(
      `starterPrompts must contain at most ${CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT} entries`
    )
  }

  const prompts = value.map((entry, index) =>
    normalizeStarterPrompt(entry, index)
  )
  return prompts.length > 0 ? prompts : null
}

function normalizeShowReasoning(value: unknown): boolean {
  if (value === null) return false
  if (typeof value !== 'boolean') {
    throw new Error('showReasoning must be a boolean or null')
  }
  return value
}

/** Mints a stable, opaque mode key; this is what messages persist. */
export function generateChatbotCustomModeKey(): string {
  return `${MODE_KEY_PREFIX}${randomUUID()}`
}

/**
 * Whether a mode key has the shape the server mints for custom modes. A
 * message can keep such a key after its mode was deleted from the config.
 */
export function isChatbotCustomModeKey(mode: string): boolean {
  return mode.startsWith(MODE_KEY_PREFIX)
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
 *
 * `personaMaxLength` bounds new or edited persona text. A mode that keeps its
 * stored persona unchanged is checked against the stored ceiling instead, so a
 * lecturer without the extended limit can still save other edits.
 */
export function parseChatbotCustomModeConfigInput(
  value: ChatbotCustomModeConfigInput | unknown,
  existing: ChatbotCustomModeConfig | null,
  personaMaxLength: number = CHATBOT_CUSTOM_MODE_PERSONA_MAX_LENGTH
): ChatbotCustomModeConfig {
  if (!isRecord(value) || !Array.isArray(value.modes)) {
    throw new Error('modes must be an array')
  }
  if (value.modes.length > CHATBOT_CUSTOM_MODE_MAX_COUNT) {
    throw new Error(
      `at most ${CHATBOT_CUSTOM_MODE_MAX_COUNT} custom modes are supported`
    )
  }

  const existingModes = new Map(
    (existing?.modes ?? []).map((mode) => [mode.key, mode])
  )
  const usedKeys = new Set<string>()
  const modes = value.modes.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`mode ${index + 1} must be an object`)
    }

    const providedKey = typeof entry.key === 'string' ? entry.key : null
    const key =
      providedKey !== null && existingModes.has(providedKey)
        ? providedKey
        : generateChatbotCustomModeKey()
    if (usedKeys.has(key)) {
      throw new Error('each mode must reference a distinct stored mode')
    }
    usedKeys.add(key)

    const storedPersona = existingModes.get(key)?.personaText ?? null
    const personaText = normalizePersonaText(
      entry.personaText,
      CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH
    )
    if (
      personaText !== null &&
      personaText !== storedPersona &&
      personaText.length > personaMaxLength
    ) {
      throw new Error(
        `personaText must be at most ${personaMaxLength} characters long`
      )
    }

    // An omitted welcome keeps the stored one, so a client that does not know
    // this field cannot silently drop authored text; null or blank clears it.
    const welcomeMessage =
      entry.welcomeMessage === undefined
        ? normalizeStoredWelcomeMessage(existingModes.get(key)?.welcomeMessage)
        : normalizeWelcomeMessage(entry.welcomeMessage)

    // Omitted starters keep the stored list, mirroring the welcome; null or an
    // empty list clears it.
    const starterPrompts =
      entry.starterPrompts === undefined
        ? readStarterPrompts(existingModes.get(key)?.starterPrompts)
        : normalizeStarterPrompts(entry.starterPrompts)

    // An omitted choice keeps the stored one, so a client that does not know
    // this field cannot silently change the lecturer's choice; null hides.
    const showReasoning =
      entry.showReasoning === undefined
        ? existingModes.get(key)?.showReasoning === true
        : normalizeShowReasoning(entry.showReasoning)

    return {
      key,
      name: normalizeName(entry.name),
      description: normalizeDescription(entry.description),
      personaText,
      ...(welcomeMessage !== null ? { welcomeMessage } : {}),
      ...(starterPrompts !== null ? { starterPrompts } : {}),
      ...(showReasoning ? { showReasoning: true } : {}),
    }
  })

  assertUniqueNames(modes)
  return { modes }
}

function normalizeStoredWelcomeMessage(value: unknown): string | null {
  try {
    return normalizeWelcomeMessage(value)
  } catch {
    return null
  }
}

/**
 * Tolerant counterpart of the strict starter validation: unusable entries are
 * dropped instead of rejecting the value, and the order of the remaining
 * entries is kept.
 */
function readStarterPrompts(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null

  const prompts: string[] = []
  for (const entry of value) {
    if (prompts.length >= CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_COUNT) break
    if (typeof entry !== 'string') continue

    const normalized = entry.replace(/\r\n?/g, '\n').trim()
    if (
      normalized.length === 0 ||
      normalized.length > CHATBOT_CUSTOM_MODE_STARTER_PROMPT_MAX_LENGTH
    ) {
      continue
    }
    prompts.push(normalized)
  }

  return prompts.length > 0 ? prompts : null
}

function normalizeStoredMode(value: unknown): ChatbotCustomMode | null {
  if (!isRecord(value)) return null
  if (typeof value.key !== 'string') return null

  const key = value.key.trim()
  if (key.length === 0) return null

  try {
    // The presentation fields are tolerated in isolation: a malformed welcome
    // or starter list must not hide an otherwise valid mode.
    const welcomeMessage = normalizeStoredWelcomeMessage(value.welcomeMessage)
    const starterPrompts = readStarterPrompts(value.starterPrompts)

    return {
      key,
      name: normalizeName(value.name),
      description: normalizeDescription(value.description),
      personaText: normalizePersonaText(
        value.personaText,
        CHATBOT_CUSTOM_MODE_PERSONA_EXTENDED_MAX_LENGTH
      ),
      ...(welcomeMessage !== null ? { welcomeMessage } : {}),
      ...(starterPrompts !== null ? { starterPrompts } : {}),
      // Anything but an explicit true keeps reasoning hidden.
      ...(value.showReasoning === true ? { showReasoning: true } : {}),
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

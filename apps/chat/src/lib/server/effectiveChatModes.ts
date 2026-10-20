import type { ChatbotCustomMode } from '@klicker-uzh/types'
import {
  isChatbotCustomModeKey,
  isChatbotStandardModeKey,
  normalizeChatbotCustomModeConfig,
  normalizeChatbotStandardModeConfig,
} from '@klicker-uzh/util'
import { DEFAULT_MODE_DESCRIPTIONS } from '@/src/lib/config/mode-descriptions'
import type { ChatModeOption, ChatModeOptions } from '@/src/lib/config/modes'
import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'

export interface EffectiveChatModeOptions {
  /**
   * The chatbot's live custom modes. Callers pass the live column, never the
   * revision snapshot, which prefers a pending draft over the approved value.
   */
  customModeConfig?: unknown
  /**
   * Owner preview keeps offering legacy stored `systemPrompts` keys so an owner
   * can try an unpublished mode. Participant paths accept only the modes the
   * chatbot carries as approved configuration.
   */
  allowUnapprovedModes?: boolean
}

export interface ChatModeMCPConfiguration {
  allowedTools?: unknown
  chatMode: string
  isEnabled?: boolean
  mcpServer?: { id?: string } | null
  mcpServerId?: string
  parameters?: unknown
  priority?: number
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function isEnabled(config: ChatModeMCPConfiguration): boolean {
  return config.isEnabled !== false
}

function isRequired(config: ChatModeMCPConfiguration): boolean {
  return asRecord(config.parameters)?.required === true
}

function getServerId(config: ChatModeMCPConfiguration): string | null {
  if (typeof config.mcpServerId === 'string') return config.mcpServerId
  return typeof config.mcpServer?.id === 'string' ? config.mcpServer.id : null
}

function hasRequiredDocQueryAlias(config: ChatModeMCPConfiguration): boolean {
  const parameters = asRecord(config.parameters)
  const allowedTools = config.allowedTools

  return !!(
    parameters?.required === true &&
    parameters.toolAlias === 'doc_query' &&
    hasConcreteAllowedTools(allowedTools) &&
    allowedTools.length === 1
  )
}

function isConcreteToolName(tool: unknown): tool is string {
  return typeof tool === 'string' && tool.length > 0 && !/[*?]/.test(tool)
}

function hasConcreteAllowedTools(
  allowedTools: unknown
): allowedTools is string[] {
  return (
    Array.isArray(allowedTools) &&
    allowedTools.length > 0 &&
    allowedTools.every(isConcreteToolName)
  )
}

function hasExplicitDocQueryTool(config: ChatModeMCPConfiguration): boolean {
  const allowedTools = config.allowedTools
  return (
    hasConcreteAllowedTools(allowedTools) && allowedTools.includes('doc_query')
  )
}

function hasSafeQuizzerToolRestriction(
  config: ChatModeMCPConfiguration
): boolean {
  return isRequired(config)
    ? hasRequiredDocQueryAlias(config)
    : hasConcreteAllowedTools(config.allowedTools)
}

export function isSafeDocQueryBinding(
  config: ChatModeMCPConfiguration
): boolean {
  return isRequired(config)
    ? hasRequiredDocQueryAlias(config)
    : hasExplicitDocQueryTool(config)
}

type EffectiveMCPConfiguration<T extends ChatModeMCPConfiguration> = Omit<
  T,
  'allowedTools' | 'chatMode'
> &
  Pick<ChatModeMCPConfiguration, 'allowedTools' | 'chatMode'>

function narrowInheritedBinding<T extends ChatModeMCPConfiguration>(
  config: T,
  targetMode: string
): EffectiveMCPConfiguration<T> {
  // Required alias bindings keep their sole raw tool name. Optional bindings
  // expose only doc_query when inherited by another mode.
  if (hasRequiredDocQueryAlias(config)) {
    return { ...config, chatMode: targetMode }
  }

  return {
    ...config,
    allowedTools: ['doc_query'],
    chatMode: targetMode,
  }
}

function sortByPriority<T extends ChatModeMCPConfiguration>(configs: T[]): T[] {
  return configs.sort((left, right) => {
    return (left.priority ?? 0) - (right.priority ?? 0)
  })
}

export function resolveEffectiveMCPConfigurations<
  T extends ChatModeMCPConfiguration,
>(configs: readonly T[], selectedMode: string): EffectiveMCPConfiguration<T>[] {
  if (selectedMode !== 'quizzer' && isChatbotStandardModeKey(selectedMode)) {
    return sortByPriority(
      configs.filter(
        (config) => config.chatMode === selectedMode && isEnabled(config)
      )
    )
  }

  if (selectedMode !== 'quizzer') {
    // Custom modes inherit only a required doc-query binding, re-tagged to
    // the custom mode key so the scope assertion sees one binding per mode.
    const exactByServer = new Map<string, T>()
    const exactWithoutServer: T[] = []

    for (const config of configs) {
      if (config.chatMode !== selectedMode || !isEnabled(config)) continue
      const serverId = getServerId(config)
      if (serverId) {
        exactByServer.set(serverId, config)
      } else {
        exactWithoutServer.push(config)
      }
    }

    const resolved: EffectiveMCPConfiguration<T>[] = [
      ...exactWithoutServer,
      ...Array.from(exactByServer.values()),
    ].map((config) => ({ ...config, chatMode: selectedMode }))

    for (const sourceMode of ['tutor', 'explainer'] as const) {
      for (const config of configs) {
        if (
          config.chatMode !== sourceMode ||
          !isEnabled(config) ||
          !isRequired(config) ||
          !hasRequiredDocQueryAlias(config)
        ) {
          continue
        }

        const serverId = getServerId(config)
        if (!serverId || exactByServer.has(serverId)) continue
        exactByServer.set(serverId, config)
        resolved.push(narrowInheritedBinding(config, selectedMode))
      }
    }

    return sortByPriority(resolved)
  }

  const exactByServer = new Map<string, T>()
  const exactWithoutServer: T[] = []

  for (const config of configs) {
    if (config.chatMode !== 'quizzer') continue
    const serverId = getServerId(config)
    if (serverId) exactByServer.set(serverId, config)
    else if (isEnabled(config)) exactWithoutServer.push(config)
  }

  const resolved: EffectiveMCPConfiguration<T>[] = [
    ...exactWithoutServer.filter(hasSafeQuizzerToolRestriction),
    ...Array.from(exactByServer.values()).filter(
      (config) => isEnabled(config) && hasSafeQuizzerToolRestriction(config)
    ),
  ]

  for (const config of configs) {
    if (
      config.chatMode !== 'tutor' ||
      !isEnabled(config) ||
      !isSafeDocQueryBinding(config)
    ) {
      continue
    }

    const serverId = getServerId(config)
    if (!serverId || exactByServer.has(serverId)) continue
    resolved.push(narrowInheritedBinding(config, 'quizzer'))
  }

  return sortByPriority(resolved)
}

export function resolveRequestedChatMode(
  modeOptions: Record<string, unknown>,
  requestedMode: string
): string {
  if (Object.hasOwn(modeOptions, requestedMode)) return requestedMode

  const normalizedMode = requestedMode.toLowerCase()
  const isStandardMode = Object.hasOwn(DEFAULT_PROMPT, normalizedMode)
  return isStandardMode && Object.hasOwn(modeOptions, normalizedMode)
    ? normalizedMode
    : requestedMode
}

function isModeExplicitlyDisabled(
  systemPrompts: unknown,
  mode: string
): boolean {
  const modeConfig = asRecord(asRecord(systemPrompts)?.[mode])
  return modeConfig?.enabled === false
}

function isStandardModeEnabled(
  standardModeConfig: unknown,
  systemPrompts: unknown,
  mode: string
): boolean {
  const normalizedConfig = normalizeChatbotStandardModeConfig(
    standardModeConfig,
    systemPrompts
  )

  if (isChatbotStandardModeKey(mode)) {
    if (mode === 'tutor') return normalizedConfig.tutorEnabled
    if (mode === 'explainer') return normalizedConfig.explainerEnabled
    return normalizedConfig.quizzerEnabled
  }

  return !isModeExplicitlyDisabled(systemPrompts, mode)
}

function getModeDescription(systemPrompts: unknown, mode: string): string {
  const defaultDescription = (
    DEFAULT_MODE_DESCRIPTIONS as Record<string, string>
  )[mode]
  if (typeof defaultDescription === 'string') return defaultDescription

  const modeConfig = asRecord(asRecord(systemPrompts)?.[mode])
  return typeof modeConfig?.description === 'string'
    ? modeConfig.description
    : ''
}

function getApprovedCustomModesByKey(
  customModeConfig: unknown
): Map<string, ChatbotCustomMode> {
  const modes = normalizeChatbotCustomModeConfig(customModeConfig)?.modes ?? []
  const modesByKey = new Map<string, ChatbotCustomMode>()

  for (const mode of modes) {
    // Standard-mode keys stay platform-owned, so a stored entry that reuses one
    // can never replace the platform label or the platform mode contract.
    if (isChatbotStandardModeKey(mode.key) || modesByKey.has(mode.key)) continue
    modesByKey.set(mode.key, mode)
  }

  return modesByKey
}

/**
 * Whether a participant may receive the model's reasoning for a turn in
 * `mode`, judged against the live approved config. Standard and legacy stored
 * modes keep showing it. An approved custom mode shows it only after the
 * lecturer opted in, and a custom key that is no longer approved stays
 * hidden, because its stored reasoning can still echo the removed persona.
 */
export function isParticipantReasoningVisible(
  customModeConfig: unknown,
  mode: string | null | undefined
): boolean {
  if (!mode) return true

  const customMode = getApprovedCustomModesByKey(customModeConfig).get(mode)
  if (customMode) return customMode.showReasoning === true

  return !isChatbotCustomModeKey(mode)
}

/**
 * The per-turn settings of the custom mode `mode` in `customModeConfig`: its
 * locked reply language and meeting clock. Standard modes and keys without a
 * custom mode have neither.
 */
export function getCustomModeTurnSettings(
  customModeConfig: unknown,
  mode: string
): Pick<ChatbotCustomMode, 'replyLanguage' | 'meetingClock'> {
  const customMode = getApprovedCustomModesByKey(customModeConfig).get(mode)
  return {
    replyLanguage: customMode?.replyLanguage ?? null,
    meetingClock: customMode?.meetingClock ?? null,
  }
}

function getCustomModeDescription(mode: ChatbotCustomMode): string {
  // The switcher and the welcome card fall back to this string for a mode
  // without an i18n entry, so a mode without a description still needs label
  // text a participant can read.
  return mode.description ?? mode.name
}

function getCustomModeOption(mode: ChatbotCustomMode): ChatModeOption {
  return {
    description: getCustomModeDescription(mode),
    name: mode.name,
    ...(mode.welcomeMessage ? { welcomeMessage: mode.welcomeMessage } : {}),
    ...(mode.starterPrompts?.length
      ? { starterPrompts: mode.starterPrompts }
      : {}),
    ...(mode.replyLanguage ? { replyLanguage: mode.replyLanguage } : {}),
    ...(mode.meetingClock ? { meetingClock: mode.meetingClock } : {}),
  }
}

export function resolveEffectiveChatModeOptions(
  systemPrompts: unknown,
  mcpConfigurations: readonly ChatModeMCPConfiguration[],
  standardModeConfig: unknown = null,
  options: EffectiveChatModeOptions = {}
): ChatModeOptions {
  const storedPrompts = asRecord(systemPrompts)
  const standardModes = Object.keys(DEFAULT_PROMPT)
  const customModesByKey = getApprovedCustomModesByKey(options.customModeConfig)
  const storedModes =
    options.allowUnapprovedModes && storedPrompts
      ? Object.keys(storedPrompts)
      : []
  const candidates = Array.from(
    new Set([...standardModes, ...customModesByKey.keys(), ...storedModes])
  )
  const modeOptions: ChatModeOptions = {}

  for (const mode of candidates) {
    if (mode.trim().length === 0) continue
    if (!isStandardModeEnabled(standardModeConfig, systemPrompts, mode)) {
      continue
    }

    const customMode = customModesByKey.get(mode)
    const effectiveConfigurations = resolveEffectiveMCPConfigurations(
      mcpConfigurations,
      mode
    )
    if (
      mode === 'quizzer' &&
      !effectiveConfigurations.some(isSafeDocQueryBinding)
    ) {
      continue
    }

    modeOptions[mode] = customMode
      ? getCustomModeOption(customMode)
      : { description: getModeDescription(systemPrompts, mode) }
  }

  return modeOptions
}

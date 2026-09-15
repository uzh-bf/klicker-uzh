import type { ChatbotCustomMode } from '@klicker-uzh/types'
import {
  normalizeChatbotCustomModeConfig,
  normalizeChatbotStandardModeConfig,
} from '@klicker-uzh/util'
import { DEFAULT_MODE_DESCRIPTIONS } from '@/src/lib/config/mode-descriptions'
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
  config: T
): EffectiveMCPConfiguration<T> {
  // Required alias bindings keep their sole raw tool name. Optional Tutor
  // bindings expose only doc_query when inherited by Quizzer.
  if (hasRequiredDocQueryAlias(config)) {
    return { ...config, chatMode: 'quizzer' }
  }

  return {
    ...config,
    allowedTools: ['doc_query'],
    chatMode: 'quizzer',
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
  if (selectedMode !== 'quizzer') {
    return sortByPriority(
      configs.filter(
        (config) => config.chatMode === selectedMode && isEnabled(config)
      )
    )
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
    resolved.push(narrowInheritedBinding(config))
  }

  return sortByPriority(resolved)
}

export function resolveRequestedChatMode(
  modeOptions: Record<string, string>,
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

function isTypedStandardMode(
  mode: string
): mode is 'tutor' | 'explainer' | 'quizzer' {
  return mode === 'tutor' || mode === 'explainer' || mode === 'quizzer'
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

  if (isTypedStandardMode(mode)) {
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
    if (isTypedStandardMode(mode.key) || modesByKey.has(mode.key)) continue
    modesByKey.set(mode.key, mode)
  }

  return modesByKey
}

function getCustomModeDescription(mode: ChatbotCustomMode): string {
  // The switcher and the welcome card fall back to this string for a mode
  // without an i18n entry, so a mode without a description still needs label
  // text a participant can read.
  return mode.description ?? mode.name
}

export function resolveEffectiveChatModeOptions(
  systemPrompts: unknown,
  mcpConfigurations: readonly ChatModeMCPConfiguration[],
  standardModeConfig: unknown = null,
  options: EffectiveChatModeOptions = {}
): Record<string, string> {
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
  const hasRequiredMCP = mcpConfigurations.some(
    (config) => isEnabled(config) && isRequired(config)
  )
  const modeOptions: Record<string, string> = {}

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
    if (hasRequiredMCP && !effectiveConfigurations.some(isRequired)) {
      continue
    }

    modeOptions[mode] = customMode
      ? getCustomModeDescription(customMode)
      : getModeDescription(systemPrompts, mode)
  }

  return modeOptions
}

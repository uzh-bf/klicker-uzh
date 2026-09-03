import { normalizeChatbotStandardModeConfig } from '@klicker-uzh/util'
import { DEFAULT_MODE_DESCRIPTIONS } from '@/src/lib/config/mode-descriptions'
import { DEFAULT_PROMPT } from '@/src/lib/config/prompts'

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

function isTypedStandardMode(mode: string): mode is 'tutor' | 'explainer' {
  return mode === 'tutor' || mode === 'explainer'
}

function isStandardModeEnabled(
  standardModeConfig: unknown,
  systemPrompts: unknown,
  mode: string
): boolean {
  const normalizedConfig =
    normalizeChatbotStandardModeConfig(standardModeConfig)

  if (normalizedConfig && isTypedStandardMode(mode)) {
    return mode === 'tutor'
      ? normalizedConfig.tutorEnabled
      : normalizedConfig.explainerEnabled
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

export function resolveEffectiveChatModeOptions(
  systemPrompts: unknown,
  mcpConfigurations: readonly ChatModeMCPConfiguration[],
  standardModeConfig: unknown = null
): Record<string, string> {
  const storedPrompts = asRecord(systemPrompts)
  const standardModes = Object.keys(DEFAULT_PROMPT)
  const storedModes = storedPrompts ? Object.keys(storedPrompts) : []
  const candidates = Array.from(new Set([...standardModes, ...storedModes]))
  const hasRequiredMCP = mcpConfigurations.some(
    (config) => isEnabled(config) && isRequired(config)
  )
  const modeOptions: Record<string, string> = {}

  for (const mode of candidates) {
    if (mode.trim().length === 0) continue
    if (!isStandardModeEnabled(standardModeConfig, systemPrompts, mode)) {
      continue
    }

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

    modeOptions[mode] = getModeDescription(systemPrompts, mode)
  }

  return modeOptions
}

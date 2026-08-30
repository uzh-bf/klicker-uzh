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
    Array.isArray(allowedTools) &&
    allowedTools.length === 1 &&
    typeof allowedTools[0] === 'string' &&
    allowedTools[0].length > 0 &&
    !/[*?]/.test(allowedTools[0])
  )
}

function hasExplicitDocQueryTool(config: ChatModeMCPConfiguration): boolean {
  const allowedTools = config.allowedTools
  return (
    Array.isArray(allowedTools) &&
    allowedTools.length > 0 &&
    allowedTools.every(
      (tool) =>
        typeof tool === 'string' && tool.length > 0 && !/[*?]/.test(tool)
    ) &&
    allowedTools.includes('doc_query')
  )
}

export function isSafeDocQueryBinding(
  config: ChatModeMCPConfiguration
): boolean {
  return isRequired(config)
    ? hasRequiredDocQueryAlias(config)
    : hasExplicitDocQueryTool(config)
}

function narrowInheritedBinding<T extends ChatModeMCPConfiguration>(
  config: T
): T {
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
>(configs: readonly T[], selectedMode: string): T[] {
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

  const resolved = [
    ...exactWithoutServer,
    ...Array.from(exactByServer.values()).filter(isEnabled),
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

function isModeExplicitlyDisabled(
  systemPrompts: unknown,
  mode: string
): boolean {
  const modeConfig = asRecord(asRecord(systemPrompts)?.[mode])
  return modeConfig?.enabled === false
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
  mcpConfigurations: readonly ChatModeMCPConfiguration[]
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
    if (isModeExplicitlyDisabled(systemPrompts, mode)) continue

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

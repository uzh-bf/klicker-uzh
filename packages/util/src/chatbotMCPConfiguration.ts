import { isChatbotStandardModeKey } from './chatbotStandardModeConfig.js'

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

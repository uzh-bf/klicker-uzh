import { RequiredMCPUnavailableError } from '@/src/lib/server/mcpRuntimePolicy'

export const DOC_QUERY_MCP_SERVER_NAME = 'KB'
export const DOC_QUERY_TOOL_NAME = `${DOC_QUERY_MCP_SERVER_NAME}_doc_query`
export const DOC_QUERY_SCOPE_TOKEN_HEADER = 'X-Doc-Query-Scope-Token'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface MCPScopedConfiguration {
  chatMode?: unknown
  parameters?: unknown
  mcpServer?: {
    id?: unknown
    name?: unknown
  } | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requiredScopeError(): never {
  throw new RequiredMCPUnavailableError()
}

type ResolvedMcpScope = {
  chatMode: string
  serverId: string
  kbId: string
}

/**
 * Normalizes the external knowledge-base identifier used by the scope token.
 * Only canonical UUID strings are accepted; surrounding whitespace and case
 * do not affect the stored identity.
 */
export function normalizeDocQueryKbId(value: unknown): string {
  if (typeof value !== 'string') requiredScopeError()

  const normalized = value.trim().toLowerCase()
  if (!UUID_PATTERN.test(normalized)) requiredScopeError()

  return normalized
}

function isInternalTransportHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (
    host === 'localhost' ||
    host === '::1' ||
    host.endsWith('.svc') ||
    host.endsWith('.internal') ||
    host.endsWith('.local')
  ) {
    return true
  }
  const parts = host.split('.')
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) {
    return false
  }
  const [first, second] = parts.map((part) => Number(part))
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  )
}

/**
 * Doc Query credentials must not traverse a public network in cleartext.
 * Plain HTTP is accepted only for clearly internal endpoints such as
 * loopback, cluster-local, or RFC1918 addresses; every other target must
 * use HTTPS before any credential header is attached.
 */
export function assertDocQueryTransportSecurity(rawUrl: string): void {
  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    throw new Error('Doc Query transport URL is invalid')
  }
  if (url.protocol === 'https:') return
  if (url.protocol === 'http:' && isInternalTransportHost(url.hostname)) {
    return
  }
  throw new Error('Doc Query transport requires HTTPS')
}

function resolveKbConfiguration(
  configuration: MCPScopedConfiguration
): ResolvedMcpScope | undefined {
  const config = isRecord(configuration) ? configuration : null
  const parameters = isRecord(config?.parameters) ? config.parameters : null
  const server = isRecord(config?.mcpServer) ? config.mcpServer : null
  const serverName = server?.name
  const serverId = server?.id
  const hasKbId = parameters !== null && Object.hasOwn(parameters, 'kb_id')

  // The reserved binding is meaningful only on the exact KB server. This
  // prevents a typo or copied parameter from silently scoping another MCP.
  if (hasKbId && serverName !== DOC_QUERY_MCP_SERVER_NAME) {
    requiredScopeError()
  }

  if (serverName !== DOC_QUERY_MCP_SERVER_NAME) return undefined

  if (
    parameters === null ||
    !Object.hasOwn(parameters, 'kb_id') ||
    parameters.required !== true ||
    parameters.toolAlias !== 'doc_query' ||
    typeof config?.chatMode !== 'string' ||
    config.chatMode.trim().length === 0 ||
    typeof serverId !== 'string' ||
    serverId.trim().length === 0
  ) {
    requiredScopeError()
  }

  return {
    chatMode: config.chatMode,
    serverId,
    kbId: normalizeDocQueryKbId(parameters.kb_id),
  }
}

function assertOneScope(configurations: ResolvedMcpScope[]): void {
  const serverIds = new Set(configurations.map(({ serverId }) => serverId))
  const kbIds = new Set(configurations.map(({ kbId }) => kbId))
  if (serverIds.size !== 1 || kbIds.size !== 1) requiredScopeError()
}

function assertOneConfigurationPerMode(
  configurations: ResolvedMcpScope[]
): void {
  const configurationsByMode = new Map<string, number>()
  for (const { chatMode } of configurations) {
    configurationsByMode.set(
      chatMode,
      (configurationsByMode.get(chatMode) ?? 0) + 1
    )
  }
  if ([...configurationsByMode.values()].some((count) => count !== 1)) {
    requiredScopeError()
  }
}

function assertEffectiveConfigurationMatchesScope(
  configurations: ResolvedMcpScope[],
  selectedMode: string,
  expected: ResolvedMcpScope
): void {
  if (
    configurations.length !== 1 ||
    configurations[0].chatMode !== selectedMode ||
    configurations[0].serverId !== expected.serverId ||
    configurations[0].kbId !== expected.kbId
  ) {
    requiredScopeError()
  }
}

/**
 * Resolves the one knowledge-base scope shared by the enabled configuration
 * snapshot. A chatbot becomes scoped as soon as an enabled KB configuration
 * is present, and every KB mode must then have one consistent binding.
 */
export function resolveMcpScope(
  configurations: readonly MCPScopedConfiguration[],
  selectedMode: string,
  effectiveConfigurations: readonly MCPScopedConfiguration[]
): string | undefined {
  if (
    !Array.isArray(configurations) ||
    !Array.isArray(effectiveConfigurations) ||
    typeof selectedMode !== 'string'
  ) {
    requiredScopeError()
  }

  const kbConfigurations = configurations
    .map(resolveKbConfiguration)
    .filter(
      (configuration): configuration is ResolvedMcpScope =>
        configuration !== undefined
    )

  if (kbConfigurations.length === 0) return undefined

  assertOneScope(kbConfigurations)
  assertOneConfigurationPerMode(kbConfigurations)

  const effectiveKbConfigurations = effectiveConfigurations
    .map(resolveKbConfiguration)
    .filter(
      (configuration): configuration is ResolvedMcpScope =>
        configuration !== undefined
    )
  assertEffectiveConfigurationMatchesScope(
    effectiveKbConfigurations,
    selectedMode,
    kbConfigurations[0]
  )

  return kbConfigurations[0].kbId
}

export function resolveMcpScopeSessionId({
  requestedThreadId,
  owningThreadId,
  fallbackId,
}: {
  requestedThreadId?: string | null
  owningThreadId?: string
  fallbackId: string
}): string | null {
  if (requestedThreadId && requestedThreadId !== owningThreadId) {
    return null
  }

  return owningThreadId ?? fallbackId
}

export function canLoadMCPServer(
  server: { name: string; authType: string },
  context: {
    chatbotId?: string
    participantId?: string
    kbId?: string
    sessionId?: string
  }
): boolean {
  const authType = server.authType.toLowerCase()

  if (server.name === DOC_QUERY_MCP_SERVER_NAME) {
    return Boolean(context.kbId) && Boolean(context.sessionId)
  }

  return authType !== 'scope_token'
}

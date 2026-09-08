import { RequiredMCPUnavailableError } from '@/src/lib/server/mcpRuntimePolicy'

export const DOC_QUERY_MCP_SERVER_NAME = 'KB'
export const DOC_QUERY_SCOPE_TOKEN_HEADER = 'X-Doc-Query-Scope-Token'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DOC_QUERY_KB_IDS = 32

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
  kbIds: string[]
  representation: 'kb_id' | 'kb_ids'
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

/**
 * Normalizes and bounds the multi-knowledge-base scope used by Doc Query.
 * Sorting makes mode comparisons deterministic while retaining singleton
 * compatibility at the JWT boundary.
 */
export function normalizeDocQueryKbIds(value: unknown): string[] {
  if (!Array.isArray(value)) requiredScopeError()
  if (value.length < 1 || value.length > MAX_DOC_QUERY_KB_IDS) {
    requiredScopeError()
  }

  const normalized = value.map(normalizeDocQueryKbId)
  if (new Set(normalized).size !== normalized.length) requiredScopeError()

  return [...normalized].sort((left, right) => left.localeCompare(right))
}

type ResolvedDocQueryParameters = Pick<
  ResolvedMcpScope,
  'kbIds' | 'representation'
>

function resolveDocQueryParameters(value: unknown): ResolvedDocQueryParameters {
  const parameters = isRecord(value) ? value : null
  const hasKbId = parameters !== null && Object.hasOwn(parameters, 'kb_id')
  const hasKbIds = parameters !== null && Object.hasOwn(parameters, 'kb_ids')
  if (
    parameters === null ||
    hasKbId === hasKbIds ||
    parameters.required !== true ||
    parameters.toolAlias !== 'doc_query'
  ) {
    requiredScopeError()
  }

  if (hasKbId) {
    return {
      kbIds: [normalizeDocQueryKbId(parameters.kb_id)],
      representation: 'kb_id',
    }
  }
  if (!Array.isArray(parameters.kb_ids) || parameters.kb_ids.length < 2) {
    requiredScopeError()
  }
  return {
    kbIds: normalizeDocQueryKbIds(parameters.kb_ids),
    representation: 'kb_ids',
  }
}

export function assertDocQueryRequestScope(
  parameters: unknown,
  requestedKbIds: unknown
): void {
  const configured = resolveDocQueryParameters(parameters).kbIds
  const requested = normalizeDocQueryKbIds(requestedKbIds)
  if (
    configured.length !== requested.length ||
    configured.some((kbId, index) => kbId !== requested[index])
  ) {
    requiredScopeError()
  }
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
  const hasKbIds = parameters !== null && Object.hasOwn(parameters, 'kb_ids')
  if (hasKbId && hasKbIds) requiredScopeError()

  // The reserved binding is meaningful only on the exact KB server. This
  // prevents a typo or copied parameter from silently scoping another MCP.
  if ((hasKbId || hasKbIds) && serverName !== DOC_QUERY_MCP_SERVER_NAME) {
    requiredScopeError()
  }

  if (serverName !== DOC_QUERY_MCP_SERVER_NAME) return undefined

  if (
    parameters === null ||
    typeof config?.chatMode !== 'string' ||
    config.chatMode.trim().length === 0 ||
    typeof serverId !== 'string' ||
    serverId.trim().length === 0
  ) {
    requiredScopeError()
  }

  const { representation, kbIds } = resolveDocQueryParameters(parameters)

  return {
    chatMode: config.chatMode,
    serverId,
    kbIds,
    representation,
  }
}

function assertOneScope(configurations: ResolvedMcpScope[]): void {
  const serverIds = new Set(configurations.map(({ serverId }) => serverId))
  const representations = new Set(
    configurations.map(({ representation }) => representation)
  )
  const firstKbIds = configurations[0]?.kbIds
  const hasSameKbSet = configurations.every(
    ({ kbIds }) =>
      firstKbIds !== undefined &&
      kbIds.length === firstKbIds.length &&
      kbIds.every((kbId, index) => kbId === firstKbIds[index])
  )
  if (serverIds.size !== 1 || representations.size !== 1 || !hasSameKbSet) {
    requiredScopeError()
  }
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
    configurations[0].representation !== expected.representation ||
    configurations[0].kbIds.length !== expected.kbIds.length ||
    configurations[0].kbIds.some(
      (kbId, index) => kbId !== expected.kbIds[index]
    )
  ) {
    requiredScopeError()
  }
}

/**
 * Resolves the knowledge-base scope shared by the enabled configuration
 * snapshot. A chatbot becomes scoped as soon as an enabled KB configuration
 * is present, and every KB mode must then have one consistent binding.
 */
export function resolveMcpScope(
  configurations: readonly MCPScopedConfiguration[],
  selectedMode: string,
  effectiveConfigurations: readonly MCPScopedConfiguration[]
): string[] | undefined {
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

  return [...kbConfigurations[0].kbIds]
}

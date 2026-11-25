import {
  isSafeDocQueryBinding,
  resolveEffectiveMCPConfigurations,
} from '@klicker-uzh/util'
import { RequiredMCPUnavailableError } from '@/src/lib/server/mcpRuntimePolicy'

export const DOC_QUERY_MCP_SERVER_NAME = 'KB'
export const DOC_QUERY_TOOL_NAME = `${DOC_QUERY_MCP_SERVER_NAME}_doc_query`
// The shared doc-query client owns the transport-security allowlist and the
// scope-token header so the chat and graphql workloads cannot drift apart.
export {
  assertDocQueryTransportSecurity,
  createDocQueryScopedFetch,
  DOC_QUERY_SCOPE_TOKEN_HEADER,
  type DocQueryScopedFetch,
  resolveDocQueryScopedRoute,
} from '@klicker-uzh/doc-query-client'

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_DOC_QUERY_KB_IDS = 32

export interface MCPScopedConfiguration {
  allowedTools?: unknown
  chatMode?: string
  isEnabled?: boolean
  parameters?: unknown
  priority?: number
  mcpServer?: {
    id?: string
    name?: string
  } | null
}

export interface ChatbotKnowledgeBaseLink {
  id: string
  kbId: string
  isEnabled: boolean
  isDefault: boolean
  kb: {
    deletedAt: Date | null
    name?: string
    knowledgeGraphEnabled?: boolean
  } | null
}

export interface GraphKnowledgeBaseChoice {
  id: string
  name: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function requiredScopeError(): never {
  // Scope binding and isolation failures must never be softened into a
  // page-only answer, so they carry the fail-closed reason.
  throw new RequiredMCPUnavailableError('scope_violation')
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
 * is present, and every KB binding must then resolve one consistent scope. A
 * selected mode that carries no enabled KB binding serves without a scope.
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
  // A mode with no knowledge-base binding serves without retrieval instead of
  // failing the request. The chatbot-wide scope checks above still constrain
  // every mode that does bind one.
  if (effectiveKbConfigurations.length === 0) return undefined
  assertEffectiveConfigurationMatchesScope(
    effectiveKbConfigurations,
    selectedMode,
    kbConfigurations[0]
  )

  return [...kbConfigurations[0].kbIds]
}

function configuredModeKnowledgeBaseLinkId(
  customModeConfig: unknown,
  selectedMode: string
): string | null {
  const config = isRecord(customModeConfig) ? customModeConfig : null
  const modes = Array.isArray(config?.modes) ? config.modes : []
  const mode = modes.find(
    (candidate) =>
      isRecord(candidate) &&
      candidate.key === selectedMode &&
      Object.hasOwn(candidate, 'knowledgeBaseLinkId')
  )
  if (!isRecord(mode) || mode.knowledgeBaseLinkId === null) return null

  if (
    typeof mode.knowledgeBaseLinkId !== 'string' ||
    !UUID_PATTERN.test(mode.knowledgeBaseLinkId.trim())
  ) {
    requiredScopeError()
  }
  return mode.knowledgeBaseLinkId.trim().toLowerCase()
}

export function ownedKnowledgeBaseLinks<
  T extends ChatbotKnowledgeBaseLink & { kb: { ownerId: string } | null },
>(links: readonly T[], ownerId: string): T[] {
  return links.map((link) =>
    link.kb?.ownerId === ownerId ? link : { ...link, isEnabled: false }
  )
}

function isLiveKnowledgeBaseLink(link: ChatbotKnowledgeBaseLink): boolean {
  return link.isEnabled === true && link.kb?.deletedAt === null
}

/**
 * Resolves the one live source a mode may use. Any link rows make the chatbot
 * managed, so stale MCP projections cannot silently become a legacy wildcard.
 * A configuration with no managed rows keeps the pre-link admission path.
 */
export function resolveConfiguredModeKnowledgeBaseLink({
  customModeConfig,
  selectedMode,
  knowledgeBaseLinks,
}: {
  customModeConfig: unknown
  selectedMode: string
  knowledgeBaseLinks: readonly ChatbotKnowledgeBaseLink[]
}):
  | { managed: false; link: null }
  | { managed: true; link: ChatbotKnowledgeBaseLink | null } {
  const requestedLinkId = configuredModeKnowledgeBaseLinkId(
    customModeConfig,
    selectedMode
  )
  if (knowledgeBaseLinks.length === 0) {
    if (requestedLinkId) requiredScopeError()
    return { managed: false, link: null }
  }

  const liveLinks = knowledgeBaseLinks.filter(isLiveKnowledgeBaseLink)
  if (requestedLinkId) {
    const link = liveLinks.find(
      ({ id }) => id.toLowerCase() === requestedLinkId
    )
    if (!link) requiredScopeError()
    return { managed: true, link }
  }

  const defaults = liveLinks.filter(({ isDefault }) => isDefault === true)
  if (defaults.length > 1) requiredScopeError()
  return { managed: true, link: defaults[0] ?? null }
}

function isKnowledgeBaseConfiguration(configuration: MCPScopedConfiguration) {
  return configuration.mcpServer?.name === DOC_QUERY_MCP_SERVER_NAME
}

/**
 * Narrows an admission-scope configuration to the shape the shared Doc Query
 * binding validator understands, so a configuration without a string mode is
 * treated as non-Doc-Query instead of being asserted away.
 */
function isSafeScopedDocQueryBinding(
  configuration: MCPScopedConfiguration
): boolean {
  if (typeof configuration.chatMode !== 'string') return false

  return isSafeDocQueryBinding({
    allowedTools: configuration.allowedTools,
    chatMode: configuration.chatMode,
    parameters: configuration.parameters,
  })
}

function scopeKnowledgeBaseConfiguration<T extends MCPScopedConfiguration>(
  configuration: T,
  kbId: string
): T {
  const parameters = isRecord(configuration.parameters)
    ? configuration.parameters
    : null
  if (
    parameters === null ||
    (!Object.hasOwn(parameters, 'kb_id') &&
      !Object.hasOwn(parameters, 'kb_ids'))
  ) {
    requiredScopeError()
  }

  const scopedParameters = { ...parameters, kb_id: kbId }
  const nextParameters: Record<string, unknown> = scopedParameters
  delete nextParameters.kb_ids
  return { ...configuration, parameters: nextParameters }
}

export interface ResolvedModeKnowledgeBaseScope<
  T extends MCPScopedConfiguration,
> {
  mode: 'legacy' | 'managed'
  effectiveConfigurations: T[]
  kbIds?: string[]
  link: ChatbotKnowledgeBaseLink | null
  hasDocQueryAccess: boolean
  useCanonicalDocQuery?: boolean
}

export function knowledgeBaseScopeMatches(
  left: ResolvedModeKnowledgeBaseScope<MCPScopedConfiguration>,
  right: ResolvedModeKnowledgeBaseScope<MCPScopedConfiguration>
): boolean {
  const leftKbIds = left.kbIds ?? []
  const rightKbIds = right.kbIds ?? []
  return (
    left.mode === right.mode &&
    left.hasDocQueryAccess === right.hasDocQueryAccess &&
    left.link?.id === right.link?.id &&
    leftKbIds.length === rightKbIds.length &&
    leftKbIds.every((kbId, index) => kbId === rightKbIds[index])
  )
}

/**
 * Applies a mode's live source choice to its effective MCP configurations.
 * The selected mode receives one scalar Doc Query scope. Other MCP tools and
 * the mode's existing allowed-tool restrictions remain unchanged.
 */
export function resolveModeKnowledgeBaseScope<
  T extends MCPScopedConfiguration,
>({
  customModeConfig,
  selectedMode,
  knowledgeBaseLinks,
  configurations,
  effectiveConfigurations,
}: {
  customModeConfig: unknown
  selectedMode: string
  knowledgeBaseLinks: readonly ChatbotKnowledgeBaseLink[]
  /**
   * The chatbot-wide enabled snapshot. The legacy path validates every mode's
   * binding against it, so a newly linked KB cannot be admitted as a wildcard.
   */
  configurations?: readonly T[]
  effectiveConfigurations: readonly T[]
}): ResolvedModeKnowledgeBaseScope<T> {
  const selection = resolveConfiguredModeKnowledgeBaseLink({
    customModeConfig,
    selectedMode,
    knowledgeBaseLinks,
  })

  if (!selection.managed) {
    const kbIds = resolveMcpScope(
      (configurations ?? effectiveConfigurations).filter(
        (config) => config.isEnabled !== false
      ),
      selectedMode,
      effectiveConfigurations
    )
    return {
      mode: 'legacy',
      effectiveConfigurations: [...effectiveConfigurations],
      ...(kbIds ? { kbIds } : {}),
      link: null,
      hasDocQueryAccess: Boolean(kbIds?.length),
    }
  }

  // Malformed scope declarations must not disappear during mode/tool filtering.
  // Each enabled row is validated independently so distinct authorized KBs can coexist.
  for (const configuration of configurations ?? effectiveConfigurations) {
    if (configuration.isEnabled !== false) resolveKbConfiguration(configuration)
  }
  const link = selection.link
  const explicit = configuredModeKnowledgeBaseLinkId(
    customModeConfig,
    selectedMode
  )
  if (link && explicit) {
    const exactKbRows = (configurations ?? []).filter(
      (row) =>
        row.chatMode === selectedMode && isKnowledgeBaseConfiguration(row)
    )
    if (exactKbRows.some((row) => row.isEnabled === false)) requiredScopeError()
    const kbRows = effectiveConfigurations.filter(isKnowledgeBaseConfiguration)
    if (kbRows.length === 0) {
      // A reviewed assignment authorizes one document search even on a new
      // custom-only chatbot that has never had a default or an MCP override.
      return {
        mode: 'managed',
        effectiveConfigurations: [...effectiveConfigurations],
        kbIds: [normalizeDocQueryKbId(link.kbId)],
        link,
        hasDocQueryAccess: true,
        useCanonicalDocQuery: true,
      }
    }
    if (!kbRows.every(isSafeScopedDocQueryBinding)) requiredScopeError()
  }
  const withoutRetrieval = link
    ? effectiveConfigurations.map((configuration) =>
        isKnowledgeBaseConfiguration(configuration)
          ? scopeKnowledgeBaseConfiguration(configuration, link.kbId)
          : configuration
      )
    : effectiveConfigurations.filter(
        (configuration) => !isKnowledgeBaseConfiguration(configuration)
      )
  const kbIds = resolveMcpScope(
    withoutRetrieval,
    selectedMode,
    withoutRetrieval
  )
  const hasDocQueryAccess = withoutRetrieval.some(
    (configuration) =>
      isKnowledgeBaseConfiguration(configuration) &&
      isSafeScopedDocQueryBinding(configuration)
  )

  return {
    mode: 'managed',
    effectiveConfigurations: [...withoutRetrieval],
    ...(kbIds ? { kbIds } : {}),
    link,
    hasDocQueryAccess,
  }
}

/**
 * Sources available in the separate graph browser come only from enabled,
 * approved modes that actually carry an enabled Doc Query binding. Merely
 * attaching a KB, or selecting it in an unpublished revision, never qualifies.
 */
export function resolveGraphKnowledgeBaseChoices({
  modes,
  customModeConfig,
  knowledgeBaseLinks,
  mcpConfigurations,
}: {
  modes: readonly string[]
  customModeConfig: unknown
  knowledgeBaseLinks: readonly ChatbotKnowledgeBaseLink[]
  mcpConfigurations: readonly (MCPScopedConfiguration & { chatMode: string })[]
}): GraphKnowledgeBaseChoice[] {
  const choices = new Map<string, GraphKnowledgeBaseChoice>()
  const configurations = mcpConfigurations

  for (const selectedMode of modes) {
    const effectiveConfigurations = resolveEffectiveMCPConfigurations(
      [...mcpConfigurations],
      selectedMode
    )
    let scope: ResolvedModeKnowledgeBaseScope<MCPScopedConfiguration>
    try {
      scope = resolveModeKnowledgeBaseScope({
        customModeConfig,
        selectedMode,
        knowledgeBaseLinks,
        configurations,
        effectiveConfigurations,
      })
    } catch (error) {
      // One broken explicit assignment suppresses that mode only. It must not
      // widen another mode's graph scope or hide otherwise valid choices.
      if (error instanceof RequiredMCPUnavailableError) continue
      throw error
    }

    const link = scope.link
    if (
      !link ||
      scope.kbIds?.length !== 1 ||
      !scope.hasDocQueryAccess ||
      link.kb?.knowledgeGraphEnabled !== true ||
      typeof link.kb.name !== 'string'
    ) {
      continue
    }
    choices.set(link.kbId, { id: link.kbId, name: link.kb.name })
  }

  return [...choices.values()].sort(
    (left, right) =>
      left.name.localeCompare(right.name) || left.id.localeCompare(right.id)
  )
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
    kbIds?: readonly string[]
    sessionId?: string
  }
): boolean {
  const authType = server.authType.toLowerCase()

  if (server.name === DOC_QUERY_MCP_SERVER_NAME) {
    return Boolean(context.kbIds?.length) && Boolean(context.sessionId)
  }

  return authType !== 'scope_token'
}

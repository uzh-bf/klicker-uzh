'use server'

import { createHash, randomUUID } from 'node:crypto'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { safeDecrypt } from '@klicker-uzh/util'
import {
  MAX_TOOL_NAME_LENGTH,
  TOOL_NAME_SUFFIX_LENGTH,
} from '@/src/lib/config/toolNames'
import { signDocQueryScopeToken } from '@/src/lib/server/docQueryScopeToken'
import type { AuthMode } from '@/src/lib/server/ltiGuest'
import { mintParticipantMcpJwt } from '@/src/lib/server/mcpAuthMint'
import {
  isToolAllowed,
  parseMCPRuntimePolicy,
  RequiredMCPUnavailableError,
} from '@/src/lib/server/mcpRuntimePolicy'
import {
  sanitizeDocQueryResult,
  serializeDocQueryExecution,
} from './docQueryResult'
import {
  assertDocQueryRequestScope,
  assertDocQueryTransportSecurity,
  createDocQueryScopedFetch,
  DOC_QUERY_MCP_SERVER_NAME,
  DOC_QUERY_SCOPE_TOKEN_HEADER,
  type DocQueryScopedFetch,
  normalizeDocQueryKbIds,
  resolveDocQueryScopedRoute,
} from './mcpScope'

// Type definitions for MCP server configuration
export interface MCPServerConfig {
  id: string
  name: string
  url: string
  authType: string
  authSecret?: string
  parameters?: unknown
  isActive?: boolean
  passChatbotId?: boolean
  chatbotIdHeader?: string
}

export interface MCPConfigSettings {
  allowedTools?: string[]
  parameters?: unknown
  priority: number
}

export interface MCPServerWithConfig {
  server: MCPServerConfig
  config: MCPConfigSettings
}

export interface MCPRequestContext {
  chatbotId: string
  participantId?: string
  /** Manage user running an owner preview; never combined with participantId. */
  ownerPreviewUserId?: string
  courseId?: string
  authMode: AuthMode
  chatMode?: string
  kbIds?: readonly string[]
  kbLinkId?: string
  sessionId?: string
  knowledgeGraphRetrievalEnabled?: boolean
  /** Re-reads the selected live link before every scope-token mint. */
  revalidateKnowledgeBaseScope?: () => Promise<void>
}

export interface MCPRequestOptions {
  requestTimeoutMs?: number
  kbIds?: readonly string[]
  sessionId?: string
}

export interface MCPToolsHandle {
  tools: Record<string, any>
  close: () => Promise<void>
}

const MCP_AUTHORIZATION_STATUS_CODES = new Set([401, 403])

/**
 * The MCP SDK surfaces an HTTP credentials rejection as an `UnauthorizedError`,
 * a streamable-HTTP error carrying a numeric `code`, or a client error with
 * `statusCode`. Those are identity or tenant boundaries rather than transient
 * outages, so a required-tool caller must keep them fail-closed.
 */
function isMcpAuthorizationError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  if ((error as { name?: unknown }).name === 'UnauthorizedError') return true

  for (const key of ['statusCode', 'code'] as const) {
    const value = (error as Record<string, unknown>)[key]
    if (
      typeof value === 'number' &&
      MCP_AUTHORIZATION_STATUS_CODES.has(value)
    ) {
      return true
    }
  }

  return false
}

const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function toToolNameHash(rawName: string): string {
  return createHash('sha256')
    .update(rawName)
    .digest('hex')
    .slice(0, TOOL_NAME_SUFFIX_LENGTH)
}

function normalizeToolName(rawName: string): string {
  const normalized = rawName
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')

  return normalized.length > 0 ? normalized : 'tool'
}

function withHashSuffix(
  baseName: string,
  hash: string,
  preservedSuffix?: string
): string {
  const suffix = preservedSuffix ? `_${preservedSuffix}_${hash}` : `_${hash}`
  const maxBaseLength = MAX_TOOL_NAME_LENGTH - suffix.length
  const trimmedBase = baseName.slice(0, maxBaseLength).replace(/_+$/, '')
  return `${trimmedBase || 'tool'}${suffix}`
}

function toSafeToolName(
  serverName: string,
  toolName: string,
  usedNames: Set<string>
): string {
  const rawName = `${serverName}_${toolName}`
  const baseName = normalizeToolName(rawName)

  // Keep readable/stable names whenever no disambiguation is required.
  if (baseName.length <= MAX_TOOL_NAME_LENGTH && !usedNames.has(baseName)) {
    return baseName
  }

  const preservedSuffix = toolName === 'doc_query' ? 'doc_query' : undefined
  let candidate = withHashSuffix(
    baseName,
    toToolNameHash(rawName),
    preservedSuffix
  )
  if (!usedNames.has(candidate)) {
    return candidate
  }

  // Rare fallback: ensure uniqueness in deterministic order.
  let attempt = 1
  while (usedNames.has(candidate)) {
    candidate = withHashSuffix(
      baseName,
      toToolNameHash(`${rawName}:${attempt}`),
      preservedSuffix
    )
    attempt += 1
  }

  return candidate
}

function createBaseHeaders(): Record<string, string> {
  return Object.assign(Object.create(null), {
    'Content-Type': 'application/json',
  }) as Record<string, string>
}

function resolveDocQueryBearerAuth(
  server: MCPServerConfig,
  context: MCPRequestContext,
  authType: string
): { authorization: string; kbIds: string[]; sessionId: string } | undefined {
  if (server.name !== DOC_QUERY_MCP_SERVER_NAME) return undefined
  if (!context.kbIds || !context.sessionId) {
    throw new Error('Scoped knowledge retrieval is not available')
  }
  if (authType !== 'bearer' || !server.authSecret) {
    throw new Error('Doc Query transport authentication is invalid')
  }
  if (
    typeof context.sessionId !== 'string' ||
    context.sessionId.trim().length === 0
  ) {
    throw new Error('Scoped knowledge retrieval is not available')
  }

  assertDocQueryTransportSecurity(server.url)

  return {
    authorization: `Bearer ${safeDecrypt(server.authSecret)}`,
    kbIds: normalizeDocQueryKbIds(context.kbIds),
    sessionId: context.sessionId,
  }
}

async function signBearerRequestScope(
  context: MCPRequestContext,
  auth: NonNullable<ReturnType<typeof resolveDocQueryBearerAuth>>
) {
  await context.revalidateKnowledgeBaseScope?.()
  return signDocQueryScopeToken({
    kbIds: auth.kbIds,
    chatbotId: context.chatbotId,
    sessionId: auth.sessionId,
    jti: randomUUID(),
  })
}

interface MCPTransportRequest {
  url: string
  headers: Record<string, string>
  fetch?: DocQueryScopedFetch
}

/**
 * Legacy KB transport keeps its stored bearer, but mints scoped access anew
 * for every request after checking the live link.
 */
function createDocQueryBearerTransport(
  server: MCPServerConfig,
  context: MCPRequestContext
): MCPTransportRequest | undefined {
  const auth = resolveDocQueryBearerAuth(
    server,
    context,
    server.authType.toLowerCase()
  )
  if (!auth) return undefined
  const endpoint = new URL(server.url)

  return {
    url: server.url,
    headers: Object.assign(createBaseHeaders(), {
      Authorization: auth.authorization,
    }),
    fetch: async (input, init) => {
      const requestUrl = input instanceof Request ? input.url : input
      if (new URL(requestUrl, endpoint).href !== endpoint.href) {
        throw new Error('Knowledge base transport target mismatch')
      }
      const token = await signBearerRequestScope(context, auth)

      const headers = new Headers(
        input instanceof Request ? input.headers : undefined
      )
      new Headers(init?.headers).forEach((value, name) => {
        headers.set(name, value)
      })
      headers.set('Authorization', auth.authorization)
      headers.set(DOC_QUERY_SCOPE_TOKEN_HEADER, `Bearer ${token}`)

      return fetch(input, {
        ...init,
        headers,
        redirect: 'error',
      })
    },
  }
}

/**
 * Binds the modern KB server to the deployment-controlled scoped route. The
 * stored bearer and its auth type are ignored in this mode: destination and
 * credential both come from configuration, so a database URL edit or an
 * expired stored credential can neither redirect nor weaken the request.
 * Absent configuration keeps the legacy transport bearer; a partial or
 * inconsistent configuration throws before any credential is handed out.
 */
function createScopedDocQueryTransport(
  server: MCPServerConfig,
  context: MCPRequestContext
): MCPTransportRequest | undefined {
  if (server.name !== DOC_QUERY_MCP_SERVER_NAME) return undefined

  const target = resolveDocQueryScopedRoute(server)
  if (!target) return undefined

  if (
    !context.kbIds ||
    !context.sessionId ||
    typeof context.sessionId !== 'string' ||
    context.sessionId.trim().length === 0
  ) {
    throw new Error('Scoped knowledge retrieval is not available')
  }

  const kbIds = normalizeDocQueryKbIds(context.kbIds)

  return {
    url: target.href,
    headers: createBaseHeaders(),
    fetch: createDocQueryScopedFetch({
      target,
      kbIds,
      chatbotId: context.chatbotId,
      sessionId: context.sessionId,
      signToken: signDocQueryScopeToken,
      revalidateScope: context.revalidateKnowledgeBaseScope,
    }),
  }
}

/**
 * Creates authentication headers based on server auth type
 */
export async function createAuthHeaders(
  server: MCPServerConfig,
  context: MCPRequestContext
): Promise<Record<string, string>> {
  const baseHeaders = createBaseHeaders()
  const authType = server.authType.toLowerCase()

  const bearer = resolveDocQueryBearerAuth(server, context, authType)
  if (bearer) {
    baseHeaders.Authorization = bearer.authorization
    baseHeaders[DOC_QUERY_SCOPE_TOKEN_HEADER] =
      `Bearer ${await signBearerRequestScope(context, bearer)}`
    return baseHeaders
  }

  // Add chatbot ID if configured (new behavior - defaults to false for backward compatibility)
  if (server.passChatbotId) {
    const raw = server.chatbotIdHeader || 'Chatbot-ID'
    const headerName = raw.replace(/[^A-Za-z0-9-]/g, '') || 'Chatbot-ID'
    baseHeaders[headerName] = context.chatbotId
  }

  // Per-participant JWT mint for the Klicker MCP server. Identity
  // comes from the caller's verified participant cookie, not a static
  // shared secret, so the MCP server can apply row-level auth.
  if (authType === 'klicker-participant-jwt') {
    if (!context.participantId) {
      throw new Error(
        'Participant identity is required for participant MCP auth'
      )
    }
    const token = await mintParticipantMcpJwt(
      context.participantId,
      context.authMode
    )
    baseHeaders.Authorization = `Bearer ${token}`
    return baseHeaders
  }

  if (authType === 'scope_token') {
    throw new Error('Scoped knowledge retrieval is not available')
  }

  if (!server.authSecret) {
    return baseHeaders
  }

  const decryptedSecret = safeDecrypt(server.authSecret)

  switch (authType) {
    case 'custom':
      // Parse and apply custom headers from JSON
      {
        const parsed: unknown = JSON.parse(decryptedSecret)
        if (
          !parsed ||
          typeof parsed !== 'object' ||
          Array.isArray(parsed) ||
          !('headers' in parsed) ||
          !parsed.headers ||
          typeof parsed.headers !== 'object' ||
          Array.isArray(parsed.headers)
        ) {
          throw new Error('Invalid custom MCP headers')
        }

        for (const [name, value] of Object.entries(parsed.headers)) {
          if (
            !HTTP_HEADER_NAME_PATTERN.test(name) ||
            name === '__proto__' ||
            name === 'constructor' ||
            name === 'prototype' ||
            typeof value !== 'string' ||
            /[\r\n]/.test(value)
          ) {
            throw new Error('Invalid custom MCP header value')
          }
          baseHeaders[name] = value
        }
      }
      break
    case 'bearer':
      baseHeaders.Authorization = `Bearer ${decryptedSecret}`
      break
    case 'basic': {
      // Assume authSecret is in format "username:password"
      const encoded = Buffer.from(decryptedSecret).toString('base64')
      baseHeaders.Authorization = `Basic ${encoded}`
      break
    }
    default:
      // No additional auth headers
      break
  }

  return baseHeaders
}

function normalizeMCPRequest(
  contextOrChatbotId: MCPRequestContext | string,
  participantIdOrOptions: string | MCPRequestOptions = '',
  authMode: AuthMode = 'account'
): { context: MCPRequestContext; options: MCPRequestOptions } {
  if (typeof contextOrChatbotId !== 'string') {
    return {
      context: contextOrChatbotId,
      options:
        typeof participantIdOrOptions === 'string'
          ? {}
          : participantIdOrOptions,
    }
  }

  const options =
    typeof participantIdOrOptions === 'string' ? {} : participantIdOrOptions

  return {
    context: {
      chatbotId: contextOrChatbotId,
      participantId:
        typeof participantIdOrOptions === 'string'
          ? participantIdOrOptions
          : undefined,
      authMode,
      kbIds: options.kbIds,
      sessionId: options.sessionId,
    },
    options,
  }
}

/**
 * Creates and initializes a single MCP client for a specific server configuration
 */
export async function createMCPClient(
  server: MCPServerConfig,
  contextOrChatbotId: MCPRequestContext | string,
  participantIdOrOptions: string | MCPRequestOptions = '',
  authMode: AuthMode = 'account'
) {
  if (!server.url) {
    throw new Error(`MCP server ${server.name} has no URL defined`)
  }

  const { context, options } = normalizeMCPRequest(
    contextOrChatbotId,
    participantIdOrOptions,
    authMode
  )

  try {
    const docQueryTransport =
      createScopedDocQueryTransport(server, context) ??
      createDocQueryBearerTransport(server, context)
    const headers = docQueryTransport
      ? docQueryTransport.headers
      : await createAuthHeaders(server, context)

    const client = await createSDKMCPClient({
      transport: {
        type: 'http',
        url: docQueryTransport ? docQueryTransport.url : server.url,
        headers,
        redirect: 'error',
        ...(docQueryTransport?.fetch ? { fetch: docQueryTransport.fetch } : {}),
      },
      ...(options.requestTimeoutMs !== undefined
        ? { initializationOptions: { timeout: options.requestTimeoutMs } }
        : {}),
    })

    console.log(`MCP Client for ${server.name} initialized successfully`)
    return client
  } catch (error) {
    console.error('Failed to create MCP client', {
      server: server.name,
      errorType: error instanceof Error ? error.name : typeof error,
    })
    throw error
  }
}

/**
 * Loads tools from a single MCP server and applies filtering
 */
async function loadServerTools(
  serverWithConfig: MCPServerWithConfig,
  context: MCPRequestContext,
  options: MCPRequestOptions
): Promise<MCPToolsHandle> {
  const { server, config } = serverWithConfig
  const runtimePolicy = parseMCPRuntimePolicy(config.parameters)
  let requiredRawToolName: string | undefined
  let client: Awaited<ReturnType<typeof createMCPClient>> | undefined

  const close = async () => {
    const activeClient = client
    client = undefined
    if (!activeClient) return

    try {
      await activeClient.close()
    } catch (error) {
      console.warn('Failed to close MCP client', {
        server: server.name,
        errorType: error instanceof Error ? error.name : typeof error,
      })
    }
  }

  if (runtimePolicy.required) {
    const configuredTool = config.allowedTools?.[0]
    if (
      !Array.isArray(config.allowedTools) ||
      config.allowedTools.length !== 1 ||
      typeof configuredTool !== 'string' ||
      configuredTool.length === 0 ||
      /[*?]/.test(configuredTool)
    ) {
      throw new RequiredMCPUnavailableError()
    }
    requiredRawToolName = configuredTool
  }

  if (server.isActive === false) {
    if (runtimePolicy.required) {
      throw new RequiredMCPUnavailableError()
    }
    return { tools: {}, close }
  }

  try {
    if (server.name === DOC_QUERY_MCP_SERVER_NAME) {
      assertDocQueryRequestScope(config.parameters, context.kbIds)
    }
    client = await createMCPClient(server, context, options)
    const rawTools = await client.tools()
    // Serialize the raw client calls, including graph-expanded searches. An
    // augmentation timeout must not release an unfinished provider operation.
    for (const [name, tool] of Object.entries(rawTools)) {
      if (
        (name === 'doc_query' ||
          (name === requiredRawToolName &&
            runtimePolicy.required &&
            runtimePolicy.toolAlias === 'doc_query')) &&
        typeof tool.execute === 'function'
      ) {
        const execute = tool.execute.bind(tool)
        rawTools[name] = {
          ...tool,
          execute: serializeDocQueryExecution(execute) as typeof execute,
        }
      }
    }
    if (
      server.name === DOC_QUERY_MCP_SERVER_NAME &&
      context.knowledgeGraphRetrievalEnabled === true
    ) {
      const rawName = requiredRawToolName ?? 'doc_query'
      const tool = rawTools[rawName]
      if (tool && typeof tool.execute === 'function') {
        const [{ graphAssistedDocumentQuery }, { graphQueryDependencies }] =
          await Promise.all([
            import('./graphAssistedDocQuery'),
            import('./graphQueryScope'),
          ])
        const execute = tool.execute.bind(tool)
        const dependencies = graphQueryDependencies(context)
        dependencies.observe = (diagnostic) => {
          console.info('[chat.graph_retrieval]', diagnostic)
        }
        rawTools[rawName] = {
          ...tool,
          // MCP callTool resolves one response. The SDK's generic tool type
          // also permits streaming implementations, which this client does not use.
          execute: graphAssistedDocumentQuery(
            execute,
            dependencies
          ) as typeof execute,
        }
      }
    }

    if (runtimePolicy.required && requiredRawToolName) {
      const rawToolName = requiredRawToolName
      if (
        !Object.hasOwn(rawTools, rawToolName) ||
        (rawToolName !== runtimePolicy.toolAlias &&
          Object.hasOwn(rawTools, runtimePolicy.toolAlias))
      ) {
        throw new RequiredMCPUnavailableError()
      }
    }

    // Apply tool filtering
    const filteredTools: Record<string, any> = {}
    const usedNames = new Set<string>()

    Object.entries(rawTools).forEach(([toolName, toolDefinition]) => {
      const allowed = runtimePolicy.required
        ? toolName === requiredRawToolName
        : isToolAllowed(toolName, config.allowedTools || [])

      if (allowed) {
        const modelToolName = runtimePolicy.required
          ? runtimePolicy.toolAlias
          : toolName
        // Keep tool names in OpenAI-compatible format and make them deterministic.
        const namespacedName = toSafeToolName(
          server.name,
          modelToolName,
          usedNames
        )
        filteredTools[namespacedName] =
          (toolName === 'doc_query' || modelToolName === 'doc_query') &&
          typeof toolDefinition.execute === 'function'
            ? {
                ...toolDefinition,
                execute: async (
                  ...args: Parameters<
                    NonNullable<typeof toolDefinition.execute>
                  >
                ) =>
                  sanitizeDocQueryResult(await toolDefinition.execute(...args)),
              }
            : toolDefinition
        usedNames.add(namespacedName)
      }
    })

    console.log(
      `Loaded ${Object.keys(filteredTools).length} tools from ${server.name}`
    )
    return { tools: filteredTools, close }
  } catch (error) {
    await close()
    if (error instanceof RequiredMCPUnavailableError) {
      console.error('Required MCP tools unavailable', { server: server.name })
      // Preserve a scope violation raised while resolving the request so the
      // caller cannot degrade an isolation failure into an answer.
      throw error
    }
    if (runtimePolicy.required) {
      console.error('Required MCP tools unavailable', { server: server.name })
      // A credentials rejection from the endpoint is an identity or tenant
      // boundary, so it stays fail-closed like a scope violation; only a
      // genuine outage may fall through to a degraded answer.
      throw new RequiredMCPUnavailableError(
        isMcpAuthorizationError(error) ? 'scope_violation' : 'unavailable'
      )
    }

    console.error('Optional MCP tools unavailable', { server: server.name })
    // Return empty object to allow other servers to continue loading
    return { tools: {}, close }
  }
}

/**
 * Aggregates tools from multiple MCP servers with priority-based loading
 */
export async function getAggregatedMCPTools(
  serversWithConfigs: MCPServerWithConfig[],
  contextOrChatbotId: MCPRequestContext | string,
  participantIdOrOptions: string | MCPRequestOptions = '',
  authMode: AuthMode = 'account'
): Promise<MCPToolsHandle> {
  console.log(`Loading MCP Tools from ${serversWithConfigs.length} servers...`)

  const { context, options } = normalizeMCPRequest(
    contextOrChatbotId,
    participantIdOrOptions,
    authMode
  )

  if (serversWithConfigs.length === 0) {
    console.log('No MCP servers configured')
    return { tools: {}, close: async () => {} }
  }

  // Sort by priority (lower number = higher priority)
  const sortedServers = [...serversWithConfigs].sort(
    (a, b) => a.config.priority - b.config.priority
  )

  const aggregatedTools: Record<string, any> = {}
  const requiredToolNames = new Set<string>()
  const serverHandles: MCPToolsHandle[] = []

  let closePromise: Promise<void> | undefined
  const close = () => {
    closePromise ??= Promise.all(
      serverHandles.map((handle) => handle.close())
    ).then(() => undefined)
    return closePromise
  }

  // Load tools from each server in priority order
  for (const serverWithConfig of sortedServers) {
    try {
      const serverHandle = await loadServerTools(
        serverWithConfig,
        context,
        options
      )
      serverHandles.push(serverHandle)
      const runtimePolicy = parseMCPRuntimePolicy(
        serverWithConfig.config.parameters
      )
      for (const [name, def] of Object.entries(serverHandle.tools)) {
        if (!(name in aggregatedTools)) {
          aggregatedTools[name] = def
          if (runtimePolicy.required) requiredToolNames.add(name)
        } else if (runtimePolicy.required || requiredToolNames.has(name)) {
          throw new RequiredMCPUnavailableError()
        }
      }
    } catch (error) {
      if (error instanceof RequiredMCPUnavailableError) {
        await close()
        throw error
      }

      console.error(
        `Failed to load tools from ${serverWithConfig.server.name}, continuing with other servers`
      )
    }
  }

  console.log(`Total aggregated tools: ${Object.keys(aggregatedTools).length}`)
  console.log('Available tools:', Object.keys(aggregatedTools))

  return { tools: aggregatedTools, close }
}

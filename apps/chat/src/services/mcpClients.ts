'use server'

import { createHash, randomUUID } from 'node:crypto'
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
import { safeDecrypt } from '@klicker-uzh/util'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  MAX_TOOL_NAME_LENGTH,
  TOOL_NAME_SUFFIX_LENGTH,
} from '@/src/lib/config/toolNames'
import { signDocQueryScopeToken } from '@/src/lib/server/docQueryScopeToken'
import type { AuthMode } from '@/src/lib/server/ltiGuest'
import { mintParticipantMcpJwt } from '@/src/lib/server/mcpAuthMint'
import {
  parseMCPRuntimePolicy,
  RequiredMCPUnavailableError,
} from '@/src/lib/server/mcpRuntimePolicy'
import {
  DOC_QUERY_MCP_SERVER_NAME,
  DOC_QUERY_SCOPE_TOKEN_HEADER,
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
  authMode: AuthMode
  kbId?: string
  sessionId?: string
}

export interface MCPRequestOptions {
  requestTimeoutMs?: number
}

const HTTP_HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/

function resolveDocQueryScopeHeader(server: MCPServerConfig): string {
  const parameters =
    server.parameters &&
    typeof server.parameters === 'object' &&
    !Array.isArray(server.parameters)
      ? (server.parameters as Record<string, unknown>)
      : undefined
  const rawScopeToken = parameters?.scope_token
  if (
    rawScopeToken !== undefined &&
    (!rawScopeToken ||
      typeof rawScopeToken !== 'object' ||
      Array.isArray(rawScopeToken))
  ) {
    throw new Error('Invalid Doc Query scope-token configuration')
  }
  const scopeToken = rawScopeToken as Record<string, unknown> | undefined
  const header = scopeToken?.header ?? DOC_QUERY_SCOPE_TOKEN_HEADER

  if (
    typeof header !== 'string' ||
    HTTP_HEADER_NAME_PATTERN.test(header) === false ||
    header.toLowerCase() === 'authorization'
  ) {
    throw new Error('Invalid Doc Query scope-token header')
  }

  return header
}

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

/**
 * Creates authentication headers based on server auth type
 */
export async function createAuthHeaders(
  server: MCPServerConfig,
  context: MCPRequestContext
): Promise<Record<string, string>> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const authType = server.authType.toLowerCase()

  if (server.name === DOC_QUERY_MCP_SERVER_NAME) {
    if (!context.kbId || !context.sessionId) {
      throw new Error('Scoped knowledge retrieval is not available')
    }

    // Shared multi-tenant Doc Query keeps transport authentication in
    // Authorization and carries retrieval scope in its dedicated header.
    // Scope-only rows remain valid only for explicitly standalone deployments.
    if (server.authSecret) {
      if (authType !== 'bearer' && authType !== 'scope_token') {
        throw new Error('Doc Query transport authentication is invalid')
      }
      baseHeaders.Authorization = `Bearer ${safeDecrypt(server.authSecret)}`
    }

    const token = await signDocQueryScopeToken({
      kbId: context.kbId,
      chatbotId: context.chatbotId,
      sessionId: context.sessionId,
      jti: randomUUID(),
    })
    baseHeaders[resolveDocQueryScopeHeader(server)] = `Bearer ${token}`
    return baseHeaders
  }

  if (authType === 'scope_token') {
    throw new Error('Scoped knowledge retrieval is not available')
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

  return {
    context: {
      chatbotId: contextOrChatbotId,
      participantId:
        typeof participantIdOrOptions === 'string'
          ? participantIdOrOptions
          : undefined,
      authMode,
    },
    options:
      typeof participantIdOrOptions === 'string' ? {} : participantIdOrOptions,
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
    const headers = await createAuthHeaders(server, context)

    const httpTransport = new StreamableHTTPClientTransport(
      new URL(server.url),
      {
        requestInit: {
          headers,
          redirect: 'error',
          ...(options.requestTimeoutMs !== undefined
            ? { signal: AbortSignal.timeout(options.requestTimeoutMs) }
            : {}),
        },
      }
    )

    const client = await createSDKMCPClient({
      transport: httpTransport,
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
 * Checks if a tool name matches any of the allowed patterns
 * Supports wildcard patterns like "search*", "*plot*", "execute_*"
 */
function isToolAllowed(toolName: string, allowedTools: string[]): boolean {
  if (!allowedTools || allowedTools.length === 0) {
    return true // If no filters specified, allow all tools
  }

  return allowedTools.some((pattern) => {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/\*/g, '.*') // Replace * with .*
      .replace(/\?/g, '.') // Replace ? with .

    const regex = new RegExp(`^${regexPattern}$`, 'i')
    return regex.test(toolName)
  })
}

/**
 * Loads tools from a single MCP server and applies filtering
 */
async function loadServerTools(
  serverWithConfig: MCPServerWithConfig,
  context: MCPRequestContext,
  options: MCPRequestOptions
): Promise<Record<string, any>> {
  const { server, config } = serverWithConfig
  const runtimePolicy = parseMCPRuntimePolicy(config.parameters)
  let requiredRawToolName: string | undefined

  if (runtimePolicy.required) {
    const configuredTool = config.allowedTools?.[0]
    if (
      !Array.isArray(config.allowedTools) ||
      config.allowedTools?.length !== 1 ||
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
    return {}
  }

  try {
    const client = await createMCPClient(server, context, options)
    const rawTools = await client.tools()

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
        filteredTools[namespacedName] = toolDefinition
        usedNames.add(namespacedName)
      }
    })

    console.log(
      `Loaded ${Object.keys(filteredTools).length} tools from ${server.name}`
    )
    return filteredTools
  } catch (error) {
    if (
      error instanceof RequiredMCPUnavailableError ||
      runtimePolicy.required
    ) {
      console.error('Required MCP tools unavailable', { server: server.name })
      throw new RequiredMCPUnavailableError()
    }

    console.error('Optional MCP tools unavailable', { server: server.name })
    // Return empty object to allow other servers to continue loading
    return {}
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
): Promise<Record<string, any>> {
  console.log(`Loading MCP Tools from ${serversWithConfigs.length} servers...`)

  const { context, options } = normalizeMCPRequest(
    contextOrChatbotId,
    participantIdOrOptions,
    authMode
  )

  if (serversWithConfigs.length === 0) {
    console.log('No MCP servers configured')
    return {}
  }

  // Sort by priority (lower number = higher priority)
  const sortedServers = [...serversWithConfigs].sort(
    (a, b) => a.config.priority - b.config.priority
  )

  const aggregatedTools: Record<string, any> = {}
  const requiredToolNames = new Set<string>()

  // Load tools from each server in priority order
  for (const serverWithConfig of sortedServers) {
    try {
      const serverTools = await loadServerTools(
        serverWithConfig,
        context,
        options
      )
      const runtimePolicy = parseMCPRuntimePolicy(
        serverWithConfig.config.parameters
      )
      for (const [name, def] of Object.entries(serverTools)) {
        if (!(name in aggregatedTools)) {
          aggregatedTools[name] = def
          if (runtimePolicy.required) requiredToolNames.add(name)
        } else if (runtimePolicy.required || requiredToolNames.has(name)) {
          throw new RequiredMCPUnavailableError()
        }
      }
    } catch (error) {
      if (error instanceof RequiredMCPUnavailableError) throw error

      console.error(
        `Failed to load tools from ${serverWithConfig.server.name}, continuing with other servers`
      )
    }
  }

  console.log(`Total aggregated tools: ${Object.keys(aggregatedTools).length}`)
  console.log('Available tools:', Object.keys(aggregatedTools))

  return aggregatedTools
}

/**
 * Legacy function for backward compatibility with environment variables
 * @deprecated Use getAggregatedMCPTools with database configuration instead
 */
export async function getMCPTools(
  chatbotId: string,
  participantId: string,
  authMode: AuthMode
) {
  console.log(' Using legacy MCP configuration from environment variables')

  const mcpKey = process.env.MCP_KEY
  const mcpUrl = process.env.MCP_URL

  if (!mcpUrl) {
    console.log('No MCP_URL environment variable found, returning empty tools')
    return {}
  }

  // Create a legacy server configuration
  const legacyServer: MCPServerConfig = {
    id: 'legacy-env-server',
    name: 'Legacy_MCP',
    url: mcpUrl,
    authType: mcpKey ? 'bearer' : 'none',
    authSecret: mcpKey,
  }

  const legacyConfig: MCPConfigSettings = {
    allowedTools: undefined, // No filtering for legacy mode
    priority: 0,
  }

  try {
    const serverTools = await loadServerTools(
      { server: legacyServer, config: legacyConfig },
      { chatbotId, participantId, authMode },
      {}
    )
    return serverTools
  } catch (error) {
    console.error('Failed to load legacy MCP Tools:', error)
    return {}
  }
}

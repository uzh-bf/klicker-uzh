'use server'

import { safeDecrypt } from '@klicker-uzh/util'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { experimental_createMCPClient } from 'ai'

// Type definitions for MCP server configuration
export interface MCPServerConfig {
  id: string
  name: string
  url: string
  authType: string
  authSecret?: string
  parameters?: any
  passChatbotId?: boolean
  chatbotIdHeader?: string
}

export interface MCPConfigSettings {
  allowedTools?: string[]
  parameters?: any
  priority: number
}

export interface MCPServerWithConfig {
  server: MCPServerConfig
  config: MCPConfigSettings
}

/**
 * Creates authentication headers based on server auth type
 */
function createAuthHeaders(
  server: MCPServerConfig,
  chatbotId: string
): Record<string, string> {
  const baseHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  // Add chatbot ID if configured (new behavior - defaults to false for backward compatibility)
  if (server.passChatbotId) {
    const headerName = server.chatbotIdHeader || 'Chatbot-ID'
    baseHeaders[headerName] = chatbotId
  }

  if (!server.authSecret) {
    return baseHeaders
  }

  const decryptedSecret = safeDecrypt(server.authSecret)

  switch (server.authType.toLowerCase()) {
    case 'custom':
      // Parse and apply custom headers from JSON
      try {
        const { headers } = JSON.parse(decryptedSecret)
        Object.assign(baseHeaders, headers)
      } catch (error) {
        console.error(
          `Failed to parse custom headers for ${server.name}:`,
          error
        )
      }
      break
    case 'bearer':
      baseHeaders.Authorization = `Bearer ${decryptedSecret}`
      break
    case 'basic':
      // Assume authSecret is in format "username:password"
      const encoded = Buffer.from(decryptedSecret).toString('base64')
      baseHeaders.Authorization = `Basic ${encoded}`
      break
    case 'none':
    default:
      // No additional auth headers
      break
  }

  return baseHeaders
}

/**
 * Creates and initializes a single MCP client for a specific server configuration
 */
export async function createMCPClient(
  server: MCPServerConfig,
  chatbotId: string
) {
  if (!server.url) {
    throw new Error(`MCP server ${server.name} has no URL defined`)
  }

  try {
    const headers = createAuthHeaders(server, chatbotId)

    const httpTransport = new StreamableHTTPClientTransport(
      new URL(server.url),
      {
        requestInit: { headers },
      }
    )

    const client = await experimental_createMCPClient({
      transport: httpTransport,
    })

    console.log(`✅ MCP Client for ${server.name} initialized successfully`)
    return client
  } catch (error) {
    console.error(`❌ Failed to create MCP client for ${server.name}:`, error)
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
  chatbotId: string
): Promise<Record<string, any>> {
  const { server, config } = serverWithConfig

  try {
    const client = await createMCPClient(server, chatbotId)
    const rawTools = await client.tools()

    // Apply tool filtering
    const filteredTools: Record<string, any> = {}

    Object.entries(rawTools).forEach(([toolName, toolDefinition]) => {
      if (isToolAllowed(toolName, config.allowedTools || [])) {
        // Add namespace prefix to prevent conflicts
        const namespacedName = `${server.name}.${toolName}`
        filteredTools[namespacedName] = toolDefinition
      }
    })

    console.log(
      `✅ Loaded ${Object.keys(filteredTools).length} tools from ${server.name}`
    )
    return filteredTools
  } catch (error) {
    console.error(`❌ Failed to load tools from ${server.name}:`, error)
    // Return empty object to allow other servers to continue loading
    return {}
  }
}

/**
 * Aggregates tools from multiple MCP servers with priority-based loading
 */
export async function getAggregatedMCPTools(
  serversWithConfigs: MCPServerWithConfig[],
  chatbotId: string
): Promise<Record<string, any>> {
  console.log(`Loading MCP Tools from ${serversWithConfigs.length} servers...`)

  if (serversWithConfigs.length === 0) {
    console.log('No MCP servers configured')
    return {}
  }

  // Sort by priority (lower number = higher priority)
  const sortedServers = [...serversWithConfigs].sort(
    (a, b) => a.config.priority - b.config.priority
  )

  const aggregatedTools: Record<string, any> = {}

  // Load tools from each server in priority order
  for (const serverWithConfig of sortedServers) {
    try {
      const serverTools = await loadServerTools(serverWithConfig, chatbotId)
      Object.assign(aggregatedTools, serverTools)
    } catch (error) {
      console.error(
        `Failed to load tools from ${serverWithConfig.server.name}, continuing with other servers`
      )
    }
  }

  console.log(
    `✅ Total aggregated tools: ${Object.keys(aggregatedTools).length}`
  )
  console.log('Available tools:', Object.keys(aggregatedTools))

  return aggregatedTools
}

/**
 * Legacy function for backward compatibility with environment variables
 * @deprecated Use getAggregatedMCPTools with database configuration instead
 */
export async function getMCPTools(chatbotId: string) {
  console.log('⚠️  Using legacy MCP configuration from environment variables')

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
      chatbotId
    )
    return serverTools
  } catch (error) {
    console.error('Failed to load legacy MCP Tools:', error)
    return {}
  }
}

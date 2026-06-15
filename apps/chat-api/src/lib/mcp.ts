// MCP tool loading for the Hono service: turn a chatbot's DB-driven MCP
// configuration rows into a single merged Mastra toolset, reproducing the
// route's getAggregatedMCPTools behaviour over the engine's buildMcpToolset.
//
// Divergence from the legacy route (accepted, verified in Phase 4): the engine
// uses @mastra/mcp's MCPClient (namespacing `${server}_${tool}`) instead of the
// route's @ai-sdk/mcp + toSafeToolName. For typical server/tool names the
// rendered names match; the route's regex wildcard allowedTools and sha256
// name-collision suffixing are NOT reproduced here. The auth-header builder,
// passChatbotId injection, empty-allowlist=allow-all, and priority de-dup ARE
// reproduced (the first three inside the engine, the merge here).
//
// The host owns secret decryption: authSecret is decrypted before it reaches the
// engine (the engine's McpServerConfig.secret is the already-decrypted payload).
import { buildMcpToolset, type McpServerConfig } from '@klicker-uzh/chat-engine'
import { safeDecrypt } from '@klicker-uzh/util'

// Tools are kept as an opaque Record here: the engine's ToolsInput is a deep
// recursive type that trips tsc's instantiation-depth limit under this service's
// stricter compiler flags. We treat the toolset as opaque and cast it back to
// the engine's expected type only at the buildAgent boundary (see index.ts).

// Structural view of a ChatbotMCPConfiguration row joined with its server, as
// fetched in the handler (chatMode + isEnabled, ordered by priority asc).
export type McpConfigurationRow = {
  allowedTools: unknown
  priority: number
  mcpServer: {
    name: string
    url: string
    authType: string
    authSecret: string | null
    passChatbotId: boolean
    chatbotIdHeader: string | null
    isActive: boolean
  }
}

export type LoadedMcpTools = {
  tools: Record<string, unknown>
  toolNames: string[]
  disconnectAll: () => Promise<void>
}

const VALID_AUTH_TYPES = new Set(['none', 'bearer', 'basic', 'custom'])

function toEngineAuthType(raw: string): McpServerConfig['authType'] {
  const normalized = raw.toLowerCase()
  return VALID_AUTH_TYPES.has(normalized)
    ? (normalized as McpServerConfig['authType'])
    : 'none'
}

function toAllowedTools(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : []
}

// Build and merge toolsets for every active, enabled MCP server, in priority
// order (lower number first), first-write-wins on name collisions — matching
// getAggregatedMCPTools. A single server failing to connect is logged and
// skipped so the rest still load (route parity). Returns the merged tools plus a
// disconnect handle that releases every per-server client once the stream ends.
export async function loadMcpTools(
  configurations: McpConfigurationRow[],
  chatbotId: string
): Promise<LoadedMcpTools> {
  const active = configurations
    .filter((config) => config.mcpServer?.isActive === true)
    .sort((a, b) => a.priority - b.priority)

  const tools: Record<string, unknown> = {}
  const disconnects: Array<() => Promise<void>> = []

  for (const config of active) {
    const server = config.mcpServer
    const cfg: McpServerConfig = {
      name: server.name,
      url: server.url,
      authType: toEngineAuthType(server.authType),
      secret: server.authSecret ? safeDecrypt(server.authSecret) : null,
      passChatbotId: server.passChatbotId,
      chatbotIdHeader: server.chatbotIdHeader,
    }

    try {
      const toolset = await buildMcpToolset(
        cfg,
        chatbotId,
        toAllowedTools(config.allowedTools)
      )
      disconnects.push(toolset.disconnect)
      const serverTools = toolset.tools as unknown as Record<string, unknown>
      for (const [name, tool] of Object.entries(serverTools)) {
        if (!(name in tools)) {
          tools[name] = tool
        }
      }
    } catch (error) {
      console.error(`Failed to load MCP tools from ${server.name}:`, error)
    }
  }

  return {
    tools,
    toolNames: Object.keys(tools),
    disconnectAll: async () => {
      await Promise.allSettled(disconnects.map((disconnect) => disconnect()))
    },
  }
}

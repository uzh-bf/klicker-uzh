// MCP toolset builder.
// Maps a DB-driven per-server MCP config (ChatbotMCPServer columns) onto Mastra's
// MCPClient, with the same auth-header + Chatbot-ID + per-mode allowedTools
// behaviour apps/chat implements today (services/mcpClients.ts: createAuthHeaders
// + toSafeToolName + getAggregatedMCPTools).
//
// This module is config-driven and DB-free: the host service (apps/chat-api)
// loads ChatbotMCPServer rows via Prisma (decrypting secrets) and passes the
// resolved McpServerConfig in. The engine owns no database access.
import type { ToolsInput } from '@mastra/core/agent'
import { MCPClient } from '@mastra/mcp'

// 1:1 with the columns read off ChatbotMCPServer.
export type McpServerConfig = {
  name: string
  url: string
  authType: 'none' | 'bearer' | 'basic' | 'custom'
  secret: string | null // decrypted bearer/basic/custom payload by the host
  passChatbotId: boolean
  chatbotIdHeader: string | null
}

// Mirror of apps/chat createAuthHeaders() + the passChatbotId injection.
export function buildAuthHeaders(
  cfg: McpServerConfig,
  chatbotId: string
): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cfg.authType === 'bearer' && cfg.secret) {
    headers['Authorization'] = `Bearer ${cfg.secret}`
  } else if (cfg.authType === 'basic' && cfg.secret) {
    headers['Authorization'] =
      `Basic ${Buffer.from(cfg.secret).toString('base64')}`
  } else if (cfg.authType === 'custom' && cfg.secret) {
    Object.assign(
      headers,
      (JSON.parse(cfg.secret).headers as Record<string, string>) ?? {}
    )
  }
  if (cfg.passChatbotId) {
    headers[cfg.chatbotIdHeader || 'Chatbot-ID'] = chatbotId
  }
  return headers
}

// allowedTools entries are un-namespaced tool names with optional `*` wildcard
// (mirrors getAggregatedMCPTools). listTools() returns `${server}_${tool}`. An
// empty/absent allow-list means "allow all" — matching apps/chat's isToolAllowed
// (mcpClients.ts); without this guard `[].some(...)` would silently block every
// tool whenever a ChatbotMCPConfiguration row has a null/empty allowedTools.
function isAllowed(
  toolName: string,
  serverName: string,
  allowed: string[]
): boolean {
  if (allowed.length === 0) return true
  const prefix = `${serverName}_`
  const bare = toolName.startsWith(prefix)
    ? toolName.slice(prefix.length)
    : toolName
  return allowed.some((pat) =>
    pat === '*'
      ? true
      : pat.endsWith('*')
        ? bare.startsWith(pat.slice(0, -1))
        : bare === pat
  )
}

export type McpToolset = {
  tools: ToolsInput
  toolNames: string[]
  disconnect: () => Promise<void>
}

// Build a Mastra MCPClient from one server config and return the filtered,
// namespaced toolset plus a disconnect handle (call after the stream ends).
export async function buildMcpToolset(
  cfg: McpServerConfig,
  chatbotId: string,
  allowedTools: string[]
): Promise<McpToolset> {
  const client = new MCPClient({
    id: `mcp-${cfg.name}-${chatbotId}`,
    servers: {
      [cfg.name]: {
        url: new URL(cfg.url),
        requestInit: { headers: buildAuthHeaders(cfg, chatbotId) },
      },
    },
  })
  const all = await client.listTools()
  const tools: ToolsInput = {}
  for (const [name, tool] of Object.entries(all)) {
    if (isAllowed(name, cfg.name, allowedTools)) tools[name] = tool
  }
  return {
    tools,
    toolNames: Object.keys(tools),
    disconnect: () => client.disconnect(),
  }
}

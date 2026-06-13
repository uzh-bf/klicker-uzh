// S1 — MCP rebind seam.
// Proves our DB-driven per-server MCP config (ChatbotMCPServer columns) maps
// cleanly onto Mastra's MCPClient, with the same auth-header + Chatbot-ID +
// per-mode allowedTools behaviour the chat app implements today
// (apps/chat/src/services/mcpClients.ts: createAuthHeaders + toSafeToolName +
// getAggregatedMCPTools).
//
// The real KB backend is down in dev, so the prototype connects to the local
// stub (env.PROTO_MCP_URL) while still sourcing auth/header policy from the DB
// row — the rebind logic is identical regardless of which URL it points at.
import { MCPClient } from '@mastra/mcp'
import type { ToolsInput } from '@mastra/core/agent'
import { pool } from '../db.js'

// 1:1 with the columns we read off ChatbotMCPServer.
export type McpServerConfig = {
  name: string
  url: string
  authType: 'none' | 'bearer' | 'basic' | 'custom'
  secret: string | null // decrypted bearer/basic/custom payload (none in dev KB)
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
    headers['Authorization'] = `Basic ${Buffer.from(cfg.secret).toString('base64')}`
  } else if (cfg.authType === 'custom' && cfg.secret) {
    Object.assign(headers, (JSON.parse(cfg.secret).headers as Record<string, string>) ?? {})
  }
  if (cfg.passChatbotId) {
    headers[cfg.chatbotIdHeader || 'Chatbot-ID'] = chatbotId
  }
  return headers
}

// allowedTools entries are un-namespaced tool names with optional `*` wildcard
// (mirrors getAggregatedMCPTools). listTools() returns `${server}_${tool}`.
function isAllowed(toolName: string, serverName: string, allowed: string[]): boolean {
  const prefix = `${serverName}_`
  const bare = toolName.startsWith(prefix) ? toolName.slice(prefix.length) : toolName
  return allowed.some((pat) =>
    pat === '*' ? true : pat.endsWith('*') ? bare.startsWith(pat.slice(0, -1)) : bare === pat
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
    id: `proto-${cfg.name}-${chatbotId}`,
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

// Read the KB server row from the DB (faithful auth/header policy) but override
// the URL to the local stub. Returns null if no KB server is configured.
export async function loadKbServerConfig(): Promise<McpServerConfig | null> {
  const { rows } = await pool.query(
    `SELECT name, url, "authType", "passChatbotId", "chatbotIdHeader"
     FROM "ChatbotMCPServer" WHERE name = 'KB' LIMIT 1`
  )
  if (!rows[0]) return null
  const r = rows[0]
  return {
    name: r.name,
    url: r.url,
    authType: r.authType,
    secret: null, // KB is authType 'none' in seed; no decryption needed
    passChatbotId: r.passChatbotId,
    chatbotIdHeader: r.chatbotIdHeader,
  }
}

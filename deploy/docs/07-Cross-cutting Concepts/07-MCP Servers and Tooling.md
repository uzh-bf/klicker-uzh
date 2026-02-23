# MCP Servers and Tooling

Cross-cutting integration pattern that lets chatbots call external tools via MCP (Model Context Protocol) with DB-driven server configuration, per-mode filtering, and deterministic tool naming.

## Concept

- MCP servers are configured in the database and attached to chatbots per `chatMode` (e.g., tutor/explainer).
- Tools are loaded at request time, filtered by allow-lists, and deduplicated in priority order.
- Secrets for MCP auth are stored encrypted and decrypted at runtime before building request headers.

## How it works

- Data model (DB-driven configuration):
  - `ChatbotMCPServer` holds server-level config: `{ name, url, authType, authSecret, parameters, passChatbotId, chatbotIdHeader, isActive }`.
  - `ChatbotMCPConfig` attaches a server to a chatbot per mode: `{ chatMode, allowedTools, priority, isEnabled, parameters }`.
  - Schema: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/prisma/src/prisma/schema/chat.prisma`
- Chat request selects active MCP configs for the chosen mode:
  - Filters `mcpConfigurations` by `{ chatMode: selectedMode, isEnabled: true }` and server `isActive === true`.
  - Orders by `priority ASC` (lower number loads first).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- Transport and auth header construction:
  - Uses `StreamableHTTPClientTransport(new URL(server.url), { requestInit: { headers } })`.
  - `authType` supports `bearer`, `basic`, `none`, and `custom` (JSON-provided headers); `authSecret` is decrypted via `safeDecrypt`.
  - Optional chatbot header: `passChatbotId` with sanitized header name (default `Chatbot-ID`).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`
- Tool filtering + deterministic naming:
  - `allowedTools` supports wildcard patterns (`*`, `?`) matched case-insensitively.
  - Tool names are namespaced as `{serverName}_{toolName}`, sanitized to `[A-Za-z0-9_-]`, and limited to 64 chars.
  - Collisions/overlength names get a deterministic hash suffix.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`
- Aggregation behavior:
  - Tools are loaded from each server in priority order and merged by first occurrence (later servers cannot overwrite earlier tool names).
  - Individual server failures yield an empty tool set for that server and do not fail the whole request.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`
- Legacy environment configuration (backward compatibility):
  - If only `MCP_URL`/`MCP_KEY` are configured, `getMCPTools(...)` wraps them as a single “Legacy_MCP” server.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`

## Affected workloads

- [[Chat]]
- [[MCP - Doc Query (RAG)]]
- [[MCP - Skills]]

## Configuration

- `MCP_URL` — legacy
- `MCP_KEY` — legacy

## Related docs

- [[03-Chat Request Lifecycle]]
- [[06-AI Keys and Model Registry]]

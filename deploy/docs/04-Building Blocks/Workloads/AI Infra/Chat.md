# Chat

AI chat application (Next.js) that provides a “Chat Agent” UI and backend API for course-specific chatbots, model selection, credits, and MCP tool usage.

## In-repo implementation

- App: `apps/chat/`
- Chat streaming API route: `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- Model registry + automatic selection: `apps/chat/src/lib/server/chatModelRegistry.ts`
- MCP client + tool aggregation: `apps/chat/src/services/mcpClients.ts`
- Prisma models: `packages/prisma/src/prisma/schema/chat.prisma`

## Responsibilities

- Provide a chat UI and API that streams model output (`streamText`).
- Select the model deployment based on:
  - an environment-provided registry (`CHAT_MODEL_REGISTRY_JSON`) or defaults
  - chatbot configuration and credits
- Integrate MCP tools by loading MCP server configs (from DB) and exposing them to the model as tools.
- Persist threads/messages and usage credits in Postgres via Prisma.

## Model provider integration (repo-grounded)

Chat currently integrates with **Azure OpenAI** via `@ai-sdk/azure` (`createAzure(...)`) using the Responses API:

- API key: from per-chatbot encrypted key (`Chatbot.azureOpenAIKey`) or env fallback (`AZURE_API_KEY` / `AZURE_OPENAI_API_KEY`)
- Resource/endpoint: from per-chatbot endpoint (`Chatbot.azureOpenAIEndpoint`) or env fallback (`AZURE_RESOURCE_NAME`)
- API version: `AZURE_RESPONSES_API_VERSION` (defaults to `preview` in code)

> The overview architecture routes model traffic via `LiteLLM Gateway`. This repo currently shows direct Azure OpenAI integration in code; validate whether production routes via a gateway at the network/config level.

## MCP integration

MCP servers are configured in the database:

- `ChatbotMCPServer` defines server URL + auth type + encrypted auth secret.
- `ChatbotMCPConfig` defines per-chatbot/per-mode configuration (enabled, priority, allowed tool patterns, parameters).

At runtime, Chat:

- creates MCP clients using streamable HTTP transport (Model Context Protocol SDK)
- loads each server’s tool list and filters tools by `allowedTools`
- normalizes tool names to be OpenAI-compatible and deterministic
- aggregates tools by priority (lower number = higher priority)

Legacy fallback: if no DB servers are configured, the app can load a single MCP server from `MCP_URL` (+ optional `MCP_KEY`).

## Deployment (Helm)

- Chart: `deploy/charts/klicker-uzh-v3/`
- Deployment template: `deploy/charts/klicker-uzh-v3/templates/deployment-chat.yaml`
- ConfigMap: `deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml`
- Secret: `{{ releaseFullname }}-secret-chat`
- Health endpoint for probes: `GET /api/health`

## Configuration (names only)

- Azure: `AZURE_API_KEY` / `AZURE_OPENAI_API_KEY`, `AZURE_RESOURCE_NAME`, `AZURE_RESPONSES_API_VERSION`
- Model registry: `CHAT_MODEL_REGISTRY_JSON`, `CHAT_PRIMARY_MODEL_ID`, `CHAT_FALLBACK_MODEL_ID`
- MCP legacy: `MCP_URL`, `MCP_KEY`
- Encryption/JWT secret used for decrypting stored keys: `APP_SECRET`

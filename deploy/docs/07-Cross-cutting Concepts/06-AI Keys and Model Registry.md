# AI Keys and Model Registry

Cross-cutting configuration pattern for chat model selection, Azure OpenAI credentials, and credit-gated fallback behavior across all chatbot requests.

## Concept

- The chat service selects models from a JSON registry (env-configurable) and enforces fallback behavior when users have no credits.
- Azure OpenAI credentials can be provided globally via env vars or overridden per chatbot (stored encrypted in DB).
- Reasoning effort is constrained by both model capabilities and per-chatbot allow-lists.

## How it works

- Model registry (global):
  - Parsed from `CHAT_MODEL_REGISTRY_JSON` (Zod-validated); falls back to built-in defaults on missing/invalid values.
  - Registry requires at least one `fallback: true` model.
  - Model fields include `id`, `deploymentId`, `name`, `fallback`, `supportsReasoning`, `supportedReasoningEfforts`, `maxOutputTokens`, `apiVersion`, `cost.{input,output}`.
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/lib/server/chatModelRegistry.ts`
- Automatic selection + credit gating:
  - If credits are `<= 0`, `getModelsForChatbot(...)` returns fallback-only models.
  - Automatic selection prefers:
    - `CHAT_PRIMARY_MODEL_ID` (if present in registry) or the first non-fallback registry entry
    - `CHAT_FALLBACK_MODEL_ID` (if present and marked fallback) or the first fallback entry
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/lib/server/chatModelRegistry.ts`
- Per-chatbot constraints (DB-driven):
  - `Chatbot.allowedModelIds` limits selectable models (fallback models still remain available).
  - `Chatbot.allowedReasoningEffortsByModel` limits reasoning effort per model.
  - Schema: `/Volumes/HOME/Git/klicker/klicker-uzh/packages/prisma/src/prisma/schema/chat.prisma`
- Azure OpenAI key + endpoint selection:
  - Per-chatbot encrypted key: `Chatbot.azureOpenAIKey` is decrypted using `safeDecrypt(...)`.
  - Env fallback key names: `AZURE_API_KEY` or `AZURE_OPENAI_API_KEY`.
  - Azure resource selection uses `AZURE_RESOURCE_NAME` by default; if `Chatbot.azureOpenAIEndpoint` is set, `resourceName` is derived from the hostname.
  - Uses the Azure Responses API via `azure.responses(deploymentId)` with `AZURE_RESPONSES_API_VERSION` (default `preview`).
  - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
- Helm-configured registry controls:
  - ConfigMap sets `AZURE_RESOURCE_NAME` and optional registry/automatic IDs.
  - Helm: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/cm-chat.yaml`

## Affected workloads

- [[Chat]]
- [[Azure OpenAI]]
- [[00-Component Catalog]]

## Configuration

- `CHAT_MODEL_REGISTRY_JSON` — registry
- `CHAT_PRIMARY_MODEL_ID` — select
- `CHAT_FALLBACK_MODEL_ID` — select
- `AZURE_RESOURCE_NAME` — azure
- `AZURE_API_KEY` — azure
- `AZURE_OPENAI_API_KEY` — azure
- `AZURE_RESPONSES_API_VERSION` — azure

## Related docs

- [[03-Chat Request Lifecycle]]
- [[07-MCP Servers and Tooling]]

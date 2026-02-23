# Chat Request Lifecycle

Flow for handling a single chat message from request validation through model/tool execution, streaming, persistence, and credit accounting.

## Actors

- Participant using `[[Chat]]` (web UI)
- Chat API route (Next.js App Router): `/api/chatbots/{chatbotId}/chat`
- Azure OpenAI via `@ai-sdk/azure` (`[[Azure OpenAI]]`)
- MCP servers configured per chatbot (`[[07-MCP Servers and Tooling]]`)
- PostgreSQL via Prisma (`ChatThread` / `ChatMessage`)
- Credits and disclaimer services (`CreditsService`, `DisclaimersService`)

## Flow

1. **Client sends a chat request**
   - Payload includes: `messages[]`, `threadId?`, `selectedModel`, `selectedMode`, `reasoningEffort`, `parentId?`, `assistantMessageId`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
   - Helm: `/Volumes/HOME/Git/klicker/klicker-uzh/deploy/charts/klicker-uzh-v3/templates/deployment-chat.yaml`
2. **Auth + disclaimer gate**
   - `withChatbotAuth(req, chatbotId)` verifies the participant and access to the chatbot.
   - `DisclaimersService.checkDisclaimerStatus(chatbotId, participantId)` enforces required acceptance (`403` on missing acceptance).
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/lib/server/apiGuards.ts`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
3. **Request validation**
   - Zod schema validates shape and normalizes `selectedMode` to lowercase; invalid bodies return `400`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
4. **Load chatbot configuration from DB**
   - Fetches `chatbot.systemPrompts` and `mcpConfigurations` filtered by `chatMode === selectedMode` and `isEnabled === true`.
   - Orders MCP configurations by `priority` and filters out inactive MCP servers (`mcpServer.isActive !== true`).
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
5. **Thread resolution and ownership checks**
   - Creates a thread when `threadId` is missing (`ThreadService.createThread`).
   - Validates that the resolved thread belongs to `{ participantId, chatbotId }` before persisting messages.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/threads.ts`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
6. **Aggregate MCP tools (optional)**
   - Loads tools from configured MCP servers via streamable HTTP transport.
   - Applies `allowedTools` wildcard patterns (`*` / `?`) per configuration and dedupes tools in priority order.
   - Renames tools deterministically into OpenAI-compatible names (max 64 chars, hash suffix when needed).
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/services/mcpClients.ts`
7. **Select model + enforce credit gating**
   - Registry is loaded from `CHAT_MODEL_REGISTRY_JSON` (or built-in defaults) and always includes at least one `fallback: true` model.
   - If `chatbot.modelSelection` is disabled: auto-selects via `getAutomaticModelId(credits, allowedModelIds)`.
   - If `chatbot.modelSelection` is enabled: enforces `allowedModelIds` and forces fallback-only usage when credits are exhausted.
   - Applies reasoning-effort restrictions per model by intersecting with `allowedReasoningEffortsByModel`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/lib/server/chatModelRegistry.ts`
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
8. **Build Azure model client**
   - Uses per-chatbot overrides (`azureOpenAIKey`, `azureOpenAIEndpoint`) or falls back to env.
   - Uses Responses API (`azure.responses(deploymentId)`) with `AZURE_RESPONSES_API_VERSION` (default: `preview`).
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
9. **Persist user message metadata**
   - Writes/updates `ChatMessage` for the user input with `{ chatMode, modelId, reasoningEffort }` and bumps `ChatThread.updatedAt`.
   - Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
10. **Stream response with tool orchestration**

- `streamText({ tools, toolChoice: 'auto', stopWhen: stepCountIs(5), abortSignal: req.signal, ... })`.
- Tracks partial text/reasoning on chunks; persists assistant message on finish, and persists partial content on abort.
- Deducts credits using `calcCost(cost, inputTokens, outputTokens)` and `CreditsService.decrementCredits(...)`.
- Classifies provider errors into:
  - `model_error`, `rate_limit_or_quota`, `auth_or_permission`, `content_filter_or_policy`, `unknown`
- Code: `/Volumes/HOME/Git/klicker/klicker-uzh/apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`

## Key decision points

- Disclaimer enforcement (`DisclaimersService`) blocks usage until acceptance.
- Model selection mode:
  - automatic selection when `chatbot.modelSelection === false`
  - user selection when `true`, but overridden to fallback models when credits are exhausted
- Allowed model IDs allow-list and fallback enforcement.
- Reasoning effort is constrained per model and per chatbot configuration.
- MCP tool availability depends on `{ chatMode, isEnabled, isActive }` plus `allowedTools` patterns.

## Error handling

- Request-level:
  - `403` if disclaimer is required and not accepted
  - `400` for invalid body or unavailable model selection
  - `404` if chatbot is missing
- MCP tools:
  - Individual MCP server failures return empty tool sets for that server and continue loading others.
- Streaming:
  - Aborts persist partial assistant content and may still decrement credits based on per-step usage.
  - Errors are serialized and classified, and the stream emits an error final state.

## Related docs

- [[Chat]]
- [[Azure OpenAI]]
- [[06-AI Keys and Model Registry]]
- [[07-MCP Servers and Tooling]]

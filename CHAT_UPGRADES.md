# Chat App Upgrade Plan: AI SDK 6 + assistant-ui 0.12.x

## 1. Current Architecture Summary

### Package Versions

| Package                        | Current Version       |
| ------------------------------ | --------------------- |
| `ai` (AI SDK)                  | 6.0.91                |
| `@ai-sdk/openai`               | 3.0.30                |
| `@ai-sdk/mcp`                  | 0.0.13 (experimental) |
| `@assistant-ui/react`          | 0.12.10               |
| `@assistant-ui/react-ai-sdk`   | 1.3.7                 |
| `@assistant-ui/react-markdown` | 0.12.3                |
| `@modelcontextprotocol/sdk`    | 1.17.5                |
| `@langfuse/otel`               | 4.6.1                 |

### Key Files

| File                                                       | Purpose                                |
| ---------------------------------------------------------- | -------------------------------------- |
| `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` | Streaming endpoint (~1405 lines)       |
| `apps/chat/src/app/RuntimeProvider.tsx`                    | assistant-ui runtime setup             |
| `apps/chat/src/hooks/useChatResponse.ts`                   | SSE streaming client (~610 lines)      |
| `apps/chat/src/hooks/useThreadManagement.ts`               | Thread lifecycle callbacks             |
| `apps/chat/src/stores/chatStore.ts`                        | Zustand thread/message state           |
| `apps/chat/src/stores/settingsStore.ts`                    | Model, mode, reasoning settings        |
| `apps/chat/src/services/mcpClients.ts`                     | MCP client creation + tool aggregation |
| `apps/chat/src/services/credits.ts`                        | Credit init/query/decrement            |
| `apps/chat/src/components/thread.tsx`                      | UI component tree                      |
| `apps/chat/src/components/markdown-text.tsx`               | Markdown + KaTeX rendering             |
| `apps/chat/src/components/tools-ui/rag-tool-ui.tsx`        | RAG tool UI (`makeAssistantToolUI`)    |

### Data Flow

```
User input
  -> RuntimeProvider (useExternalStoreRuntime)
    -> useThreadManagement.onNew()
      -> useChatResponse.generateChatResponse()
        -> POST /api/chatbots/[chatbotId]/chat
          -> streamText({ model, tools: mcpTools, stopWhen: stepCountIs(5), ... })
            -> onChunk: track partial text/reasoning
            -> onStepFinish: log diagnostics per step
            -> onFinish: persist message, deduct credits
            -> onAbort: persist partial, deduct partial credits
            -> onError: classify + log
          -> toUIMessageStreamResponse({ sendReasoning: true, messageMetadata })
        <- SSE stream parsed by useChatResponse
      <- Message added to Zustand chatStore
    <- Runtime syncs messages to assistant-ui
  <- ThreadPrimitive renders messages
```

Custom logic layered on top of AI SDK streaming:

- **Credits**: token-based cost calculation + atomic decrement on finish/abort
- **Reasoning**: dynamic effort per model, BFS extraction from providerMetadata, persisted separately
- **Message branching**: tree structure with `parentId`, `allMessages` (full tree) vs `messages` (current path)
- **MCP tools**: priority-based aggregation from multiple servers, wildcard filtering, namespaced tool names
- **Telemetry**: Langfuse via OpenTelemetry span processor (passive), plus per-event dev logging

---

## 2. AI SDK 6 Upgrade Opportunities

### 2.1 DevTools

**What**: Debug middleware that exposes an inspector UI for all LLM calls.

**How it maps**: Currently debugging relies on `logChatDev()` console output and Langfuse traces. DevTools would give an interactive local inspector showing inputs, outputs, tokens, timing, and raw provider data -- complementing Langfuse for local dev.

**Migration path**:

1. Install: `pnpm --filter @klicker-uzh/chat add @ai-sdk/devtools` (dev dependency)
2. Wrap model in `route.ts`:
   ```ts
   import { devToolsMiddleware } from '@ai-sdk/devtools'
   // In dev only:
   const wrappedModel = devToolsMiddleware()(openaiModelSelection.model)
   ```
3. Launch inspector: `npx @ai-sdk/devtools` (opens localhost:4983)
4. No production impact -- guard behind `NODE_ENV === 'development'`

**Effort**: Low (< 1 hour). No behavior changes. Pure additive.

---

### 2.2 ToolLoopAgent

**What**: Higher-level abstraction replacing raw `streamText()` + `stepCountIs()` + manual callbacks with a declarative agent definition.

**How it maps**: The current `route.ts` uses `streamText()` at line 950 with:

- `stopWhen: stepCountIs(5)` for multi-step tool loops
- Manual `onFinish`, `onAbort`, `onStepFinish`, `onError` callbacks (~400 lines)
- Custom step content mapping (`mapAssistantStepContent`)

A `ToolLoopAgent` could encapsulate the agent loop with `instructions`, `tools`, and stop conditions while still allowing lifecycle hooks.

**Migration path**:

1. Extract agent config per chat mode (tutor, etc.)
2. Replace `streamText()` call with agent invocation
3. **Critical**: preserve all custom lifecycle logic:
   - `onFinish`: credit deduction, message persistence, metadata emission
   - `onAbort`: partial credit deduction, partial message persistence
   - `onStepFinish`: tool diagnostics logging
   - `onError`: error classification + logging
4. Verify `toUIMessageStreamResponse()` still works with agent output

**Effort**: Medium-High. The agent abstraction is cleaner but the 1400-line route has deeply interleaved lifecycle logic. Risk of regressions in credit/persistence handling. Recommended as part of a larger `route.ts` refactor, not standalone.

---

### 2.3 Extended Usage Details

**What**: Structured token breakdown replacing manual extraction.

**How it maps**: The current `extractReasoningTokens()` function (lines 119-149) does a BFS through `providerMetadata` to find `reasoningTokens` or `outputTokensDetails.reasoningTokens`. This is a workaround for inconsistent provider metadata shapes.

AI SDK 6 now provides:

- `usage.outputTokenDetails.reasoningTokens` -- direct access, no BFS needed
- `usage.inputTokenDetails.cacheReadTokens`, `cacheWriteTokens` -- cache-aware credit calculation
- `usage.raw` -- full provider-specific usage object

**Migration path**:

1. In `onFinish` and `onStepFinish`, replace:

   ```ts
   // Before
   const providerReasoningTokens = extractReasoningTokens(
     asObject(result)?.providerMetadata
   )

   // After
   const providerReasoningTokens =
     result.totalUsage?.outputTokenDetails?.reasoningTokens ?? null
   ```

2. Optionally use `inputTokenDetails.cacheReadTokens` for more accurate credit calculation (cached tokens cost less)
3. Remove `extractReasoningTokens()`, `asObject()`, `toTokenCount()` helper functions (~70 lines)
4. Update `calcCost()` to account for cache read vs write token pricing if desired

**Effort**: Low. Direct replacement of ~5 call sites. Can be done incrementally. High confidence -- the structured fields are stable API.

---

### 2.4 Stable MCP

**What**: `@ai-sdk/mcp` graduated from experimental to stable with expanded capabilities.

**How it maps**: Current usage in `mcpClients.ts`:

```ts
import { experimental_createMCPClient as createSDKMCPClient } from '@ai-sdk/mcp'
```

Uses `StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk` for HTTP transport with custom auth headers.

Stable MCP adds:

- First-class HTTP transport (no need for separate `@modelcontextprotocol/sdk` transport)
- OAuth authentication with PKCE + token refresh
- Resources and prompts support (could expose RAG sources as MCP resources)
- Elicitation (server-initiated user input requests)

**Migration path**:

1. Update `@ai-sdk/mcp` to latest stable version
2. Replace `experimental_createMCPClient` with `createMCPClient` (stable import)
3. Evaluate whether built-in HTTP transport can replace manual `StreamableHTTPClientTransport` setup
4. If OAuth is needed for any MCP server, adopt built-in OAuth support instead of custom auth header logic
5. Test all existing auth types (bearer, basic, custom) still work

**Effort**: Medium. The import rename is trivial, but validating all auth patterns across MCP server configurations requires integration testing. OAuth support is net-new if needed.

---

### 2.5 Structured Output

**What**: `Output.object()`, `Output.array()`, `Output.choice()` combined with `streamText` -- multi-step tool loop that produces a typed final output.

**How it maps**: Tutor mode currently uses freeform text responses. Structured output could enforce a schema for tutor feedback (e.g., `{ feedback: string, hints: string[], score: number }`), making responses more consistent and parseable by the UI.

**Migration path**:

1. Define Zod schemas for each chat mode's structured output
2. Pass `output: Output.object({ schema })` to `streamText()`
3. Update `toUIMessageStreamResponse()` to handle structured output parts
4. Update `mapAssistantStepContent()` to persist structured output
5. Update frontend to render structured tutor feedback

**Effort**: Medium. Schema definition is easy; integrating with existing persistence and UI rendering is the real work. Best suited as a feature enhancement, not a migration task.

---

### 2.6 Tool Execution Approval

**What**: `needsApproval: true | ((toolCall) => boolean)` on tools enables user confirmation before execution.

**How it maps**: Currently all MCP tools execute automatically (`toolChoice: 'auto'`). For sensitive operations (data writes, external API calls), approval could prevent unintended actions. The async function variant allows conditional approval (e.g., approve search but confirm writes).

**Migration path**:

1. Add approval logic per tool or tool category in `getAggregatedMCPTools()`
2. Implement client-side approval UI (assistant-ui supports this via tool confirmation primitives)
3. Wire approval responses back through the stream

**Effort**: Medium-High. Requires both backend (tool metadata) and frontend (approval UI) work. Not urgent unless there are trust/safety concerns with current tool execution.

---

## 3. assistant-ui Upgrade Opportunities

### 3.1 Patch Version Bump (0.12.10 -> 0.12.17)

**What**: Bug fixes with no breaking changes.

**Key fixes included**:

- Fixed duplicate `toolCallId` parts in external message converter
- Fixed `ActionBarMorePrimitive` autohide behavior
- Better tool invocation stream recovery for non-executable client tools
- Orphaned tool results no longer crash the thread
- Double-submit prevention when composer has `type='submit'`
- `toJSONSchema` utility replaces zod for schema serialization (smaller bundle)

**Migration path**:

```bash
pnpm --filter @klicker-uzh/chat add @assistant-ui/react@0.12.17 @assistant-ui/react-ai-sdk@latest @assistant-ui/react-markdown@latest
```

**Effort**: Minimal. Drop-in upgrade. Test thread rendering, tool UIs, and composer behavior.

---

### 3.2 useChatRuntime Evaluation

**What**: `useChatRuntime()` from `@assistant-ui/react-ai-sdk` handles transport, streaming, and state automatically -- potentially replacing `useExternalStoreRuntime` + custom hooks.

**Comparison**:

| Concern            | Current (`useExternalStoreRuntime`)                   | `useChatRuntime`                   |
| ------------------ | ----------------------------------------------------- | ---------------------------------- |
| Transport          | Custom SSE in `useChatResponse.ts` (~610 lines)       | Built-in, auto-forwards to backend |
| State              | Zustand `chatStore.ts`                                | Internal, with external access     |
| Message format     | `ExtendedThreadMessageLike` with custom metadata      | Standard `ThreadMessageLike`       |
| Branching          | Custom tree with `parentId`, `allMessages`/`messages` | Built-in branching support         |
| Credits tracking   | Custom per-message in metadata                        | Would need custom layer            |
| Model selection    | Custom `settingsStore` + request body                 | Would need custom layer            |
| Abort handling     | Custom `AbortController` in `useChatResponse`         | Built-in                           |
| Thread persistence | Custom DB sync in store                               | Would need custom adapter          |
| Reasoning display  | Custom metadata extraction                            | Built-in with `sendReasoning`      |
| Tool UIs           | `makeAssistantToolUI` (works with both)               | Same API                           |

**What custom logic remains needed with `useChatRuntime`**:

- Credit balance tracking + automatic model downgrade
- Per-message metadata (chatMode, modelId, reasoningEffort, creditsUsed)
- Thread persistence to PostgreSQL (create, load, switch, branch)
- Custom request body (threadId, selectedModel, selectedMode, reasoningEffort, parentId, assistantMessageId)
- Post-response actions (credit refresh via `loadCredits()`)

**Recommendation**: **Keep `useExternalStoreRuntime` for now.** The current architecture has deep customization (credits, branching, persistence, model selection) that `useChatRuntime` doesn't handle out of the box. Migration would require reimplementing most of this as custom middleware/adapters, providing little net simplification. Revisit when assistant-ui adds more extensibility points for these patterns.

**Effort if attempted**: High. Estimated 2-3 days for migration + testing, with risk of regressions in branching, credits, and persistence.

---

### 3.3 Toolkit API Migration

**What**: assistant-ui deprecated old context hooks (e.g., `useThreadContext`, `useAssistantContext`) in favor of the Toolkit API with more granular hooks.

**Current status**: Audited all assistant-ui imports across `apps/chat`:

| Import                      | File(s)                    | Status         |
| --------------------------- | -------------------------- | -------------- |
| `useExternalStoreRuntime`   | `RuntimeProvider.tsx`      | Current/stable |
| `ThreadPrimitive.*`         | `thread.tsx`               | Current/stable |
| `ComposerPrimitive.*`       | `thread.tsx`               | Current/stable |
| `MessagePrimitive.*`        | `thread.tsx`               | Current/stable |
| `ActionBarPrimitive.*`      | `thread.tsx`               | Current/stable |
| `makeAssistantToolUI`       | `tools-ui/rag-tool-ui.tsx` | Current/stable |
| `ReasoningMessagePartProps` | `thread.tsx`               | Current/stable |

**Finding**: No deprecated context hooks are currently in use. All imports use the current Primitive-based API. No migration needed.

**Effort**: None.

---

### 3.4 Unstable API Monitoring

**What**: Some assistant-ui APIs are marked `Unstable_` prefix, indicating they may change.

**Currently used unstable APIs**: None found in the codebase.

**APIs to be aware of for future use**:

- `MessagePrimitive.Unstable_PartsGrouped` -- groups consecutive content parts by type for rendering. Could be useful for grouped tool call display.
- `unstable_memoizeMarkdownComponents` -- memoizes markdown component definitions to avoid unnecessary re-renders. Could improve performance of the `MarkdownText` component in `markdown-text.tsx`.

**Recommendation**: Monitor these for stabilization. `unstable_memoizeMarkdownComponents` is a likely candidate for adoption once stable, given the math-heavy markdown rendering in the chat app.

**Effort**: None now. Low when adopting.

---

## 4. Recommended Priority / Roadmap

### Phase 1: Quick Wins (< 1 day)

| Item                          | Impact                       | Risk            |
| ----------------------------- | ---------------------------- | --------------- |
| Patch bump assistant-ui (3.1) | Bug fixes, stability         | Very low        |
| Add DevTools (2.1)            | Dev experience               | None (dev-only) |
| Extended Usage Details (2.3)  | Cleaner code, better credits | Low             |

### Phase 2: Infrastructure (1-2 days)

| Item                       | Impact                      | Risk                         |
| -------------------------- | --------------------------- | ---------------------------- |
| Stable MCP migration (2.4) | Future-proof, OAuth support | Medium (integration testing) |

### Phase 3: Feature Enhancements (2-5 days each)

| Item                                   | Impact                         | Risk        |
| -------------------------------------- | ------------------------------ | ----------- |
| Structured Output for tutor mode (2.5) | Better UX, consistent feedback | Medium      |
| Tool Execution Approval (2.6)          | Trust/safety                   | Medium-High |

### Phase 4: Major Refactor (1-2 weeks)

| Item                           | Impact                            | Risk |
| ------------------------------ | --------------------------------- | ---- |
| ToolLoopAgent refactor (2.2)   | Cleaner route.ts, maintainability | High |
| useChatRuntime migration (3.2) | Simpler client code               | High |

Phase 4 items should be bundled together as a larger refactor of the chat architecture, not attempted incrementally.

---

## 5. Open Questions

- **Credit granularity**: Should `calcCost()` differentiate cached vs non-cached input tokens using `inputTokenDetails`? This would make credits more accurate for conversations with long context.
- **MCP OAuth**: Are any current or planned MCP servers using OAuth? If so, the stable MCP migration (2.4) becomes higher priority.
- **Structured tutor output**: What schema should tutor mode responses follow? Needs pedagogical input before implementation.
- **Tool approval scope**: Which MCP tools (if any) are considered sensitive enough to warrant human approval?
- **DevTools in CI**: Should DevTools middleware be wired into test/CI environments for automated debugging, or local-only?
- **Route.ts decomposition**: Is there appetite to break the 1400-line route handler into smaller modules (auth, credits, streaming, persistence) independent of the ToolLoopAgent migration?
- **assistant-ui `unstable_memoizeMarkdownComponents`**: Worth adopting now for markdown rendering performance, or wait for stable API?

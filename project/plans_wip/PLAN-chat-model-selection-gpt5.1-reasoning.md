# Chat app: GPT‑5.1 / GPT‑4.1 selection + GPT‑5.1 reasoning levels

## Goal

Add user-facing selection between **GPT‑5.1** and **GPT‑4.1** (when enabled per chatbot), plus **reasoning effort** levels for GPT‑5.1.

Must remain compatible with:
- existing credit-based fallback behavior
- semi-anonymous chat mode (forced cheapest unlimited model)

## Progress (feat/chat-gpt-5-1)

**Done on this branch**
- Added GPT-5.1 to the server-side model registry (`apps/chat/src/lib/server/chatModelRegistry.ts`).
- Fixed GPT-5.1 streaming truncation by switching to Azure Responses API (`azure.responses(deploymentId)`, `api-version=preview`) and surfacing `finishReason` to the UI.
- Added a CLI debug script (`util/azureOpenAiTest.ts`) to validate Azure endpoint + api-version combinations.
- Persisted and displayed per-message metadata (`chatMode`, `modelId`, `creditsUsed`).
- Browser validation confirmed model/mode selection and metadata persistence.

**Remaining**
- Implement GPT-5.1 reasoning effort selection (UI + request schema + provider options).
- Decide the long-term default/limit for GPT-5.1 max output tokens (currently capped in the route).
- If model selection needs per-course behavior later, decide whether it lives on the course↔chatbot link.

## Current state (code)

### Model registry
- `apps/chat/src/lib/server/chatModelRegistry.ts`
  - Source of truth for model IDs, Azure deployments, api-version, and pricing.
  - Can be overridden via `CHAT_MODEL_REGISTRY_JSON`.

### Selection logic
- `apps/chat/src/stores/settingsStore.ts`
  - Loads `availableModels` + `automaticModelId` from `/api/chatbots/<chatbotId>/credits`.
  - If `chatbot.modelSelection === false`, UI auto-picks `automaticModelId`.
  - If credits are `0`, backend filters models to `fallback: true`.

### Server enforcement
- `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts`
  - If `!chatbot.modelSelection`, server overrides client selection based on credits.
  - Uses Azure **Responses API** via `azure.responses(deploymentId)` with `api-version=preview` (override: `AZURE_RESPONSES_API_VERSION`).
  - Persists `chatMode`, `modelId`, and `creditsUsed` per message.
  - No support for reasoning effort yet.

## Requirements

1. Expose GPT‑5.1 and GPT‑4.1 in the model picker when model selection is enabled.
2. Add GPT‑5.1 reasoning effort selector (`none|low|medium|high`).
3. When model selection is disabled, keep automatic selection as-is (credits-based) unless explicitly changed.
4. In semi-anonymous mode, force cheapest unlimited model and hide/ignore selection.

## Proposed design

### 1) Extend model registry

Update `apps/chat/src/lib/server/chatModelRegistry.ts`:

- Ensure GPT‑5.1 is present in the default registry and/or `CHAT_MODEL_REGISTRY_JSON`.
- Keep pricing + api-version centralized in the registry.
- Add capability metadata for UI (if needed on the client):

```ts
supportsReasoningEffort?: boolean
reasoningEffortOptions?: Array<'none'|'low'|'medium'|'high'>
```

Optional cleanup (recommended): add a public client model registry endpoint or extend `/api/chatbots/<chatbotId>/credits` to include reasoning capability metadata.

### 2) Add reasoning effort state

Update `apps/chat/src/stores/settingsStore.ts`:

- Add `selectedReasoningEffort` to state and persist it.
- Default: `none`.
- When model changes away from GPT‑5.1, keep effort but ignore it; when switching back, reuse last choice.

### 3) Settings UI

Update `apps/chat/src/components/settings-panel.tsx`:

- When `modelSelectionEnabled && selectedModel === 'gpt-5.1'`, show a second `Select`:
  - label: “Reasoning effort”
  - options: none/low/medium/high
- If semi-anonymous mode is active, hide the entire model selection block (see semi-anonymous plan).

### 4) API contract

Update `apps/chat/src/app/api/chatbots/[chatbotId]/chat/route.ts` request schema:

- Add optional field:

```ts
reasoningEffort: z.enum(['none', 'low', 'medium', 'high']).optional().default('none')
```

Server-side enforcement rules:
- If `authMode === 'anonymous'` → force model to cheapest unlimited; force reasoning effort to `none`.
- Else if `!chatbot.modelSelection` → ignore client model + effort (or keep effort but unused).

### 5) Provider plumbing for reasoning effort

We need to pass GPT‑5.1 reasoning effort to Azure OpenAI.

Preferred plan:
- Upgrade `ai` + `@ai-sdk/azure` to a version that supports a provider option for reasoning effort.
- Pass the value via `streamText()` using `providerOptions` (exact shape to be confirmed from typings).

Example (placeholder; confirm actual option path):

```ts
streamText({
  model,
  messages,
  providerOptions: selectedModel === 'gpt-5.1'
    ? { azure: { reasoning: { effort: reasoningEffort } } }
    : undefined,
})
```

If provider doesn’t support it even after upgrade:
- fallback plan is a manual Azure request + SSE stream proxy (avoid unless necessary).

### 6) Credits + pricing

- Credits are computed from `ChatModelConfig.cost` in `chatModelRegistry.ts`.
- Keep billing on `inputTokens`/`outputTokens` as currently.
- If Azure exposes separate “reasoning tokens”, decide later how to bill (out of scope for first iteration).

## Implementation steps

1. Ensure GPT‑5.1 is in `chatModelRegistry.ts` (default registry or `CHAT_MODEL_REGISTRY_JSON`).
2. Add `selectedReasoningEffort` state + actions in `settingsStore.ts`.
3. Add reasoning effort UI in `settings-panel.tsx`.
4. Update chat API route schema to accept `reasoningEffort`.
5. Upgrade `ai` + `@ai-sdk/azure` if needed and plumb reasoning effort.
6. Enforce semi-anonymous restrictions (server + UI).

## Testing strategy

- Unit:
  - `models.ts` includes GPT‑5.1 and returns correct config.
  - `settingsStore` persists reasoning effort.
- Integration/manual:
  - GPT‑5.1 requests include reasoning effort.
  - Non‑GPT‑5.1 ignores reasoning effort.
  - Anonymous mode cannot select GPT‑5.1.

## Rollout

- Keep behind existing `chatbot.modelSelection` toggle.
- Optionally add env flag `CHAT_ENABLE_GPT5_1` until Azure deployments are ready.

## Open questions

1. If we move to course-scoped endpoints, should the credits/model picker be moved under `/api/courses/<courseId>/chatbots/<chatbotId>/credits`?
2. Default reasoning effort should be `none` or `medium`?

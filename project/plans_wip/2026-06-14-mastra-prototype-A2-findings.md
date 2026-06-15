# Mastra Chat Prototype — A2 Rework Findings

**Context.** This document is a delta/correction report on top of the existing prototype verdict at `prototype/mastra-chat/RESULTS.md` and the evaluation report at `project/plans_future/2026-06-11-mastra-evaluation-report.md`. It does not restate the full per-slice matrix — refer to those paths for S0–S7 verdicts that remain valid. The A2 (reasoning-streaming) slice was the last open item after the June 2026 evaluation; it has now been completed against Azure klicker-ai using gpt-5.1. In the course of that work a misdiagnosis in S1 was identified and corrected, invalidating one of the four "Conditions on GO" and two rows in the §5 verdict matrix. All other slices, the overall GO/Scope A+ decision, and the §9.6 architecture are unaffected.

---

## Headline Correction

The prior evaluation recorded one non-negotiable condition on GO: **pin `provider.chat` (Chat Completions) because the `@ai-sdk/openai` default `provider(modelId)` uses the Responses API, which breaks stateless multi-step tool calls**. That condition is superseded and must not be carried into productionization.

**What actually happened.** S1 validation produced the error "No tool call found for function call output" against OpenRouter/Azure. The diagnostic at the time attributed the failure to the Responses API itself and switched to `provider.chat()` as the fix. A2 rework bisected the root cause live against Azure klicker-ai: the failure is triggered by `store:false` on the Responses API. When `store:true` is present, the server retains prior response items and subsequent tool-call steps can reference them by id — the continuation works correctly. The API family (`provider.responses` vs `provider.chat`) is not the variable.

**Why this matters for reasoning.** The Responses API is the **only** standard OpenAI/Azure path that surfaces reasoning summaries as discrete stream events. Chat Completions buries reasoning as an opaque `reasoning_tokens` count in usage metadata; no human-readable summary is ever emitted. Pinning `provider.chat` as "non-negotiable" would have permanently suppressed reasoning content while leaving the `store:false` root cause unfixed under a different transport.

**Corrected invariant.** Use `provider.responses(modelId)` (the `@ai-sdk/openai` default) with `store:true` always set in `providerOptions.openai`. This resolves multi-step tool calls, surfaces reasoning summaries, and matches the transport already in use by production `apps/chat` (`CHAT_OPENAI_STORE_RESPONSES=true`). The prior S1 "fix" (Chat Completions) accidentally resolved the symptom by switching away from the Responses API entirely, while misidentifying the cause as the API family rather than the `store` flag.

The `@openrouter/ai-sdk-provider` dependency has been removed entirely. All models — reasoning and non-reasoning — use the standard `@ai-sdk/openai` provider pointed at an OpenAI-compatible base URL.

---

## Reasoning Streaming: Now Validated

**Prior status.** The evaluation report §12 recorded: *"Reasoning streaming — wired, not separately validated."* The reason for the gap was that the baseline model in the prototype was `openai/gpt-4.1` (an OpenRouter-style id), which emits no reasoning content; `sendReasoning:true` was wired in the `toAISdkStream` call but never exercised.

**Current status.** Validated end-to-end against Azure klicker-ai using gpt-5.1 with `reasoningEffort=medium`. Key findings follow.

### Reasoning channel vs reasoning summary

Two distinct concepts must be kept separate:

- **Reasoning channel** — whether the Responses API emits any `reasoning-start` event for the response. This is **deterministic**: `reasoning-start` fires on every response from a reasoning-capable model in the Responses API path, even when the summary text is empty. This is the reliable signal that the reasoning pipeline is open and functioning.

- **Reasoning summary** — whether the provider populates `reasoning-delta` parts with non-empty text. On Azure gpt-5.1 this is **non-stationary and bursty**: a given response either yields a full summary (~71–89 `reasoning-delta` parts) or none at all, and the rate drifts window-to-window. This is a provider-side behavior, not a pipeline bug (see the Azure provider findings table below).

The client and UI must tolerate empty `reasoningContent` in the finish metadata as a legitimate provider outcome, not an error condition.

### Non-reasoning model behavior

gpt-4.1-mini with no `reasoningEffort` yields exactly zero `reasoning-delta` parts, `reasoningEffort=null`, and `reasoningContent=null` in finish metadata. This is correct — `toAISdkStream` cannot inject spurious reasoning parts for a model that emits none.

---

## Azure AI Foundry Provider Findings

| Finding | Detail | Evidence |
|---|---|---|
| `store:true` always required | Responses API continuation steps reference prior response items by id; `store:false` causes "No tool call found for function call output" on any multi-step tool call. Must be set unconditionally in `providerOptions.openai`. | `agent.ts` `responsesProviderOptions`; bisection against Azure klicker-ai |
| Reasoning only via Responses API | Chat Completions masks reasoning as opaque `reasoning_tokens` in usage; no summary is ever emitted. `provider.responses()` with `reasoningSummary:'detailed'` (or `'auto'`) is the only standard OpenAI/Azure path that surfaces a human-readable reasoning summary. | `agent.ts` `modelFor`/`responsesProviderOptions`; OpenAI API documentation |
| Bursty / non-stationary summary delivery | gpt-5.1 with `reasoningEffort=medium` emits either a full summary (~71–89 `reasoning-delta` parts) or none. The empty rate drifts: observed ~83% non-empty in one window, 0/8 in the next. **Bisection evidence**: raw `@ai-sdk/openai` `streamText`, Mastra's raw `fullStream`, and the converted v6 stream were each measured across repeated runs; all three tiers showed the same bursty empties and tracked together within a window (e.g. a window where all three were near-empty), ruling out any pipeline layer as the source. The burstiness originates at the Azure provider. | `check-reasoning.ts` header + gating logic |
| `reasoning-start` is deterministic | The `reasoning-start` item fires on every response from a reasoning-capable model in the Responses API path, even when `reasoning-delta` text is empty. This is the reliable per-response signal that the reasoning channel is open. | `check-reasoning.ts` gating logic |
| Deployed model inventory | Azure klicker-ai exposes gpt-4.1 (primary), gpt-4.1-mini (fallback), gpt-5.1 (reasoning), and gpt-5-mini. All are addressable via a single `@ai-sdk/openai` provider pointed at `OPENAI_BASE_URL`; no per-capability provider branching is needed. o3/o4-mini/gpt-4o-mini are NOT deployed. | `env.ts`; `cost.ts` |
| `REASONING_MODEL_RE` covers gpt-5 family | The single regex `/(^|\/)(o\d|gpt-5(?!\d)|deepseek-r1)|:thinking/i` matches o-series, the entire gpt-5.x family (gpt-5, gpt-5-mini, gpt-5.1, gpt-5.4, gpt-5.5), deepseek-r1, and `:thinking` variants. The negative lookahead `(?!\d)` prevents a hypothetical `gpt-50` from matching. `effort:'none'` disables reasoning even on a matched model. | `agent.ts` `REASONING_MODEL_RE` |

---

## Bug Found and Fixed: `onStepFinish` ↔ Finish-Chunk Race

### The bug

The original server accumulated `reasoningContent` via Mastra's `onStepFinish` callback and stored it in a shared variable that was read when building the finish metadata. Under HTTP backpressure, `toAISdkStream` emitted the finish chunk **before** `onStepFinish` had run, leaving `reasoningContent=null` in the finish metadata even though 78–80 `reasoning-delta` parts had already been streamed to the client. Three consecutive drops were observed in a single validation run. A synchronous, non-HTTP probe of the same code never reproduced it — only the real HTTP path, under backpressure, triggered the race.

This is a timing race between Mastra's callback layer and the AI SDK's stream-ordering contract. The pipeline conversion (`toAISdkStream`) was not at fault; the finish chunk itself was built before the callback fired.

### The fix

A downstream passthrough `TransformStream` is inserted after `toAISdkStream`. It accumulates all `reasoning-delta` text parts as they pass through — stream ordering guarantees these arrive before the `finish` part — and then intercepts the `finish` part to patch `messageMetadata.reasoningContent` with the accumulated text. Because the accumulation runs in the same in-order stream pass that later sees the finish part, the value is always complete by the time the finish part is patched, and the race is eliminated. The finish chunk object is spread (not mutated in place) to avoid owning `toAISdkStream`'s reference.

Implemented in `server.ts` (the reasoning accumulator transform). Committed as `72036c005` on `feat/chat-mastra-prototype`.

### Before / after

| Metric | Before fix (`onStepFinish`) | After fix (`TransformStream`) |
|---|---|---|
| `reasoningContent=null` drops observed | 3 consecutive in one run | 0 across 11 reasoning runs |
| `reasoning-delta` parts streaming to client | 78–80 (correct) | unchanged |
| Root cause | `onStepFinish` races finish chunk under backpressure | eliminated by in-order stream accumulation |

---

## Cost Data

Reasoning tokens on gpt-5.x are billed as output tokens and flow through the output price in `cost.ts` ($10.00/M output for gpt-5.1, gpt-5.4, gpt-5.5). The following figures were measured live against Azure klicker-ai and represent the first empirical cost benchmarks for the prototype.

| Model | Scenario | `creditsUsed` per reply |
|---|---|---|
| gpt-4.1-mini | Non-reasoning baseline; short reply; `store:true`; Azure klicker-ai | ~0.0000152–0.000066 USD |
| gpt-5.1 | Reasoning; `effort=medium`; short reply; Azure klicker-ai (reasoning tokens billed as output) | ~0.00138–0.0025 USD |
| gpt-5.1 | `reasoning-delta` part count per response when provider emits a summary | 71–89 parts |

`costForTokens` returns `null` for unknown model ids; it never silently charges zero. This matches the credit-metering contract the next-steps plan expects of the production billing path.

---

## Corrections to Prior Docs

| Doc | Location | Currently says | Should say |
|---|---|---|---|
| `RESULTS.md` | S1 — Findings / caveats — "Critical API gotcha (fixed)" | "No tool call found" failure caused by Responses API default; fix: switch to `provider.chat(modelId)`. | Failure caused by `store:false`, not the Responses API. Responses API + `store:true` resolves multi-step tool calls. `provider.chat` must not be pinned. |
| `RESULTS.md` | S1 — Findings / caveats — failure environments | OpenRouter listed as one of two failure environments. | OpenRouter has been dropped entirely. Validated transport is Azure klicker-ai via Responses API with `store:true`. |
| `RESULTS.md` | §5 — Conditions on GO — item 1 | "Pin `provider.chat` (Chat Completions) — the Responses default breaks multi-step tool calls (S1). Non-negotiable." | Use `provider.responses(modelId)` (Responses API) with `store:true`. The `store:false` flag broke tool calls, not the API family. Pinning Chat Completions would suppress reasoning summaries. |
| `RESULTS.md` | §5 — Final verdict matrix — S1 row | "adopt-with-changes — pin `provider.chat` (Responses breaks tool calls)" | "adopt-with-changes — use Responses API with `store:true`; `store:false` breaks multi-step tool calls and suppresses reasoning summaries" |
| `RESULTS.md` | S0 — `toAISdkStream` config | `sendReasoning:true` listed as a config parameter; no evidence of reasoning deltas actually streaming. | `sendReasoning:true` confirmed working. Requires downstream passthrough `TransformStream` to avoid `reasoningContent=null` race. Post-fix drop rate: 0/11. |
| `RESULTS.md` | S0 — Finish-metadata evidence | `creditsUsed:0` in finish chunk; model id shown as `openai/gpt-4.1` (OpenRouter-style). | `creditsUsed` is populated with real values from the provider. Model id in original evidence is stale; validated backend is Azure klicker-ai. See cost table above. |
| `RESULTS.md` | S1 — `CHAT_OPENAI_STORE_RESPONSES` learning reference | Chat Completions fix "matches the existing `CHAT_OPENAI_STORE_RESPONSES` codebase learning." | The codebase learning is correct: `store:true` + Responses API is required. The S1 Chat Completions "fix" contradicted it. The actual landmine: `store:false` breaks multi-step tool calls on the Responses API. |
| `RESULTS.md` | §5 — Final verdict matrix — no A2 row | No reasoning slice in the verdict matrix. | Add A2 row: Responses API + `store:true` → adopt (required for reasoning summaries and tool calls); `sendReasoning:true` + downstream `TransformStream` → adopt-with-changes (race fix `72036c005`); bursty summary emission → provider behavior, no fix; non-reasoning models → 0 reasoning parts, as expected. |
| Evaluation report | §12 — Conditions on GO — item 1 | "Pin `provider.chat`. The Responses API breaks stateless multi-step tool calls over OpenRouter/Azure. Non-negotiable; matches `CHAT_OPENAI_STORE_RESPONSES` learning." | Use Responses API (`provider.responses()`) with `store:true`. S0 failure was `store:false`. Chat Completions hides reasoning as opaque `reasoning_tokens`. `@openrouter/ai-sdk-provider` dropped. Committed `72036c005`. |
| Evaluation report | §12 — S1 verdict row "Provider API default" | "adopt-with-changes — pin `provider.chat`" | "adopt-with-changes — use Responses API with `store:true`; root cause of S0 failure was `store:false`, not the API family" |
| Evaluation report | §12 — reasoning streaming row | "wired, not separately validated" | "validated — gpt-5.1 emits 71–89 `reasoning-delta` parts when provider emits a summary; non-stationary (provider behavior confirmed by bisection). Race bug found and fixed (`72036c005`); 0 drops post-fix across 11 runs." |
| Evaluation report | §3.1 — current architecture — Providers row | "Single OpenAI-compatible base URL (Azure / OpenRouter), custom fetch workaround for an AI SDK Responses-API bug" | "Single OpenAI-compatible base URL (Azure klicker-ai), Responses API (`store:true`) as standard path. `@openrouter/ai-sdk-provider` removed." (Note: the production `responsesApiFetch` workaround is a separate concern — see Impact below.) |
| Evaluation report | §5 — Verified Compatibility Matrix — Reasoning passthrough row | "Native `reasoning-delta` chunk type; `sendReasoning:true`; removes an earlier concern." No empirical validation. | Validated empirically against Azure klicker-ai. gpt-5.1: 71–89 `reasoning-delta` parts when provider emits a summary; bursty/non-stationary (provider). gpt-4.1-mini: 0 reasoning parts, null `reasoningContent`. Race bug found and fixed (`72036c005`). |
| Next-steps plan | A2 — "Single most important prerequisite" | "The prototype deliberately uses `provider.chat()` to dodge the Responses-API tool-call breakage. Whether `OPENAI_BASE_URL` surfaces reasoning tokens via Chat Completions is the open question." | Closed: Chat Completions does not surface reasoning summaries on Azure/OpenAI. Responses API + `store:true` is the validated transport for both tool-call steps and reasoning summaries. |
| Next-steps plan | A2 — Step 1 (transport check) | "Raw Chat Completions streaming request; check for `reasoning_content` field. If absent, evaluate Azure Responses API — which expands scope." | Complete. Result: Chat Completions does not surface reasoning summaries. Azure Responses API adopted as single transport. No per-capability branching needed. |
| Next-steps plan | A2 — Step 4 (accumulate reasoning) | "Accumulate reasoning text via `onStepFinish`; confirm step results carry reasoning text." | Do NOT use `onStepFinish` for `reasoningContent` accumulation — it races the finish chunk under HTTP backpressure. Use a downstream passthrough `TransformStream` (implemented in `server.ts` as of `72036c005`). |
| Next-steps plan | A2 — Risks — "provider does not surface reasoning via Chat Completions" | "Switch to direct OpenAI key or Azure Responses API; branch model instantiation per capability." | Risk materialized. Resolution: Azure Responses API + `store:true` is the single transport for all models. No per-capability branching required. `@openrouter/ai-sdk-provider` dropped. |
| Next-steps plan | A2 — Step 2 (assertion strategy) | "Assert ≥1 `reasoning-start` and ≥1 non-empty `reasoning-delta` in raw and converted streams." | Assert ≥1 `reasoning-start` (hard gate; deterministic). Treat non-empty `reasoning-delta` as positive proof but soft-warn on empty (bursty Azure behavior — not a pipeline bug). |
| Next-steps plan | A2 — `@openrouter/ai-sdk-provider` dependency | Named as required dependency for the reasoning path; separate `reasoningProvider` plumbing allowed. | Removed entirely. Standard `@ai-sdk/openai` provider pointed at `OPENAI_BASE_URL` handles all models including reasoning. |
| Next-steps plan | B2 Phase 2 — Step 18 | "Pin `provider.chat()` (Chat Completions — non-negotiable, per the prototype). Remove the `responsesApiFetch` workaround." | Use `provider.responses()` with `store:true` — not `provider.chat()`. This is the only path that surfaces reasoning summaries and supports multi-step tool calls. Matches production `apps/chat` transport. |

---

## Impact on Productionization

**Transport wiring in B2 Phase 2 Step 18.** The step that ports the prototype engine into `apps/chat` must use `provider.responses(modelId)` with `store:true` unconditionally — not `provider.chat()`. Production `apps/chat` already runs the Responses API with `CHAT_OPENAI_STORE_RESPONSES=true` and a `responsesApiFetch` shim for a separate AI-SDK body-shape issue; the prototype did not need that shim because it streams through Mastra's provider layer rather than the app's custom fetch. Whether the production shim is still required after the engine extraction should be re-checked against the extracted path rather than assumed — it is a body-shape workaround, not a `store`-flag workaround, so the two are independent.

**Reasoning model wiring.** The `REASONING_MODEL_RE` regex and the `responsesProviderOptions` helper from `agent.ts` provide the canonical model-detection and options-assembly logic. These should be extracted into `packages/chat-engine` rather than duplicated. The key invariant: `reasoningEffort` and `reasoningSummary` are only passed to the provider when reasoning is engaged and the model id matches the regex; non-reasoning models must not receive these params, to avoid 400s from strict backends.

**Empty `reasoningContent` is not an error.** Because Azure gpt-5.1 reasoning summary delivery is bursty and non-stationary, any response may legitimately arrive with `reasoningContent=null` even when reasoning was requested. The frontend (`apps/chat`) must treat this as a normal case — do not display an error, do not retry. The reasoning channel being open (confirmed by `reasoning-start`) is separate from whether the provider chose to emit summary text. The UI should render reasoning content when present and silently omit it when absent.

**`reasoningSummary:'auto'` vs `'detailed'`.** The prototype uses `'detailed'` to bias toward richer summaries. Production `apps/chat` uses `'auto'`. This tradeoff has not been evaluated empirically — `'detailed'` may increase cost or latency without measurably improving summary quality on gpt-5.1, and it does not change the bursty-empty behavior. Assess before B2 ships.

---

## Open Items

- Propagate the transport/`store` corrections into `RESULTS.md` (S1 caveats, §5 conditions on GO, §5 verdict matrix; add an A2 row) and into the evaluation report (§12 conditions on GO, S1 row, reasoning row, §3.1, §5 matrix reasoning row).
- Update `PLAN-chat-mastra-next-steps.md` (A2 section and B2 Phase 2 Step 18) to reflect the corrected transport, removal of `@openrouter/ai-sdk-provider`, and the `onStepFinish` → `TransformStream` change for `reasoningContent` accumulation.
- Evaluate `reasoningSummary:'auto'` vs `'detailed'` for gpt-5.1 on Azure: measure cost/latency delta and qualitative summary richness across a fixed prompt set before committing a production value.
- Track the pre-existing MCP client double-cleanup nit in `server.ts` (both the stream `flush` hook and the abort listener can call the MCP `disconnect` on client abort, with no idempotency guard) — present before A2, not addressed by it, acceptable to defer to B2.
- Delete the two untracked A2 scratch files left in the worktree: `prototype/mastra-chat/src/probe-aisdk.ts` (throwaway bisection probe) and `prototype/mastra-chat/.git-commit-msg-a2.txt` (commit-message file).

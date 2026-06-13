# Prototype results — per-slice verdicts

Living record. Each slice appends a verdict here; the final §5 matrix in the plan
is filled from this file. Verdict vocabulary: **adopt** / **adopt-with-changes** /
**drop**.

---

## S0 — Engine spine — ✅ DONE

**What ran.** Hono service (`src/server.ts`) builds a per-request dynamic Mastra
`Agent` (`src/engine/agent.ts`) from a copied `Chatbot` row (instructions from
`systemPrompts[mode]`, OpenAI-compatible provider from env/row). Output converted
via `toAISdkStream(stream, { from:'agent', version:'v6', sendReasoning:true,
messageMetadata })` and returned with `createUIMessageStreamResponse`. Vanilla SSE
harness (`public/index.html`) renders it.

**Evidence.**
- `tsc --noEmit` clean against pinned Mastra 1.41 / ai 6.0.91.
- Streaming: `POST /api/chat` emits `start → start-step → text-start →
  text-delta* → finish-step → finish` AI-SDK-v6 UIMessage chunks.
- Finish-metadata shim: finish chunk carries
  `{"modelId":"openai/gpt-4.1","chatMode":"tutor","creditsUsed":0}` — all shim
  fields round-trip.
- Model fallback: request with bogus primary `openai/this-model-does-not-exist-zzz`
  errored 400 on the primary tier, Mastra retried the fallback tier, user got a
  clean answer with no user-visible error. Fallback array shape is
  `[{ model: primary }, { model: fallback }]` (`ModelWithRetries`).
- Browser e2e (agent-browser): typed a question in the harness, assistant answer
  streamed and rendered, finish-metadata box populated. Screenshot `/tmp/s0-after.png`.

**Findings / caveats.**
- **Type skew (churn flag):** Mastra `@mastra/ai-sdk` vendors its own `ai-v6`
  chunk types whose `finish` chunk allows `finishReason:'unknown'`, which the
  app's `ai@6.0.91` narrows out. Runtime chunks identical; bridged with one
  documented cast in `server.ts`. Record as an API-churn data point.
- **Fallback model attribution gap:** our finish-metadata `modelId` reflects the
  *requested* model, not the tier that actually answered. When fallback fires, the
  UI would show the failed primary's id. Production needs the resolved model id
  surfaced from Mastra (telemetry/step metadata) into the shim. Minor, fixable.

**Verdict.** Engine swap → **adopt**. Model fallback → **adopt**. Finish-metadata
shim → **adopt-with-changes** (wire the resolved model id on fallback).
